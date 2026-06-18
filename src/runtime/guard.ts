import { resolve, relative, isAbsolute } from 'node:path'

/**
 * Anti-cheat guard: `.intent/` is a human-only state channel.
 *
 * Approval status, DoD checks, and learnings must flow through the `intent`
 * CLI (which runs in the human's shell), never through an AI Edit/Write to the
 * state files. Otherwise the AI could flip an intent to `approved` itself and
 * defeat the whole gate. This blocks any AI write that lands under `.intent/`.
 */
export function isProtectedPath(targetPath: string, root: string): boolean {
  const intentDir = resolve(root, '.intent')
  const target = resolve(root, targetPath)
  const rel = relative(intentDir, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
