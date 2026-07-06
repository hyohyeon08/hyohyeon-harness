import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { composeDetectionWikiBody, detectionWikiSlug } from './postmortem.js'
import {
  DetectionRecordSchema,
  type DetectionRecord,
  type DetectionResult,
  type DetectionType,
} from './schemas.js'
import { appendArticle, listArticles, newArticle, type Status, type WikiType } from './wiki.js'

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
  return /^DET-\d{3}\.json$/.test(name)
}

function detectionFile(root: string, detectionId: string): string {
  return paths(root).detectionFile(detectionId)
}

function nextDetectionId(root: string): string {
  return `DET-${String(loadDetections(root).length + 1).padStart(3, '0')}`
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
    const parsed = DetectionRecordSchema.safeParse(readJson(join(dir, file)))
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => a.detectionId.localeCompare(b.detectionId))
}

export function findDetection(root: string, detectionId: string): DetectionRecord | null {
  const parsed = DetectionRecordSchema.safeParse(readJson(detectionFile(root, detectionId)))
  return parsed.success ? parsed.data : null
}

export function createDetection(root: string, args: CreateDetectionArgs): DetectionRecord {
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
  writeJsonAtomic(paths(root).detectionFile(detection.detectionId), detection)
  return detection
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
