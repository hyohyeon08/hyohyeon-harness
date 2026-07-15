/**
 * Minimal glob matcher for intent scopes (deterministic, no deps).
 *
 *   **            matches anything (default scope)
 *   src/order/**  matches any path under src/order/
 *   *             matches within a single path segment (no '/')
 *   src/foo.ts    exact match
 *
 * Paths and patterns are normalized to forward slashes so Windows
 * backslashes match the same scopes.
 */
function normalize(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * A governed path must identify a location below the repository root.
 * Absolute paths, drive-qualified paths, and parent traversal are never valid
 * scope targets even when a broad glob such as `**` would otherwise match.
 */
export function isRepositoryRelativePath(path: string): boolean {
  const target = normalize(path)
  if (target.length === 0 || target.includes('\0')) return false
  if (target.startsWith('/') || /^[A-Za-z]:/.test(target)) return false
  return !target.split('/').includes('..')
}

function globToRegExp(pattern: string): RegExp {
  const p = normalize(pattern)
  let re = ''
  let i = 0
  while (i < p.length) {
    const c = p[i]
    if (c === '*') {
      if (p[i + 1] === '*') {
        re += '.*'
        i += 2
        if (p[i] === '/') i += 1 // treat `**/` as "any depth"
      } else {
        re += '[^/]*'
        i += 1
      }
    } else {
      re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      i += 1
    }
  }
  return new RegExp('^' + re + '$')
}

/** True if `path` is covered by at least one of the scope `patterns`. */
export function matchesScope(path: string, patterns: readonly string[]): boolean {
  const target = normalize(path)
  if (!isRepositoryRelativePath(target)) return false
  return patterns.some((pat) => isRepositoryRelativePath(pat) && globToRegExp(pat).test(target))
}
