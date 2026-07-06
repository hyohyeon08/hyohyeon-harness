import type { Intent, RunState, VerificationEvidenceType } from './schemas.js'

/**
 * Can this approved intent transition to 'done'?
 *
 *   - all DoD items checked, AND
 *   - if it changes behavior (feature/fix), a learning note is recorded.
 *
 * tidy/chore are exempt from the learning requirement (decision: 학습 노트는
 * behavior 변경에만 필수).
 */
export interface CompletionCheck {
  ok: boolean
  reason: string
}

export function missingRequiredEvidenceTypes(run?: RunState | null): VerificationEvidenceType[] {
  if (!run) return []
  return run.requiredEvidenceTypes.filter((type) => !run.evidence.some((e) => e.type === type))
}

function requiredEvidenceCheck(run?: RunState | null): CompletionCheck {
  if (!run || run.requiredEvidenceTypes.length === 0) return { ok: true, reason: 'no required verification evidence' }

  const missing = missingRequiredEvidenceTypes(run)
  if (missing.length > 0) return { ok: false, reason: `required evidence missing: ${missing.join(', ')}` }

  const notPassing = run.requiredEvidenceTypes.filter((type) => !hasPassingEvidence(run, type))
  if (notPassing.length > 0) return { ok: false, reason: `required evidence failed: ${notPassing.join(', ')}` }

  return { ok: true, reason: 'required verification evidence passed' }
}

function hasPassingEvidence(run: RunState, type: VerificationEvidenceType): boolean {
  return run.evidence.some((e) => e.type === type && e.status === 'passed')
}

export function canComplete(intent: Intent, run?: RunState | null): CompletionCheck {
  if (intent.status !== 'approved') {
    return { ok: false, reason: `not approved (status: ${intent.status})` }
  }
  const unchecked = intent.dod.filter((d) => !intent.dodChecked.includes(d))
  if (unchecked.length > 0) {
    return {
      ok: false,
      reason: `DoD incomplete (${intent.dodChecked.length}/${intent.dod.length})`,
    }
  }
  const changesBehavior = intent.type === 'feature' || intent.type === 'fix'
  if (changesBehavior && !intent.learnings) {
    return {
      ok: false,
      reason: `behavior change needs a learning note — run \`intent learn ${intent.id} "..."\``,
    }
  }
  const evidence = requiredEvidenceCheck(runAppliesToIntent(intent, run) ? run : null)
  if (!evidence.ok) return evidence
  return { ok: true, reason: 'ready to complete' }
}

function runAppliesToIntent(intent: Intent, run?: RunState | null): boolean {
  return !!run && (!run.intentId || run.intentId === intent.id)
}

/**
 * The Stop gate — what the Stop hook (Phase 4) consults before letting a
 * session end. It blocks while any approved (in-progress) intent is not yet
 * completable. Pure function over the intent set.
 */
export interface StopDecision {
  block: boolean
  reasons: string[]
}

export function evaluateStopGate(intents: Intent[], run?: RunState | null): StopDecision {
  const reasons: string[] = []
  for (const i of intents) {
    if (i.status !== 'approved') continue
    const c = canComplete(i, run)
    if (!c.ok) reasons.push(`${i.id}: ${c.reason}`)
  }
  return { block: reasons.length > 0, reasons }
}
