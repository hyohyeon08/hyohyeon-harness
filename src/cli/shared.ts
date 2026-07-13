import { isAiAgent } from '../runtime/env.js'
import { loadIntents } from '../runtime/intents.js'

export interface CliContext {
  root: string
  args: string[]
  harnessRoot: string
}

/** Human decisions are human-only — refuse when an AI agent runs the CLI. */
export function assertHumanShell(action = 'approval'): void {
  if (isAiAgent()) {
    console.error(`${action} is human-only (AI agent environment detected). Run this from your own shell.`)
    process.exit(1)
  }
}

export function findIntent(root: string, id: string) {
  const intent = loadIntents(root).find((candidate) => candidate.id === id)
  if (!intent) {
    console.error(`no such intent: ${id}`)
    process.exit(1)
  }
  return intent
}

export function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
