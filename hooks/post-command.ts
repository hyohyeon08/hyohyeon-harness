/** PostToolUse(Bash) — record observed shell output without re-executing it. */
import { readStdinJson } from './_stdin.js'
import { rootOf, isIntentProject } from './_env.js'
import { recordObservedCommand } from '../src/runtime/commands.js'
import { activeRun } from '../src/runtime/runs.js'

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringField(object: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (typeof object[key] === 'string') return object[key] as string
  }
  return null
}

function numberField(object: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    if (typeof object[key] === 'number' && Number.isInteger(object[key])) return object[key] as number
  }
  const metadata = objectValue(object.metadata)
  for (const key of keys) {
    if (typeof metadata[key] === 'number' && Number.isInteger(metadata[key])) return metadata[key] as number
  }
  return null
}

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return
  const toolName = payload.tool_name ?? payload.toolName
  if (toolName !== 'Bash') return
  const input = objectValue(payload.tool_input ?? payload.toolInput)
  const command = stringField(input, 'command')
  if (!command || /(?:^|\s)intent command\s+--/.test(command)) return
  const run = activeRun(root)
  if (!run) return
  const responseValue = payload.tool_response ?? payload.toolResponse
  const response = objectValue(responseValue)
  const output = stringField(response, 'output', 'stdout') ?? (typeof responseValue === 'string' ? responseValue : '')
  const stderr = stringField(response, 'stderr', 'error') ?? ''
  recordObservedCommand(root, {
    runId: run.runId,
    command,
    exitCode: numberField(response, 'exit_code', 'exitCode', 'status'),
    stdout: output,
    stderr,
    source: 'post-tool-use-bash',
  })
}

main().catch((error) => {
  process.stderr.write(`[intent] post-command hook error (ignored): ${error}\n`)
  process.exit(0)
})
