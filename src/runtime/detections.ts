import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import { composeDetectionWikiBody, detectionWikiSlug } from './postmortem.js'
import {
  DetectionRecordSchema,
  type DetectionRecord,
  type DetectionResult,
  type DetectionType,
  type JudgeStatus,
  type JudgeClassification,
} from './schemas.js'
import { appendArticle, listArticles, newArticle, type Status, type WikiType } from './wiki.js'

export class DetectionStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid detection state ${file}: ${detail}`)
    this.name = 'DetectionStateError'
  }
}

export interface CreateDetectionArgs {
  type: DetectionType
  result?: DetectionResult
  runId?: string | null
  intentId?: string | null
  title: string
  summary: string
  evidenceRefs?: string[]
  attributes?: Record<string, unknown>
  resolution?: string | null
  resolvedAt?: string | null
}

function isDetectionFile(name: string): boolean {
  return /^DET-\d{3,}\.json$/.test(name)
}

function detectionFile(root: string, detectionId: string): string {
  return paths(root).detectionFile(detectionId)
}

function nextDetectionId(root: string): string {
  return nextSequentialId('DET', loadDetections(root).map((detection) => detection.detectionId))
}

function refreshedTimestamp(previous: string): string {
  const now = new Date().toISOString()
  if (now !== previous) return now
  return new Date(Date.parse(now) + 1).toISOString()
}

export function loadDetections(root: string): DetectionRecord[] {
  const dir = paths(root).detectionsDir
  if (!existsSync(dir)) return []
  const out: DetectionRecord[] = []
  for (const file of readdirSync(dir)) {
    if (!isDetectionFile(file)) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, file))
    } catch (error) {
      throw new DetectionStateError(file, (error as Error).message)
    }
    const parsed = DetectionRecordSchema.safeParse(raw)
    if (!parsed.success) {
      throw new DetectionStateError(file, parsed.error.issues.map((issue) => issue.message).join('; '))
    }
    out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.detectionId, b.detectionId))
}

export function findDetection(root: string, detectionId: string): DetectionRecord | null {
  let raw: unknown
  try {
    raw = readJson(detectionFile(root, detectionId))
  } catch (error) {
    throw new DetectionStateError(`${detectionId}.json`, (error as Error).message)
  }
  if (raw === null) return null
  const parsed = DetectionRecordSchema.safeParse(raw)
  if (!parsed.success) {
    throw new DetectionStateError(`${detectionId}.json`, parsed.error.issues.map((issue) => issue.message).join('; '))
  }
  return parsed.data
}

export function createDetection(root: string, args: CreateDetectionArgs): DetectionRecord {
  for (;;) {
    const now = new Date().toISOString()
    const detection = DetectionRecordSchema.parse({
      detectionId: nextDetectionId(root),
      type: args.type,
      result: args.result ?? 'candidate',
      runId: args.runId ?? null,
      intentId: args.intentId ?? null,
      title: args.title,
      summary: args.summary,
      evidenceRefs: args.evidenceRefs ?? [],
      attributes: args.attributes ?? {},
      resolution: args.resolution ?? null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: args.resolvedAt ?? null,
    })
    if (writeJsonAtomicNew(paths(root).detectionFile(detection.detectionId), detection)) return detection
  }
}

export function updateDetection(
  root: string,
  detectionId: string,
  fn: (detection: DetectionRecord) => DetectionRecord,
): DetectionRecord {
  const existing = findDetection(root, detectionId)
  if (!existing) throw new Error(`no such detection: ${detectionId}`)
  const updated = DetectionRecordSchema.parse({
    ...fn(existing),
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(detectionFile(root, detectionId), updated)
  return updated
}

export function resolveDetection(
  root: string,
  detectionId: string,
  result: 'confirmed' | 'dismissed',
  resolution: string,
): DetectionRecord {
  const resolvedAt = new Date().toISOString()
  return updateDetection(root, detectionId, (detection) => ({
    ...detection,
    result,
    resolution,
    resolvedAt,
  }))
}

export function recordJudgeResult(
  root: string,
  detectionId: string,
  args: {
    status: Exclude<JudgeStatus, 'not_run'>
    judgement: string
    confidence?: number | null
    classification?: JudgeClassification | null
    suggestedAction?: string | null
    inputDigest?: string | null
    adapterKey?: string | null
  },
): DetectionRecord {
  if (args.confidence !== undefined && args.confidence !== null && (args.confidence < 0 || args.confidence > 1)) {
    throw new Error('judge confidence must be between 0 and 1')
  }
  return updateDetection(root, detectionId, (detection) => ({
    ...detection,
    judge: {
      status: args.status,
      judgement: args.judgement,
      confidence: args.confidence ?? null,
      classification: args.classification ?? null,
      suggestedAction: args.suggestedAction ?? null,
      inputDigest: args.inputDigest ?? null,
      adapterKey: args.adapterKey ?? null,
      updatedAt: new Date().toISOString(),
    },
  }))
}

function wikiClassification(detection: DetectionRecord): { type: WikiType; status: Status } {
  if (detection.result === 'confirmed') return { type: 'failure', status: 'resolved' }
  if (detection.result === 'dismissed') return { type: 'issue', status: 'resolved' }
  return { type: 'issue', status: 'open' }
}

export function recordDetectionWikiPage(root: string, detectionId: string): { slug: string; file: string } {
  const detection = findDetection(root, detectionId)
  if (!detection) throw new Error(`no such detection: ${detectionId}`)

  const slug = detectionWikiSlug(detection)
  const { type, status } = wikiClassification(detection)
  const exists = listArticles(root).some((article) => article.slug === slug)
  if (!exists) {
    newArticle(root, slug, `Detection: ${detection.title}`, {
      type,
      status,
      summary: detection.summary,
      tags: ['detection', detection.type],
    })
  }
  const file = appendArticle(root, slug, composeDetectionWikiBody(detection))
  return { slug, file }
}

export function unIngestedDetections(root: string): DetectionRecord[] {
  const articleSlugs = new Set(listArticles(root).map((article) => article.slug))
  return loadDetections(root).filter((detection) => !articleSlugs.has(detectionWikiSlug(detection)))
}
