import type {
  Intent,
  RunState,
  SprintContract,
  VerificationEvidence,
  VerificationEvidenceType,
} from './schemas.js'

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

export interface CompletionContext {
  intent: Intent
  run?: RunState | null
  contract?: SprintContract | null
  staleEvidenceTypes?: VerificationEvidenceType[]
}

export function requiredEvidenceTypesForCompletion(run: RunState, contract?: SprintContract | null): VerificationEvidenceType[] {
  return contract && contract.runId === run.runId ? contract.requiredChecks : run.requiredEvidenceTypes
}

export function missingRequiredEvidenceTypes(
  run?: RunState | null,
  contract?: SprintContract | null,
): VerificationEvidenceType[] {
  if (!run) return []
  return requiredEvidenceTypesForCompletion(run, contract).filter((type) => !latestEvidenceForType(run, type))
}

export function latestEvidenceForType(
  run: RunState,
  type: VerificationEvidenceType,
): VerificationEvidence | null {
  const matching = run.evidence.filter((evidence) => evidence.type === type)
  return matching[matching.length - 1] ?? null
}

function requiredEvidenceCheck(
  run?: RunState | null,
  contract?: SprintContract | null,
  staleEvidenceTypes: VerificationEvidenceType[] = [],
): CompletionCheck {
  if (!run) return { ok: true, reason: 'no required verification evidence' }
  const required = requiredEvidenceTypesForCompletion(run, contract)
  if (required.length === 0) return { ok: true, reason: 'no required verification evidence' }

  const missing = missingRequiredEvidenceTypes(run, contract)
  if (missing.length > 0) return { ok: false, reason: `required evidence missing: ${missing.join(', ')}` }

  const notPassing = required.filter((type) => latestEvidenceForType(run, type)?.status !== 'passed')
  if (notPassing.length > 0) return { ok: false, reason: `required evidence failed: ${notPassing.join(', ')}` }

  const stale = required.filter((type) => staleEvidenceTypes.includes(type))
  if (stale.length > 0) return { ok: false, reason: `required evidence stale after later edit: ${stale.join(', ')}` }

  return { ok: true, reason: 'required verification evidence passed' }
}

export function canComplete(
  intent: Intent,
  run?: RunState | null,
  contract?: SprintContract | null,
  staleEvidenceTypes: VerificationEvidenceType[] = [],
): CompletionCheck {
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
  const governedRun = runAppliesToIntent(intent, run) ? run : null
  if (changesBehavior && !governedRun) {
    return {
      ok: false,
      reason: 'behavior change needs a governed run linked to this intent',
    }
  }
  const evidence = requiredEvidenceCheck(
    governedRun,
    contractAppliesToIntent(intent, governedRun, contract) ? contract : null,
    staleEvidenceTypes,
  )
  if (!evidence.ok) return evidence
  const governedContract = contractAppliesToIntent(intent, governedRun, contract) ? contract : null
  if (changesBehavior && !governedContract) {
    return { ok: false, reason: 'behavior change needs an approved Contract linked to its governed Run' }
  }
  if (changesBehavior && governedRun?.phase !== 'verify') {
    return {
      ok: false,
      reason: `behavior change completion requires verify phase (current: ${governedRun?.phase ?? 'none'})`,
    }
  }
  return { ok: true, reason: 'ready to complete' }
}

function runAppliesToIntent(intent: Intent, run?: RunState | null): boolean {
  return !!run && (!run.intentId || run.intentId === intent.id)
}

function contractAppliesToIntent(intent: Intent, run?: RunState | null, contract?: SprintContract | null): boolean {
  return !!run && !!contract && contract.status === 'approved' && contract.runId === run.runId && contract.intentId === intent.id
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

export function evaluateStopGate(
  intents: Intent[],
  run?: RunState | null,
  contract?: SprintContract | null,
): StopDecision {
  const reasons: string[] = []
  for (const i of intents) {
    if (i.status !== 'approved') continue
    const c = canComplete(i, run, contract)
    if (!c.ok) reasons.push(`${i.id}: ${c.reason}`)
  }
  return { block: reasons.length > 0, reasons }
}

/** Pure reducer for projects where each Intent has its own governed Run. */
export function evaluateCompletionContexts(contexts: CompletionContext[]): StopDecision {
  const reasons: string[] = []
  for (const { intent, run, contract, staleEvidenceTypes } of contexts) {
    if (intent.status !== 'approved') continue
    const completion = canComplete(intent, run, contract, staleEvidenceTypes)
    if (!completion.ok) reasons.push(`${intent.id}: ${completion.reason}`)
  }
  return { block: reasons.length > 0, reasons }
}
