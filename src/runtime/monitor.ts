import { createDetection } from './detections.js'
import { listSpans } from './observability.js'
import { missingRequiredEvidenceTypes } from './stop-gate.js'
import type { DetectionRecord, Intent, RunState, Span } from './schemas.js'

function runMatchesIntent(intent: Intent, run?: RunState | null): run is RunState {
  return !!run && (!run.intentId || run.intentId === intent.id)
}

export function detectFalseSuccessOnCompletionAttempt(
  root: string,
  intent: Intent,
  run?: RunState | null,
): DetectionRecord | null {
  if (!runMatchesIntent(intent, run)) return null

  const missing = missingRequiredEvidenceTypes(run)
  if (missing.length === 0) return null

  return createDetection(root, {
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
  if (span.kind !== 'run_check' || span.status !== 'error') return null
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
      createDetection(root, {
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
  if (span.kind !== 'run_check' || span.status !== 'error') return null
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
      createDetection(root, {
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
