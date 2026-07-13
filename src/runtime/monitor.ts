import { createDetection, loadDetections, type CreateDetectionArgs } from './detections.js'
import { listSpans } from './observability.js'
import { blockRun } from './runs.js'
import { missingRequiredEvidenceTypes } from './stop-gate.js'
import type { DetectionRecord, Intent, RunState, Span, SprintContract } from './schemas.js'

function runMatchesIntent(intent: Intent, run?: RunState | null): run is RunState {
  return !!run && (!run.intentId || run.intentId === intent.id)
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function createDetectionOnce(root: string, args: CreateDetectionArgs): DetectionRecord {
  const existing = loadDetections(root).find((detection) => (
    detection.type === args.type &&
    detection.runId === (args.runId ?? null) &&
    detection.intentId === (args.intentId ?? null) &&
    detection.title === args.title &&
    sameJson(detection.evidenceRefs, args.evidenceRefs ?? []) &&
    sameJson(detection.attributes, args.attributes ?? {})
  ))
  return existing ?? createDetection(root, args)
}

export function detectFalseSuccessOnCompletionAttempt(
  root: string,
  intent: Intent,
  run?: RunState | null,
  contract?: SprintContract | null,
): DetectionRecord | null {
  if (!runMatchesIntent(intent, run)) return null

  const relevantContract = contract && contract.runId === run.runId && contract.intentId === intent.id ? contract : null
  const missing = missingRequiredEvidenceTypes(run, relevantContract)
  if (missing.length === 0) return null

  return createDetectionOnce(root, {
    type: 'false_success',
    runId: run.runId,
    intentId: intent.id,
    title: 'Completion attempted without required evidence',
    summary: `Completion for ${intent.id} was attempted while required evidence was missing: ${missing.join(', ')}.`,
    evidenceRefs: [`intent:${intent.id}`, `run:${run.runId}`],
    attributes: {
      missingEvidenceTypes: missing,
      runId: run.runId,
      intentId: intent.id,
    },
  })
}

export function detectCompletionAttemptIssues(
  root: string,
  intents: Intent[],
  run?: RunState | null,
  contract?: SprintContract | null,
): DetectionRecord[] {
  if (!run) return []
  return intents
    .filter((intent) => intent.status === 'approved')
    .map((intent) => detectFalseSuccessOnCompletionAttempt(root, intent, run, contract))
    .filter((detection): detection is DetectionRecord => detection !== null)
}

interface CommandFailureKey {
  key: string
  command: string
  args: string[]
  exitCode: number
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : []
}

function commandFailureKey(span: Span): CommandFailureKey | null {
  if ((span.kind !== 'run_check' && span.kind !== 'run_command') || span.status !== 'error') return null
  const command = span.attributes.command
  const exitCode = span.attributes.exitCode
  if (typeof command !== 'string' || typeof exitCode !== 'number') return null
  const args = stringArray(span.attributes.args)
  return {
    key: JSON.stringify({ command, args, exitCode }),
    command,
    args,
    exitCode,
  }
}

export function detectRepeatedCommandFailures(root: string, runId: string, threshold = 3): DetectionRecord[] {
  const groups = new Map<string, { key: CommandFailureKey; spans: Span[] }>()
  for (const span of listSpans(root, runId)) {
    const key = commandFailureKey(span)
    if (!key) continue
    const existing = groups.get(key.key)
    groups.set(key.key, existing ? { ...existing, spans: [...existing.spans, span] } : { key, spans: [span] })
  }

  const detections: DetectionRecord[] = []
  for (const group of groups.values()) {
    if (group.spans.length < threshold) continue
    const spanIds = group.spans.map((span) => span.spanId)
    detections.push(
      createDetectionOnce(root, {
        type: 'thrashing',
        runId,
        title: 'Repeated command failure',
        summary: `${[group.key.command, ...group.key.args].join(' ')} failed with exit code ${
          group.key.exitCode
        } ${group.spans.length} times.`,
        evidenceRefs: spanIds.map((spanId) => `span:${runId}:${spanId}`),
        attributes: {
          command: group.key.command,
          args: group.key.args,
          exitCode: group.key.exitCode,
          count: group.spans.length,
          spanIds,
        },
      }),
    )
  }
  return detections
}

function errorSignature(span: Span): string | null {
  if ((span.kind !== 'run_check' && span.kind !== 'run_command') || span.status !== 'error') return null
  const signature = span.attributes.errorSignature
  return typeof signature === 'string' && signature.trim().length > 0 ? signature.trim() : null
}

export function detectRepeatedErrorSignatures(root: string, runId: string, threshold = 3): DetectionRecord[] {
  const groups = new Map<string, Span[]>()
  for (const span of listSpans(root, runId)) {
    const signature = errorSignature(span)
    if (!signature) continue
    const existing = groups.get(signature) ?? []
    groups.set(signature, [...existing, span])
  }

  const detections: DetectionRecord[] = []
  for (const [signature, spans] of groups.entries()) {
    if (spans.length < threshold) continue
    const spanIds = spans.map((span) => span.spanId)
    const commands = spans
      .map((span) => span.attributes.command)
      .filter((command): command is string => typeof command === 'string')
    detections.push(
      createDetectionOnce(root, {
        type: 'thrashing',
        runId,
        title: 'Repeated error signature',
        summary: `The same error signature repeated ${spans.length} times: ${signature}.`,
        evidenceRefs: spanIds.map((spanId) => `span:${runId}:${spanId}`),
        attributes: {
          errorSignature: signature,
          count: spans.length,
          spanIds,
          commands,
        },
      }),
    )
  }
  return detections
}

function editPath(span: Span): string | null {
  if (span.kind !== 'edit' && span.kind !== 'apply_patch') return null
  const path = span.attributes.path
  return typeof path === 'string' && path.trim().length > 0 ? path.trim() : null
}

export function detectRepeatedFileEdits(root: string, runId: string, threshold = 4): DetectionRecord[] {
  const groups = new Map<string, Span[]>()
  for (const span of listSpans(root, runId)) {
    const path = editPath(span)
    if (!path) continue
    const existing = groups.get(path) ?? []
    groups.set(path, [...existing, span])
  }

  const detections: DetectionRecord[] = []
  for (const [path, spans] of groups.entries()) {
    if (spans.length < threshold) continue
    const spanIds = spans.map((span) => span.spanId)
    detections.push(
      createDetectionOnce(root, {
        type: 'thrashing',
        runId,
        title: 'Repeated file edits',
        summary: `${path} was edited ${spans.length} times in the same run.`,
        evidenceRefs: spanIds.map((spanId) => `span:${runId}:${spanId}`),
        attributes: {
          path,
          count: spans.length,
          spanIds,
        },
      }),
    )
  }
  return detections
}

function editRegionKey(span: Span): string | null {
  if (span.kind !== 'edit' && span.kind !== 'apply_patch') return null
  const regionKey = span.attributes.regionKey
  return typeof regionKey === 'string' && regionKey.length > 0 ? regionKey : null
}

export function detectRepeatedEditRegions(root: string, runId: string, threshold = 3): DetectionRecord[] {
  const groups = new Map<string, Span[]>()
  for (const span of listSpans(root, runId)) {
    const regionKey = editRegionKey(span)
    if (!regionKey) continue
    groups.set(regionKey, [...(groups.get(regionKey) ?? []), span])
  }

  const detections: DetectionRecord[] = []
  for (const [regionKey, spans] of groups.entries()) {
    if (spans.length < threshold) continue
    const spanIds = spans.map((span) => span.spanId)
    detections.push(createDetectionOnce(root, {
      type: 'thrashing',
      runId,
      title: 'Repeated edit region',
      summary: `${regionKey} was edited ${spans.length} times in the same run and needs semantic review.`,
      evidenceRefs: spanIds.map((spanId) => `span:${runId}:${spanId}`),
      attributes: { regionKey, count: spans.length, spanIds },
    }))
  }
  return detections
}

function toolSequenceStep(span: Span): string | null {
  if (!['edit', 'apply_patch', 'run_check', 'run_command'].includes(span.kind)) return null
  return `${span.kind}:${span.status}`
}

export function detectRepeatedToolSequence(
  root: string,
  runId: string,
  repetitions = 3,
  patternLength = 2,
): DetectionRecord[] {
  const spans = listSpans(root, runId).filter((span) => toolSequenceStep(span) !== null)
  const requiredLength = repetitions * patternLength
  if (spans.length < requiredLength) return []

  for (let start = 0; start <= spans.length - requiredLength; start++) {
    const window = spans.slice(start, start + requiredLength)
    const pattern = window.slice(0, patternLength).map((span) => toolSequenceStep(span) as string)
    if (new Set(pattern).size < 2 || !pattern.some((step) => step.endsWith(':error'))) continue
    const repeats = window.every((span, index) => toolSequenceStep(span) === pattern[index % patternLength])
    if (!repeats) continue
    const spanIds = window.map((span) => span.spanId)
    return [createDetectionOnce(root, {
      type: 'thrashing',
      runId,
      title: 'Repeated tool sequence',
      summary: `${pattern.join(' -> ')} repeated ${repetitions} times and needs semantic review.`,
      evidenceRefs: spanIds.map((spanId) => `span:${runId}:${spanId}`),
      attributes: { pattern, repetitions, spanIds },
    })]
  }
  return []
}

export function detectRunMonitorIssues(root: string, runId: string): DetectionRecord[] {
  const detections = [
    ...detectRepeatedCommandFailures(root, runId),
    ...detectRepeatedErrorSignatures(root, runId),
    ...detectRepeatedEditRegions(root, runId),
    ...detectRepeatedToolSequence(root, runId),
  ]
  return uniqueDetections(detections)
}

export function uniqueDetections(detections: DetectionRecord[]): DetectionRecord[] {
  return detections.filter((detection, index) =>
    detections.findIndex((candidate) => candidate.detectionId === detection.detectionId) === index
  )
}

export function blockRunForDetections(root: string, runId: string, detections: DetectionRecord[]): RunState | null {
  const unique = uniqueDetections(detections).filter((detection) => (
    detection.result === 'confirmed' || detection.type === 'false_success'
  ))
  if (unique.length === 0) return null
  const ids = unique.map((detection) => detection.detectionId).join(', ')
  return blockRun(
    root,
    runId,
    `monitor blocked run after detection(s): ${ids}`,
    `Investigate detection(s) ${ids} before continuing.`,
  )
}
