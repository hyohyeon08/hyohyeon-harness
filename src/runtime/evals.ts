import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { findDetection } from './detections.js'
import { EvalCaseSchema, type DetectionRecord, type EvalCase } from './schemas.js'

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
  return /^EVAL-\d{3}\.json$/.test(name)
}

function nextEvalId(root: string): string {
  return `EVAL-${String(loadEvalCases(root).length + 1).padStart(3, '0')}`
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
    const parsed = EvalCaseSchema.safeParse(readJson(join(dir, file)))
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => a.evalId.localeCompare(b.evalId))
}

export function findEvalCase(root: string, evalId: string): EvalCase | null {
  const parsed = EvalCaseSchema.safeParse(readJson(evalCaseFile(root, evalId)))
  return parsed.success ? parsed.data : null
}

export function createEvalCase(root: string, args: CreateEvalCaseArgs): EvalCase {
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
  writeJsonAtomic(evalCaseFile(root, evalCase.evalId), evalCase)
  return evalCase
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
    errorSignature: typeof detection.attributes.errorSignature === 'string' ? detection.attributes.errorSignature : null,
  }
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
    },
    expected: expectedForDetection(detection),
    evidenceRefs: [`detection:${detection.detectionId}`, ...detection.evidenceRefs],
    tags: ['detection', detection.type],
  })
}
