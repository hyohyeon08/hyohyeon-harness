import { existsSync } from 'node:fs'
import { paths } from '../src/state/paths.js'

/** The project the hook is firing in (Claude Code passes cwd in the payload). */
export function rootOf(payload: Record<string, any>): string {
  return payload.cwd ?? process.cwd()
}

/**
 * True only if this project has been `intent setup`. Hooks no-op otherwise so
 * the harness can be installed globally without affecting non-intent projects
 * (e.g. the intent gate must not block writes in a project that never opted in).
 */
export function isIntentProject(root: string): boolean {
  return existsSync(paths(root).base)
}
