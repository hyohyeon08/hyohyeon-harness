import { resolve, relative, isAbsolute } from 'node:path'

/**
 * Anti-cheat guard: `.intent/` is a CLI-only protected state channel.
 *
 * Approval status, DoD checks, and learnings must flow through the `intent`
 * CLI, never through an Edit/Write to the state files. This preserves schema
 * validation, atomic updates, lineage, and provenance while allowing the agent
 * to perform every lifecycle transition autonomously.
 */
export function isProtectedPath(targetPath: string, root: string): boolean {
  const intentDir = resolve(root, '.intent')
  const target = resolve(root, targetPath)
  const rel = relative(intentDir, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
