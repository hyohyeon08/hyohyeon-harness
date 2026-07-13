import { createHash } from 'node:crypto'
import { findDetection, loadDetections } from './detections.js'
import { listSpans } from './observability.js'
import { findRun } from './runs.js'
import type { DetectionRecord, RunState, Span, VerificationEvidence } from './schemas.js'
import { cosineSimilarity } from './similarity.js'

export interface JudgeRunSummary {
  runId: string
  intentId: string | null
  objective: string
  phase: RunState['phase']
  status: RunState['status']
  requiredEvidenceTypes: RunState['requiredEvidenceTypes']
}

export interface JudgeEvidenceSummary {
  evidenceId: string
  type: VerificationEvidence['type']
  status: VerificationEvidence['status']
  command: string
  args: string[]
  exitCode: number | null
  logPath: string
}

export interface JudgeSpanSummary {
  spanId: string
  traceId: string
  kind: Span['kind']
  name: string
  status: Span['status']
  attributes: Record<string, unknown>
}

export interface JudgeInputBundle {
  detection: DetectionRecord
  run: JudgeRunSummary | null
  evidence: JudgeEvidenceSummary[]
  relatedLogPaths: string[]
  trace: {
    runId: string | null
    traceId: string | null
    spanIds: string[]
    spans: JudgeSpanSummary[]
  }
  evidenceRefs: string[]
  semantic: {
    modelKey: string | null
    maxSimilarity: number | null
    similarDetectionIds: string[]
  }
}

function addUnique(out: string[], value: string): string[] {
  return out.includes(value) ? out : [...out, value]
}

function stringAttribute(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function referencedRunId(detection: DetectionRecord): string | null {
  if (detection.runId) return detection.runId
  for (const ref of detection.evidenceRefs) {
    const runRef = ref.match(/^run:(RUN-\d{3,})$/)
    if (runRef) return runRef[1]
    const spanRef = ref.match(/^span:(RUN-\d{3,}):SPAN-\d{3,}$/)
    if (spanRef) return spanRef[1]
  }
  return null
}

function referencedEvidenceIds(refs: string[]): Set<string> {
  const ids = new Set<string>()
  for (const ref of refs) {
    const plain = ref.match(/^(VE-\d{3,})$/)
    const tagged = ref.match(/^evidence:(VE-\d{3,})$/)
    if (plain) ids.add(plain[1])
    if (tagged) ids.add(tagged[1])
  }
  return ids
}

function referencedSpanIds(refs: string[], runId: string): Set<string> {
  const ids = new Set<string>()
  for (const ref of refs) {
    const tagged = ref.match(/^span:(RUN-\d{3,}):(SPAN-\d{3,})$/)
    const traceFile = ref.match(/^TRACE-RUN-\d{3,}-(SPAN-\d{3,})$/)
    if (tagged && tagged[1] === runId) ids.add(tagged[2])
    if (traceFile) ids.add(traceFile[1])
  }
  return ids
}

function summarizeRun(run: RunState): JudgeRunSummary {
  return {
    runId: run.runId,
    intentId: run.intentId,
    objective: run.objective,
    phase: run.phase,
    status: run.status,
    requiredEvidenceTypes: run.requiredEvidenceTypes,
  }
}

function summarizeEvidence(evidence: VerificationEvidence): JudgeEvidenceSummary {
  return {
    evidenceId: evidence.evidenceId,
    type: evidence.type,
    status: evidence.status,
    command: evidence.command,
    args: evidence.args,
    exitCode: evidence.exitCode,
    logPath: evidence.logPath,
  }
}

function summarizeSpan(span: Span): JudgeSpanSummary {
  return {
    spanId: span.spanId,
    traceId: span.traceId,
    kind: span.kind,
    name: span.name,
    status: span.status,
    attributes: span.attributes,
  }
}

function selectEvidence(run: RunState, refs: string[]): VerificationEvidence[] {
  const ids = referencedEvidenceIds(refs)
  return ids.size > 0 ? run.evidence.filter((item) => ids.has(item.evidenceId)) : run.evidence
}

function selectSpans(root: string, runId: string, refs: string[]): Span[] {
  const spans = listSpans(root, runId)
  const ids = referencedSpanIds(refs, runId)
  return ids.size > 0 ? spans.filter((span) => ids.has(span.spanId)) : spans
}

function relatedLogPaths(refs: string[], evidence: VerificationEvidence[], spans: Span[]): string[] {
  let out: string[] = []
  for (const ref of refs) {
    if (ref.startsWith('.intent/raw/')) out = addUnique(out, ref)
  }
  for (const item of evidence) {
    out = addUnique(out, item.logPath)
  }
  for (const span of spans) {
    const logPath = stringAttribute(span.attributes.logPath)
    if (logPath) out = addUnique(out, logPath)
  }
  return out
}

export function buildJudgeInputBundle(root: string, detectionId: string): JudgeInputBundle {
  const detection = findDetection(root, detectionId)
  if (!detection) throw new Error(`no such detection: ${detectionId}`)

  const runId = referencedRunId(detection)
  const run = runId ? findRun(root, runId) : null
  const evidence = run ? selectEvidence(run, detection.evidenceRefs) : []
  const spans = run ? selectSpans(root, run.runId, detection.evidenceRefs) : []
  const spanSummaries = spans.map(summarizeSpan)
  const semanticPeers = detection.embedding
    ? loadDetections(root)
      .filter((candidate) => candidate.detectionId !== detection.detectionId)
      .filter((candidate) => candidate.embedding?.modelKey === detection.embedding!.modelKey)
      .filter((candidate) => candidate.embedding?.vector.length === detection.embedding!.vector.length)
      .map((candidate) => ({
        detectionId: candidate.detectionId,
        similarity: cosineSimilarity(detection.embedding!.vector, candidate.embedding!.vector),
      }))
      .sort((left, right) => right.similarity - left.similarity)
    : []

  return {
    detection,
    run: run ? summarizeRun(run) : null,
    evidence: evidence.map(summarizeEvidence),
    relatedLogPaths: relatedLogPaths(detection.evidenceRefs, evidence, spans),
    trace: {
      runId: run?.runId ?? null,
      traceId: spanSummaries[0]?.traceId ?? (run ? `TRACE-${run.runId}` : null),
      spanIds: spanSummaries.map((span) => span.spanId),
      spans: spanSummaries,
    },
    evidenceRefs: detection.evidenceRefs,
    semantic: {
      modelKey: detection.embedding?.modelKey ?? null,
      maxSimilarity: semanticPeers[0]?.similarity ?? null,
      similarDetectionIds: semanticPeers.slice(0, 5).map((peer) => peer.detectionId),
    },
  }
}

export function judgeInputDigest(bundle: JudgeInputBundle): string {
  const { judge: _judge, updatedAt: _updatedAt, resolution: _resolution, resolvedAt: _resolvedAt, ...detection } = bundle.detection
  return createHash('sha256').update(JSON.stringify({ ...bundle, detection })).digest('hex')
}
