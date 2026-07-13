/**
 * Allocate after the highest persisted numeric suffix. Counting records can
 * reuse an existing id when an earlier record was removed (001, 003 -> 003).
 */
export function nextSequentialId(prefix: string, existingIds: string[]): string {
  const marker = `${prefix}-`
  const highest = existingIds.reduce((max, id) => {
    if (!id.startsWith(marker)) return max
    const suffix = id.slice(marker.length)
    if (!/^\d+$/.test(suffix)) return max
    return Math.max(max, Number.parseInt(suffix, 10))
  }, 0)
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`
}

export function compareSequentialIds(left: string, right: string): number {
  const leftMatch = left.match(/-(\d+)$/)
  const rightMatch = right.match(/-(\d+)$/)
  if (leftMatch && rightMatch) {
    const numeric = Number.parseInt(leftMatch[1], 10) - Number.parseInt(rightMatch[1], 10)
    if (numeric !== 0) return numeric
  }
  return left.localeCompare(right)
}
