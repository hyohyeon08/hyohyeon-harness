import { approvalActor } from '../runtime/env.js'
import { loadIntents } from '../runtime/intents.js'

export interface CliContext {
  root: string
  args: string[]
  harnessRoot: string
}

/** Actor provenance for autonomous lifecycle transitions. */
export function approvalActorForCli(): string {
  return approvalActor()
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
