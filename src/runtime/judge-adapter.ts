import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { recordJudgeResult } from './detections.js'
import { buildJudgeInputBundle, judgeInputDigest, type JudgeInputBundle } from './judge.js'
import { JudgeClassificationSchema, JudgeStatusSchema, type DetectionRecord } from './schemas.js'

export interface ExternalJudgeOutput {
  status: 'pass' | 'fail' | 'uncertain'
  classification?: 'thrashing' | 'false_success' | 'none' | null
  judgement: string
  confidence?: number | null
  suggestedAction?: string | null
}

export interface RunJudgeAdapterResult {
  detection: DetectionRecord
  bundle: JudgeInputBundle
  stdout: string
  stderr: string
  cached: boolean
}

function parseJudgeOutput(stdout: string): ExternalJudgeOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('judge adapter stdout must be JSON')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('judge adapter stdout must be an object')
  const record = parsed as Record<string, unknown>
  const classification = JudgeClassificationSchema.safeParse(record.classification ?? record.result)
  const status = JudgeStatusSchema.safeParse(record.status)
  if ((!status.success || status.data === 'not_run') && !classification.success) {
    throw new Error('judge adapter needs status pass/fail/uncertain or classification thrashing/false_success/none')
  }
  if (typeof record.judgement !== 'string' || record.judgement.trim().length === 0) {
    throw new Error('judge adapter judgement must be a non-empty string')
  }
  const confidence = record.confidence === undefined || record.confidence === null ? null : Number(record.confidence)
  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    throw new Error('judge adapter confidence must be between 0 and 1')
  }
  if (record.suggestedAction !== undefined && record.suggestedAction !== null && typeof record.suggestedAction !== 'string') {
    throw new Error('judge adapter suggestedAction must be a string')
  }
  const resolvedClassification = classification.success ? classification.data : null
  const resolvedStatus = status.success && status.data !== 'not_run'
    ? status.data
    : resolvedClassification === 'none' ? 'pass' : 'fail'
  return {
    status: resolvedStatus,
    classification: resolvedClassification,
    judgement: record.judgement,
    confidence,
    suggestedAction: typeof record.suggestedAction === 'string' ? record.suggestedAction : null,
  }
}

export function runJudgeAdapter(
  root: string,
  detectionId: string,
  command: string,
  args: string[],
): RunJudgeAdapterResult {
  const bundle = buildJudgeInputBundle(root, detectionId)
  const inputDigest = judgeInputDigest(bundle)
  const adapterKey = createAdapterKey(command, args)
  if (
    bundle.detection.judge.status !== 'not_run' &&
    bundle.detection.judge.inputDigest === inputDigest &&
    bundle.detection.judge.adapterKey === adapterKey
  ) {
    return { detection: bundle.detection, bundle, stdout: '', stderr: '', cached: true }
  }
  const child = spawnSync(command, args, {
    cwd: root,
    input: JSON.stringify(bundle, null, 2),
    encoding: 'utf8',
  })
  if (child.error) throw child.error
  if (child.status !== 0) {
    throw new Error(`judge adapter failed exit=${child.status ?? 'null'}: ${child.stderr}`)
  }
  const output = parseJudgeOutput(child.stdout.trim())
  const detection = recordJudgeResult(root, detectionId, { ...output, inputDigest, adapterKey })
  return {
    detection,
    bundle,
    stdout: child.stdout,
    stderr: child.stderr,
    cached: false,
  }
}

function createAdapterKey(command: string, args: string[]): string {
  return createHash('sha256').update([command, ...args].join('\u0000')).digest('hex')
}
