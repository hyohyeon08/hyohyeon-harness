import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { paths } from '../state/paths.js'
import { readJson } from '../utils/json.js'
import { compareSequentialIds } from '../utils/id.js'
import { loadDetections, updateDetection } from './detections.js'
import { buildJudgeInputBundle } from './judge.js'
import { runJudgeAdapter, type RunJudgeAdapterResult } from './judge-adapter.js'
import { cosineSimilarity } from './similarity.js'
import { ConfigSchema, DEFAULT_CONFIG, type Config, type DetectionRecord } from './schemas.js'

export type JudgePolicy = Config['judge']

export interface EmbeddingAdapterResult {
  adapterInvoked: boolean
  cachedDetectionIds: string[]
  embeddedDetectionIds: string[]
}

export interface JudgeCandidate {
  detectionId: string
  similarity: number
  similarDetectionIds: string[]
  estimatedInputChars: number
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableValue(item)]))
}

export function semanticText(detection: DetectionRecord): string {
  return JSON.stringify(stableValue({
    type: detection.type,
    title: detection.title,
    summary: detection.summary,
    evidenceRefs: detection.evidenceRefs,
    attributes: detection.attributes,
  }))
}

export function semanticInputDigest(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function loadJudgePolicy(root: string): JudgePolicy {
  const raw = readJson(paths(root).config)
  return ConfigSchema.parse(raw ?? DEFAULT_CONFIG).judge
}

function eligibleDetections(root: string): DetectionRecord[] {
  return loadDetections(root)
    .filter((detection) => detection.result === 'candidate')
    .filter((detection) => detection.type === 'thrashing')
    .filter((detection) => detection.judge.status === 'not_run')
    .sort((left, right) => compareSequentialIds(left.detectionId, right.detectionId))
}

function parseEmbeddingOutput(stdout: string, expectedIds: string[], maxDimensions: number): Map<string, number[]> {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('embedding adapter stdout must be JSON')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('embedding adapter stdout must be an object')
  const embeddings = (parsed as Record<string, unknown>).embeddings
  if (!Array.isArray(embeddings)) throw new Error('embedding adapter output needs embeddings[]')
  const out = new Map<string, number[]>()
  let dimensions: number | null = null
  for (const item of embeddings) {
    if (!item || typeof item !== 'object') throw new Error('embedding item must be an object')
    const record = item as Record<string, unknown>
    if (typeof record.detectionId !== 'string' || !expectedIds.includes(record.detectionId)) {
      throw new Error('embedding item has an unexpected detectionId')
    }
    if (!Array.isArray(record.vector) || record.vector.length === 0 || !record.vector.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error(`embedding ${record.detectionId} needs a finite non-empty vector`)
    }
    if (record.vector.length > maxDimensions) throw new Error(`embedding ${record.detectionId} exceeds ${maxDimensions} dimensions`)
    if (dimensions !== null && record.vector.length !== dimensions) throw new Error('embedding vectors must share dimensions')
    dimensions = record.vector.length
    out.set(record.detectionId, record.vector as number[])
  }
  for (const id of expectedIds) if (!out.has(id)) throw new Error(`embedding adapter omitted ${id}`)
  return out
}

export function runEmbeddingAdapter(
  root: string,
  modelKey: string,
  command: string,
  args: string[],
  policy = loadJudgePolicy(root),
): EmbeddingAdapterResult {
  const eligible = eligibleDetections(root)
  const cachedDetectionIds: string[] = []
  const missing: Array<{ detection: DetectionRecord; text: string; inputDigest: string }> = []
  let inputChars = 0
  for (const detection of eligible) {
    const text = semanticText(detection)
    const inputDigest = semanticInputDigest(text)
    if (detection.embedding?.modelKey === modelKey && detection.embedding.inputDigest === inputDigest) {
      cachedDetectionIds.push(detection.detectionId)
      continue
    }
    if (missing.length >= policy.maxEmbeddingCandidates || inputChars + text.length > policy.maxEmbeddingInputChars) continue
    missing.push({ detection, text, inputDigest })
    inputChars += text.length
  }
  if (missing.length === 0) return { adapterInvoked: false, cachedDetectionIds, embeddedDetectionIds: [] }

  const payload = {
    modelKey,
    candidates: missing.map((item) => ({
      detectionId: item.detection.detectionId,
      inputDigest: item.inputDigest,
      text: item.text,
    })),
  }
  const child = spawnSync(command, args, { cwd: root, input: JSON.stringify(payload), encoding: 'utf8' })
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error(`embedding adapter failed exit=${child.status ?? 'null'}: ${child.stderr}`)
  const vectors = parseEmbeddingOutput(
    child.stdout.trim(),
    missing.map((item) => item.detection.detectionId),
    policy.maxEmbeddingDimensions,
  )
  const updatedAt = new Date().toISOString()
  for (const item of missing) {
    updateDetection(root, item.detection.detectionId, (detection) => ({
      ...detection,
      embedding: {
        modelKey,
        inputDigest: item.inputDigest,
        vector: vectors.get(item.detection.detectionId)!,
        updatedAt,
      },
    }))
  }
  return {
    adapterInvoked: true,
    cachedDetectionIds,
    embeddedDetectionIds: missing.map((item) => item.detection.detectionId),
  }
}

export function selectJudgeCandidates(
  root: string,
  modelKey: string,
  policy = loadJudgePolicy(root),
): JudgeCandidate[] {
  const detections = eligibleDetections(root).filter((detection) => detection.embedding?.modelKey === modelKey)
  const scored = detections.map((detection) => {
    const peers = detections
      .filter((candidate) => candidate.detectionId !== detection.detectionId)
      .filter((candidate) => candidate.embedding?.vector.length === detection.embedding!.vector.length)
      .map((candidate) => ({
        detectionId: candidate.detectionId,
        similarity: cosineSimilarity(detection.embedding!.vector, candidate.embedding!.vector),
      }))
      .sort((left, right) => right.similarity - left.similarity || compareSequentialIds(left.detectionId, right.detectionId))
    const bundle = buildJudgeInputBundle(root, detection.detectionId)
    return {
      detectionId: detection.detectionId,
      similarity: peers[0]?.similarity ?? 0,
      similarDetectionIds: peers.filter((peer) => peer.similarity >= policy.similarityThreshold).map((peer) => peer.detectionId),
      estimatedInputChars: JSON.stringify(bundle).length,
    }
  })
    .filter((candidate) => candidate.similarity >= policy.similarityThreshold)
    .filter((candidate) => candidate.estimatedInputChars <= policy.maxJudgeInputCharsPerCandidate)
    .sort((left, right) => right.similarity - left.similarity || compareSequentialIds(left.detectionId, right.detectionId))

  const selected: JudgeCandidate[] = []
  let totalChars = 0
  for (const candidate of scored) {
    if (selected.length >= policy.maxJudgeCandidates) break
    if (totalChars + candidate.estimatedInputChars > policy.maxJudgeInputChars) continue
    selected.push(candidate)
    totalChars += candidate.estimatedInputChars
  }
  return selected
}

export function runJudgeBatch(
  root: string,
  modelKey: string,
  command: string,
  args: string[],
  policy = loadJudgePolicy(root),
): RunJudgeAdapterResult[] {
  return selectJudgeCandidates(root, modelKey, policy)
    .map((candidate) => runJudgeAdapter(root, candidate.detectionId, command, args))
}
