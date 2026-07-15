import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import { findDetection } from './detections.js'
import { listSpans } from './observability.js'
import { EvalCaseSchema, SpanSchema, type DetectionRecord, type EvalCase, type EvalRunStatus, type Span } from './schemas.js'

export class EvalStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid eval state ${file}: ${detail}`)
    this.name = 'EvalStateError'
  }
}

export interface CreateEvalCaseArgs {
  sourceDetectionId?: string | null
  trigger: EvalCase['trigger']
  title: string
  summary: string
  input?: Record<string, unknown>
  expected?: Record<string, unknown>
  evidenceRefs?: string[]
  tags?: string[]
}

function isEvalCaseFile(name: string): boolean {
  return /^EVAL-\d{3,}\.json$/.test(name)
}

function nextEvalId(root: string): string {
  return nextSequentialId('EVAL', loadEvalCases(root).map((evalCase) => evalCase.evalId))
}

function evalCaseFile(root: string, evalId: string): string {
  return paths(root).evalCaseFile(evalId)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : []
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

export function loadEvalCases(root: string): EvalCase[] {
  const dir = paths(root).evalsDir
  if (!existsSync(dir)) return []
  const out: EvalCase[] = []
  for (const file of readdirSync(dir)) {
    if (!isEvalCaseFile(file)) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, file))
    } catch (error) {
      throw new EvalStateError(file, (error as Error).message)
    }
    const parsed = EvalCaseSchema.safeParse(raw)
    if (!parsed.success) throw new EvalStateError(file, parsed.error.issues.map((issue) => issue.message).join('; '))
    out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.evalId, b.evalId))
}

export function findEvalCase(root: string, evalId: string): EvalCase | null {
  let raw: unknown
  try {
    raw = readJson(evalCaseFile(root, evalId))
  } catch (error) {
    throw new EvalStateError(`${evalId}.json`, (error as Error).message)
  }
  if (raw === null) return null
  const parsed = EvalCaseSchema.safeParse(raw)
  if (!parsed.success) throw new EvalStateError(`${evalId}.json`, parsed.error.issues.map((issue) => issue.message).join('; '))
  return parsed.data
}

export function createEvalCase(root: string, args: CreateEvalCaseArgs): EvalCase {
  for (;;) {
    const now = new Date().toISOString()
    const evalCase = EvalCaseSchema.parse({
      evalId: nextEvalId(root),
      sourceDetectionId: args.sourceDetectionId ?? null,
      trigger: args.trigger,
      title: args.title,
      summary: args.summary,
      input: args.input ?? {},
      expected: args.expected ?? {},
      evidenceRefs: args.evidenceRefs ?? [],
      tags: args.tags ?? [],
      createdAt: now,
      updatedAt: now,
    })
    if (writeJsonAtomicNew(evalCaseFile(root, evalCase.evalId), evalCase)) return evalCase
  }
}

export function updateEvalCase(root: string, evalId: string, fn: (evalCase: EvalCase) => EvalCase): EvalCase {
  const existing = findEvalCase(root, evalId)
  if (!existing) throw new Error(`no such eval: ${evalId}`)
  const now = new Date().toISOString()
  const updated = EvalCaseSchema.parse({
    ...fn(existing),
    updatedAt: now === existing.updatedAt ? new Date(Date.parse(now) + 1).toISOString() : now,
  })
  writeJsonAtomic(evalCaseFile(root, evalId), updated)
  return updated
}

function expectedForDetection(detection: DetectionRecord): Record<string, unknown> {
  if (detection.type === 'false_success') {
    return {
      shouldBlockCompletion: true,
      missingEvidenceTypes: stringArray(detection.attributes.missingEvidenceTypes),
    }
  }
  return {
    shouldDetectThrashing: true,
    count: numberOrNull(detection.attributes.count),
    command: typeof detection.attributes.command === 'string' ? detection.attributes.command : null,
    exitCode: numberOrNull(detection.attributes.exitCode),
    errorSignature: typeof detection.attributes.errorSignature === 'string' ? detection.attributes.errorSignature : null,
    path: typeof detection.attributes.path === 'string' ? detection.attributes.path : null,
    regionKey: typeof detection.attributes.regionKey === 'string' ? detection.attributes.regionKey : null,
    pattern: stringArray(detection.attributes.pattern),
    repetitions: numberOrNull(detection.attributes.repetitions),
  }
}

function detectionSpans(root: string, detection: DetectionRecord): Span[] {
  if (!detection.runId) return []
  const spanIds = new Set(detection.evidenceRefs
    .map((ref) => ref.match(/^span:[^:]+:(SPAN-\d{3,})$/)?.[1])
    .filter((spanId): spanId is string => !!spanId))
  if (spanIds.size === 0) return []
  return listSpans(root, detection.runId).filter((span) => spanIds.has(span.spanId))
}

export function draftEvalCaseFromDetection(root: string, detectionId: string): EvalCase {
  const detection = findDetection(root, detectionId)
  if (!detection) throw new Error(`no such detection: ${detectionId}`)

  return createEvalCase(root, {
    sourceDetectionId: detection.detectionId,
    trigger: detection.type,
    title: `Regression: ${detection.title}`,
    summary: detection.summary,
    input: {
      detectionId: detection.detectionId,
      result: detection.result,
      runId: detection.runId,
      intentId: detection.intentId,
      attributes: detection.attributes,
      detector: detection.title,
      spans: detectionSpans(root, detection),
    },
    expected: expectedForDetection(detection),
    evidenceRefs: [`detection:${detection.detectionId}`, ...detection.evidenceRefs],
    tags: ['detection', detection.type],
  })
}

export interface EvalRunnerResult {
  evalId: string
  status: EvalRunStatus
  reason: string
  evalCase: EvalCase
}

function stringSet(value: unknown): Set<string> {
  return new Set(stringArray(value))
}

function passesFalseSuccess(evalCase: EvalCase, detection: DetectionRecord): string | null {
  if (evalCase.expected.shouldBlockCompletion !== true) return 'expected.shouldBlockCompletion must be true'
  const expectedMissing = stringSet(evalCase.expected.missingEvidenceTypes)
  const actualMissing = stringSet(detection.attributes.missingEvidenceTypes)
  for (const type of expectedMissing) {
    if (!actualMissing.has(type)) return `missing expected evidence type was not detected: ${type}`
  }
  return null
}

function passesThrashing(evalCase: EvalCase, detection: DetectionRecord): string | null {
  if (evalCase.expected.shouldDetectThrashing !== true) return 'expected.shouldDetectThrashing must be true'
  if (typeof evalCase.expected.count === 'number' && detection.attributes.count !== evalCase.expected.count) {
    return `expected count ${evalCase.expected.count}, got ${String(detection.attributes.count)}`
  }
  if (typeof evalCase.expected.command === 'string' && detection.attributes.command !== evalCase.expected.command) {
    return `expected command ${evalCase.expected.command}, got ${String(detection.attributes.command)}`
  }
  if (
    typeof evalCase.expected.errorSignature === 'string' &&
    detection.attributes.errorSignature !== evalCase.expected.errorSignature
  ) {
    return `expected error signature ${evalCase.expected.errorSignature}, got ${String(detection.attributes.errorSignature)}`
  }
  return null
}

function replaySpans(evalCase: EvalCase): Span[] {
  if (!Array.isArray(evalCase.input.spans)) return []
  return evalCase.input.spans
    .map((span) => SpanSchema.safeParse(span))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
}

function matchingCount(spans: Span[], predicate: (span: Span) => boolean): number {
  return spans.filter(predicate).length
}

function expectedCount(evalCase: EvalCase): number {
  return typeof evalCase.expected.count === 'number' ? evalCase.expected.count : 3
}

function replayThrashingEval(evalCase: EvalCase, spans: Span[]): string | null {
  const detector = evalCase.input.detector
  const required = expectedCount(evalCase)
  if (detector === 'Repeated command failure') {
    const count = matchingCount(spans, (span) => (
      span.status === 'error' &&
      (span.kind === 'run_check' || span.kind === 'run_command') &&
      span.attributes.command === evalCase.expected.command &&
      span.attributes.exitCode === evalCase.expected.exitCode
    ))
    return count >= required ? null : `replayed span fixture did not reproduce repeated command failure (${count}/${required})`
  }
  if (detector === 'Repeated error signature') {
    const count = matchingCount(spans, (span) => (
      span.status === 'error' && span.attributes.errorSignature === evalCase.expected.errorSignature
    ))
    return count >= required ? null : `replayed span fixture did not reproduce repeated error signature (${count}/${required})`
  }
  if (detector === 'Repeated file edits') {
    const count = matchingCount(spans, (span) => (
      (span.kind === 'edit' || span.kind === 'apply_patch') && span.attributes.path === evalCase.expected.path
    ))
    return count >= required ? null : `replayed span fixture did not reproduce repeated file edits (${count}/${required})`
  }
  if (detector === 'Repeated edit region') {
    const count = matchingCount(spans, (span) => span.attributes.regionKey === evalCase.expected.regionKey)
    return count >= required ? null : `replayed span fixture did not reproduce repeated edit region (${count}/${required})`
  }
  if (detector === 'Repeated tool sequence') {
    const pattern = stringArray(evalCase.expected.pattern)
    const repetitions = typeof evalCase.expected.repetitions === 'number' ? evalCase.expected.repetitions : 3
    const steps = spans.map((span) => `${span.kind}:${span.status}`)
    const expectedSteps = Array.from({ length: repetitions }, () => pattern).flat()
    const reproduced = expectedSteps.length > 0 && expectedSteps.every((step, index) => steps[index] === step)
    return reproduced ? null : 'replayed span fixture did not reproduce repeated tool sequence'
  }
  return `no replay adapter for detector: ${String(detector)}`
}

function evaluateEvalCase(evalCase: EvalCase, detection: DetectionRecord | null): { status: EvalRunStatus; reason: string } {
  const spans = replaySpans(evalCase)
  if (evalCase.trigger === 'thrashing' && spans.length > 0) {
    const failure = replayThrashingEval(evalCase, spans)
    return failure
      ? { status: 'failed', reason: failure }
      : { status: 'passed', reason: 'replayed span fixture reproduced expected regression signal' }
  }
  if (!detection) return { status: 'failed', reason: `source detection missing: ${evalCase.sourceDetectionId ?? 'none'}` }
  if (detection.type !== evalCase.trigger) {
    return { status: 'failed', reason: `trigger mismatch: expected ${evalCase.trigger}, got ${detection.type}` }
  }
  const failure = detection.type === 'false_success'
    ? passesFalseSuccess(evalCase, detection)
    : passesThrashing(evalCase, detection)
  return failure ? { status: 'failed', reason: failure } : { status: 'passed', reason: 'source detection matches expected regression signal' }
}

export function runEvalCase(root: string, evalId: string): EvalRunnerResult {
  const evalCase = findEvalCase(root, evalId)
  if (!evalCase) throw new Error(`no such eval: ${evalId}`)
  const detection = evalCase.sourceDetectionId ? findDetection(root, evalCase.sourceDetectionId) : null
  const result = evaluateEvalCase(evalCase, detection)
  const runAt = new Date().toISOString()
  const updated = updateEvalCase(root, evalId, (current) => ({
    ...current,
    lastRun: { ...result, runAt },
  }))
  return { evalId, status: result.status, reason: result.reason, evalCase: updated }
}

export function runEvalCases(root: string, evalId?: string): EvalRunnerResult[] {
  if (evalId) return [runEvalCase(root, evalId)]
  return loadEvalCases(root).map((evalCase) => runEvalCase(root, evalCase.evalId))
}
