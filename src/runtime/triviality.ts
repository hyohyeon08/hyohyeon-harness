/**
 * Deterministic triviality classifier (no LLM — Beck's "hooks are deterministic").
 *
 * A change is "trivial" (gate-exempt) only when it is small AND introduces no
 * new structure. Anything that adds a symbol, control flow, or a new file is
 * "non-trivial" and requires an approved intent. This keeps friction low for
 * typos/formatting while ensuring every real change crosses a readiness gate.
 */
export interface Change {
  path: string
  addedLines: number
  removedLines: number
  /** New function/class/export/const introduced by this change. */
  newSymbols: boolean
  /** New if/for/while/switch/try control flow introduced. */
  addsControlFlow: boolean
  /** Change touches only comments, whitespace, or formatting. */
  onlyCommentsOrFormat: boolean
  /** This change creates a file that did not exist. */
  isNewFile: boolean
  /** This change deletes an existing file. */
  deletesFile?: boolean
}

export type Triviality = 'trivial' | 'non-trivial'

export interface TrivialityVerdict {
  triviality: Triviality
  reason: string
}

export function classifyChange(change: Change, _maxLines = 5): TrivialityVerdict {
  if (change.deletesFile) {
    return { triviality: 'non-trivial', reason: 'deletes file' }
  }
  if (change.isNewFile) {
    return { triviality: 'non-trivial', reason: 'new file' }
  }
  if (change.newSymbols) {
    return { triviality: 'non-trivial', reason: 'introduces new symbol' }
  }
  if (change.addsControlFlow) {
    return { triviality: 'non-trivial', reason: 'adds control flow' }
  }
  if (change.onlyCommentsOrFormat) {
    return { triviality: 'trivial', reason: 'comments/formatting only' }
  }
  const churn = change.addedLines + change.removedLines
  return {
    triviality: 'non-trivial',
    reason: `code change requires intent governance (${churn} changed lines)`,
  }
}
