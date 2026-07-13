import { ContractStateError, findContract } from './contracts.js'
import {
  blockRunForDetections,
  detectFalseSuccessOnCompletionAttempt,
  detectRunMonitorIssues,
  uniqueDetections,
} from './monitor.js'
import { latestRunForIntent } from './runs.js'
import { listSpans } from './observability.js'
import {
  evaluateCompletionContexts,
  latestEvidenceForType,
  requiredEvidenceTypesForCompletion,
  type CompletionContext,
} from './stop-gate.js'
import type { DetectionRecord, Intent, RunState, Span, SprintContract, VerificationEvidenceType } from './schemas.js'
import { createRunContentFingerprint } from './provenance.js'

function timestamp(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Required pass evidence must be newer than the latest successful edit observation. */
export function staleRequiredEvidenceTypes(
  run: RunState,
  contract: SprintContract | null,
  spans: Span[],
  currentDigest?: string,
): VerificationEvidenceType[] {
  const mutationTimes = spans
    .filter((span) => (span.kind === 'edit' || span.kind === 'apply_patch') && span.status === 'ok')
    .map((span) => timestamp(span.endedAt) ?? timestamp(span.startedAt))
    .filter((value): value is number => value !== null)
  const latestMutation = mutationTimes.length > 0 ? Math.max(...mutationTimes) : null
  return requiredEvidenceTypesForCompletion(run, contract).filter((type) => {
    const evidence = latestEvidenceForType(run, type)
    const finishedAt = evidence ? timestamp(evidence.finishedAt) : null
    if (evidence?.status !== 'passed') return false
    const staleByTime = latestMutation !== null && (finishedAt === null || finishedAt < latestMutation)
    const staleByDigest = !!currentDigest && evidence.provenance?.digest !== currentDigest
    return staleByTime || staleByDigest
  })
}

function contractForContext(root: string, context: CompletionContext) {
  const run = context.run
  if (!run?.contractId) return null
  const contract = findContract(root, run.contractId)
  if (!contract) throw new ContractStateError(run.contractId, `referenced by ${run.runId} but file is missing`)
  if (contract.status !== 'approved' || contract.runId !== run.runId || contract.intentId !== context.intent.id) return null
  return contract
}

export function loadCompletionContexts(root: string, intents: Intent[]): CompletionContext[] {
  return intents.map((intent) => {
    const context: CompletionContext = {
      intent,
      run: latestRunForIntent(root, intent.id),
      contract: null,
      staleEvidenceTypes: [],
    }
    const contract = contractForContext(root, context)
    const currentDigest = context.run ? createRunContentFingerprint(root, context.run).digest : undefined
    const staleEvidenceTypes = context.run
      ? staleRequiredEvidenceTypes(context.run, contract, listSpans(root, context.run.runId), currentDigest)
      : []
    return { ...context, contract, staleEvidenceTypes }
  })
}

function uniqueRuns(contexts: CompletionContext[]): RunState[] {
  const runs = contexts
    .map((context) => context.run)
    .filter((run): run is RunState => run !== null && run !== undefined)
  return runs.filter((run, index) => runs.findIndex((candidate) => candidate.runId === run.runId) === index)
}

export interface CompletionAttemptResult {
  contexts: CompletionContext[]
  detections: DetectionRecord[]
  reasons: string[]
  block: boolean
}

/**
 * Shared CLI/Stop orchestration: resolve status-independent completion
 * contexts, create structural detections, block affected Runs, then apply the
 * same pure completion reducer.
 */
export function evaluateCompletionAttempt(root: string, intents: Intent[]): CompletionAttemptResult {
  const contexts = loadCompletionContexts(root, intents)
  const completionDetections = contexts
    .filter((context) => context.intent.status === 'approved')
    .map((context) => detectFalseSuccessOnCompletionAttempt(root, context.intent, context.run, context.contract))
    .filter((detection): detection is DetectionRecord => detection !== null)
  const runs = uniqueRuns(contexts)
  const monitorDetections = runs.flatMap((run) => detectRunMonitorIssues(root, run.runId))
  const detections = uniqueDetections([...completionDetections, ...monitorDetections])

  for (const run of runs) {
    blockRunForDetections(
      root,
      run.runId,
      detections.filter((detection) => detection.runId === run.runId),
    )
  }

  const decision = evaluateCompletionContexts(contexts)
  const monitorReasons = monitorDetections.filter((detection) => detection.result === 'confirmed').map((detection) => (
    `${detection.runId ?? 'run'}: monitor detection: ${detection.detectionId}`
  ))
  const reasons = [...decision.reasons, ...monitorReasons]
  return { contexts, detections, reasons, block: reasons.length > 0 }
}
