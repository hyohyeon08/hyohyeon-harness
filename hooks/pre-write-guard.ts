/**
 * PreToolUse(Edit|Write) — the Intent-First Gate as a Claude Code hook.
 *
 * Thin adapter: parse tool input -> extractChange -> decideGate. Blocks a
 * non-trivial write that no approved intent covers. Silent-fail (never aborts
 * the session): on any internal error it exits 0 and lets the write through.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { readStdinJson } from './_stdin.js'
import { extractChange, type RawEdit } from '../src/runtime/change-extract.js'
import { decideGate } from '../src/runtime/intent-gate.js'
import { loadIntents } from '../src/runtime/intents.js'
import { isProtectedPath } from '../src/runtime/guard.js'
import { checkRules } from '../src/runtime/rules.js'
import { loadRules } from '../src/runtime/rules.js'
import { rootOf, isIntentProject } from './_env.js'

function deny(reason: string): void {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return // not an intent project → no-op (safe global install)
  const tool = payload.tool_name
  const input = payload.tool_input ?? {}
  const path: string | undefined = input.file_path

  if ((tool !== 'Edit' && tool !== 'Write') || !path) return // not ours -> allow

  // anti-cheat: .intent/ is human-only — the AI must use the `intent` CLI.
  if (isProtectedPath(path, root)) {
    deny(
      '[intent guard] .intent/ is human-only state. Use the `intent` CLI ' +
        '(e.g. `intent approve <id>`), do not edit state files directly.',
    )
    return
  }

  // Glob-based matchers (scope, rules) expect root-relative paths, but
  // tool_input.file_path is absolute. Normalize once at the boundary.
  const relPath = relative(root, resolve(root, path)) || path

  let edit: RawEdit
  if (tool === 'Write') {
    const isNewFile = !existsSync(path)
    edit = {
      path: relPath,
      newText: input.content ?? '',
      oldText: isNewFile ? '' : readFileSync(path, 'utf8'),
      isNewFile,
    }
  } else {
    edit = { path: relPath, newText: input.new_string ?? '', oldText: input.old_string ?? '', isNewFile: false }
  }

  // approved gate rules are hard blocks — checked before the intent gate.
  const ruleHit = checkRules(edit.path, edit.newText, loadRules(root))
  if (ruleHit.blocked) {
    deny(`[intent rule] ${ruleHit.reason}`)
    return
  }

  const decision = decideGate(extractChange(edit), loadIntents(root))
  if (!decision.allow) deny(`[intent gate] ${decision.reason}`)
}

main().catch((e) => {
  process.stderr.write(`[intent] pre-write-guard error (ignored): ${e}\n`)
  process.exit(0)
})
