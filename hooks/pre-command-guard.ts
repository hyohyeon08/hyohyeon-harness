/** PreToolUse(Bash) — block approval commands and direct `.intent/` writes. */
import { readStdinJson } from './_stdin.js'
import { rootOf, isIntentProject } from './_env.js'
import { checkAgentCommand } from '../src/runtime/command-guard.js'

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function deny(reason: string): void {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[intent command guard] ${reason}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }))
}

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return
  const tool = payload.tool_name ?? payload.toolName
  if (tool !== 'Bash') return
  const input = objectValue(payload.tool_input ?? payload.toolInput)
  if (typeof input.command !== 'string') return
  const decision = checkAgentCommand(input.command)
  if (decision.blocked) deny(decision.reason)
}

main().catch((error) => {
  process.stderr.write(`[intent] pre-command-guard error (ignored): ${error}\n`)
  process.exit(0)
})
