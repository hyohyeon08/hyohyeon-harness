import type { Intent } from './schemas.js'
import { classifyChange, type Change } from './triviality.js'
import { matchesScope } from './scope.js'

/**
 * The Intent-First Gate — the spine of the harness.
 *
 *   trivial change                                   -> allow (low friction)
 *   non-trivial + no approved intent                  -> BLOCK (declare intent first)
 *   non-trivial + approved intent, path out of scope  -> BLOCK (scope creep)
 *   non-trivial + approved intent covering the path   -> allow (human understood it)
 *
 * Pure function: takes the proposed change and the set of intents, returns a
 * decision. The PreToolUse hook (Phase 4) is a thin adapter over this.
 */
export interface GateDecision {
  allow: boolean
  reason: string
}

export function decideGate(change: Change, intents: Intent[], maxLines = 5): GateDecision {
  const verdict = classifyChange(change, maxLines)
  if (verdict.triviality === 'trivial') {
    return { allow: true, reason: `trivial: ${verdict.reason}` }
  }

  const approved = intents.filter((i) => i.status === 'approved')
  if (approved.length === 0) {
    const drafts = intents.filter((i) => i.status === 'draft')
    const hint = drafts.length > 0
      ? `${drafts.length} draft intent(s) awaiting human approval — run \`intent approve <id>\``
      : 'declare one first — run `intent draft`'
    return {
      allow: false,
      reason: `non-trivial change (${verdict.reason}) requires an approved intent; ${hint}`,
    }
  }

  const covering = approved.filter((i) => matchesScope(change.path, i.scope))
  if (covering.length === 0) {
    return {
      allow: false,
      reason:
        `change to ${change.path} is outside the scope of approved intent(s) ` +
        `${approved.map((i) => i.id).join(', ')} — widen an intent's scope or declare a new one`,
    }
  }

  return {
    allow: true,
    reason: `non-trivial change covered by approved intent ${covering.map((i) => i.id).join(', ')}`,
  }
}
