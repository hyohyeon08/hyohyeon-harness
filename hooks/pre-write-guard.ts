/**
 * PreToolUse(Edit|Write|apply_patch) — the Intent-First Gate hook.
 *
 * Thin adapter: parse tool input -> extractChange -> decideGate. Supports
 * Claude Code Edit/Write payloads and Codex apply_patch payloads. Silent-fail
 * (never aborts the session): on any internal error it exits 0 and lets the
 * write through.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { readStdinJson } from './_stdin.js'
import { extractChange, type RawEdit } from '../src/runtime/change-extract.js'
import { extractApplyPatchEdits } from '../src/runtime/apply-patch.js'
import { decideGate } from '../src/runtime/intent-gate.js'
import { IntentStateError, loadIntents } from '../src/runtime/intents.js'
import { isProtectedPath } from '../src/runtime/guard.js'
import { checkRules, loadRules, RuleStateError } from '../src/runtime/rules.js'
import { activeContract, checkContractScope, ContractStateError } from '../src/runtime/contracts.js'
import { tryAppendSpanToActiveRun } from '../src/runtime/observability.js'
import { locateEditRegion } from '../src/runtime/edit-region.js'
import { rootOf, isIntentProject } from './_env.js'
import { activeRun, RunStateError } from '../src/runtime/runs.js'
import { isRepositoryRelativePath, matchesScope } from '../src/runtime/scope.js'
import { checkExecutionGovernance } from '../src/runtime/execution-governance.js'

function deny(reason: string): void {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

function toolName(payload: Record<string, any>): string {
  return payload.tool_name ?? payload.toolName ?? payload.name ?? payload.tool?.name ?? ''
}

function toolInput(payload: Record<string, any>): Record<string, any> {
  return payload.tool_input ?? payload.toolInput ?? payload.input ?? payload.arguments ?? {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function patchText(payload: Record<string, any>, input: Record<string, any>): string | null {
  return (
    stringValue(input.patch) ??
    stringValue(input.input) ??
    stringValue(input.content) ??
    stringValue(input.command) ??
    stringValue(payload.patch) ??
    stringValue(payload.input) ??
    stringValue(payload.content) ??
    stringValue(payload.command)
  )
}

function editsFromPayload(payload: Record<string, any>): RawEdit[] {
  const tool = toolName(payload)
  const input = toolInput(payload)
  const path: string | undefined = input.file_path ?? input.filePath ?? input.path

  if (tool === 'Write' && path) {
    return [
      {
        path,
        newText: input.content ?? '',
        oldText: '',
        isNewFile: false,
      },
    ]
  }

  if (tool === 'Edit' && path) {
    return [
      {
        path,
        newText: input.new_string ?? input.newString ?? '',
        oldText: input.old_string ?? input.oldString ?? '',
        isNewFile: false,
      },
    ]
  }

  if (tool.includes('apply_patch')) {
    const patch = patchText(payload, input)
    return patch ? extractApplyPatchEdits(patch) : []
  }

  return []
}

function materializeRepositoryEdit(root: string, tool: string, edit: RawEdit): RawEdit {
  if (tool !== 'Write') return edit
  const target = resolve(root, edit.path)
  const isNewFile = !existsSync(target)
  return {
    ...edit,
    oldText: isNewFile ? '' : readFileSync(target, 'utf8'),
    isNewFile,
  }
}

function normalizeRepositoryEditPath(root: string, edit: RawEdit): RawEdit | null {
  const normalizedInput = edit.path.replace(/\\/g, '/')
  if (normalizedInput.split('/').includes('..')) return null
  if (!isAbsolute(normalizedInput)) {
    return isRepositoryRelativePath(normalizedInput) ? { ...edit, path: normalizedInput } : null
  }
  const candidate = relative(root, resolve(normalizedInput)).replace(/\\/g, '/')
  return isRepositoryRelativePath(candidate) ? { ...edit, path: candidate } : null
}

function recordEditSpan(root: string, tool: string, edit: RawEdit, status: 'ok' | 'blocked', reason: string): void {
  const contained = isRepositoryRelativePath(edit.path)
  const target = contained ? resolve(root, edit.path) : null
  const content = target && existsSync(target) ? readFileSync(target, 'utf8') : ''
  const region = contained ? locateEditRegion(content, edit) : null
  tryAppendSpanToActiveRun(root, {
    kind: tool.includes('apply_patch') ? 'apply_patch' : 'edit',
    name: `pre-write ${tool || 'write'}`,
    status,
    attributes: {
      tool,
      path: edit.path,
      isNewFile: edit.isNewFile,
      reason,
      ...(region ?? {}),
    },
  })
}

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return // not an intent project → no-op (safe global install)
  const rawEdits = editsFromPayload(payload)
  if (rawEdits.length === 0) return // not ours -> allow

  const tool = toolName(payload)
  let rules
  try {
    rules = loadRules(root)
  } catch (error) {
    if (!(error instanceof RuleStateError)) throw error
    deny(`[rule state] ${error.message}. Repair the state before editing.`)
    return
  }
  let intents
  try {
    intents = loadIntents(root)
  } catch (error) {
    if (!(error instanceof IntentStateError)) throw error
    deny(`[intent state] ${error.message}. Repair the state before editing.`)
    return
  }
  let contract
  try {
    contract = activeContract(root)
  } catch (error) {
    if (error instanceof RunStateError) {
      deny(`[run state] ${error.message}. Repair the state before editing.`)
      return
    }
    if (!(error instanceof ContractStateError)) throw error
    deny(`[contract state] ${error.message}. Repair the state before editing.`)
    return
  }
  for (const rawEdit of rawEdits) {
    const normalizedEdit = normalizeRepositoryEditPath(root, rawEdit)
    if (!normalizedEdit) {
      const reason = `[root containment] ${rawEdit.path} does not resolve to a repository-contained path; parent traversal and outside-root absolute paths are forbidden`
      recordEditSpan(root, tool, rawEdit, 'blocked', reason)
      deny(reason)
      return
    }
    const edit = materializeRepositoryEdit(root, tool, normalizedEdit)

    // anti-cheat: .intent/ is CLI-only — the agent must use the `intent` CLI.
    if (isProtectedPath(edit.path, root)) {
      const reason =
        '[intent guard] .intent/ is protected CLI-only state. Use the `intent` CLI ' +
        '(e.g. `intent approve <id>`), do not edit state files directly.'
      recordEditSpan(root, tool, edit, 'blocked', reason)
      deny(reason)
      return
    }

    // approved gate rules are hard blocks — checked before the intent gate.
    const ruleHit = checkRules(edit.path, edit.newText, rules)
    if (ruleHit.blocked) {
      const reason = `[intent rule] ${ruleHit.reason}`
      recordEditSpan(root, tool, edit, 'blocked', reason)
      deny(reason)
      return
    }

    const contractHit = checkContractScope(edit.path, contract)
    if (contractHit.blocked) {
      const reason = `[contract gate] ${contractHit.reason}`
      recordEditSpan(root, tool, edit, 'blocked', reason)
      deny(reason)
      return
    }

    const decision = decideGate(extractChange(edit), intents)
    if (!decision.allow) {
      const reason = `[intent gate] ${decision.reason}`
      recordEditSpan(root, tool, edit, 'blocked', reason)
      deny(reason)
      return
    }
    if (decision.reason.startsWith('non-trivial')) {
      let run
      try {
        run = activeRun(root)
      } catch (error) {
        if (!(error instanceof RunStateError)) throw error
        deny(`[run state] ${error.message}. Repair the state before editing.`)
        return
      }
      const coveringIntents = intents.filter((intent) => (
        intent.status === 'approved' &&
        matchesScope(edit.path, intent.scope)
      ))
      const governedIntent = run?.intentId
        ? coveringIntents.find((intent) => intent.id === run.intentId)
        : coveringIntents.find((intent) => intent.type === 'feature' || intent.type === 'fix') ?? coveringIntents[0]
      if (run?.intentId && !governedIntent) {
        const reason = `[execution governance] active Run ${run.runId} (${run.intentId}) does not govern ${edit.path}`
        recordEditSpan(root, tool, edit, 'blocked', reason)
        deny(reason)
        return
      }
      if (governedIntent) {
        const execution = checkExecutionGovernance(governedIntent, run, contract)
        if (!execution.allow) {
          const reason = `[execution governance] ${execution.reason}`
          recordEditSpan(root, tool, edit, 'blocked', reason)
          deny(reason)
          return
        }
      }
    }
    recordEditSpan(root, tool, edit, 'ok', decision.reason)
  }
}

main().catch((e) => {
  process.stderr.write(`[intent] pre-write-guard error (ignored): ${e}\n`)
  process.exit(0)
})
