import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDetection, findDetection } from '../dist/src/runtime/detections.js'
import {
  runEmbeddingAdapter,
  runJudgeBatch,
  selectJudgeCandidates,
} from '../dist/src/runtime/judge-policy.js'
import { runJudgeAdapter } from '../dist/src/runtime/judge-adapter.js'

function root() {
  return mkdtempSync(join(tmpdir(), 'intent-judge-policy-'))
}

const policy = {
  embeddingModelKey: 'test-model',
  similarityThreshold: 0.9,
  maxEmbeddingCandidates: 10,
  maxEmbeddingInputChars: 50000,
  maxEmbeddingDimensions: 4096,
  maxJudgeCandidates: 1,
  maxJudgeInputCharsPerCandidate: 16000,
  maxJudgeInputChars: 16000,
}

function seed(project) {
  for (const [title, summary] of [
    ['Repeated auth failure', 'The login command fails with the same token error.'],
    ['Recurring login error', 'Authentication repeatedly fails with a token error.'],
    ['Unrelated build loop', 'The bundler cannot resolve a CSS import.'],
  ]) {
    createDetection(project, { type: 'thrashing', title, summary })
  }
  createDetection(project, {
    type: 'false_success',
    title: 'Missing test evidence',
    summary: 'Unit test evidence is absent.',
  })
}

test('embedding adapter caches vectors and bounded Judge selection uses cosine similarity', () => {
  const project = root()
  seed(project)
  const embeddingAdapter = `
let input = ''
process.stdin.on('data', chunk => input += chunk)
process.stdin.on('end', () => {
  const payload = JSON.parse(input)
  const vectors = [[1, 0], [1, 0.01], [0, 1]]
  process.stdout.write(JSON.stringify({
    embeddings: payload.candidates.map((candidate, index) => ({ detectionId: candidate.detectionId, vector: vectors[index] }))
  }))
})
`

  const first = runEmbeddingAdapter(project, 'test-model', process.execPath, ['-e', embeddingAdapter], policy)
  assert.equal(first.adapterInvoked, true)
  assert.deepEqual(first.embeddedDetectionIds, ['DET-001', 'DET-002', 'DET-003'])
  assert.equal(findDetection(project, 'DET-004')?.embedding, null)

  const cached = runEmbeddingAdapter(project, 'test-model', process.execPath, ['-e', 'process.exit(9)'], policy)
  assert.equal(cached.adapterInvoked, false)
  assert.deepEqual(cached.cachedDetectionIds, ['DET-001', 'DET-002', 'DET-003'])

  const queue = selectJudgeCandidates(project, 'test-model', policy)
  assert.equal(queue.length, 1)
  assert.equal(queue[0].detectionId, 'DET-001')
  assert.ok(queue[0].similarity > 0.99)
  assert.deepEqual(queue[0].similarDetectionIds, ['DET-002'])
})

test('Judge batch is bounded and reuses identical adapter input', () => {
  const project = root()
  seed(project)
  const embeddingAdapter = `
let input = ''
process.stdin.on('data', chunk => input += chunk)
process.stdin.on('end', () => {
  const payload = JSON.parse(input)
  process.stdout.write(JSON.stringify({ embeddings: payload.candidates.map((candidate, index) => ({
    detectionId: candidate.detectionId,
    vector: index < 2 ? [1, index * 0.01] : [0, 1]
  })) }))
})
`
  runEmbeddingAdapter(project, 'test-model', process.execPath, ['-e', embeddingAdapter], policy)
  const judgeAdapter = `
let input = ''
process.stdin.on('data', chunk => input += chunk)
process.stdin.on('end', () => {
  const bundle = JSON.parse(input)
  process.stdout.write(JSON.stringify({ result: 'thrashing', judgement: 'semantic recurrence ' + bundle.detection.detectionId, confidence: 0.9, suggestedAction: 'revise the plan' }))
})
`

  const batch = runJudgeBatch(project, 'test-model', process.execPath, ['-e', judgeAdapter], policy)
  assert.equal(batch.length, 1)
  assert.equal(batch[0].cached, false)
  assert.equal(batch[0].detection.judge.status, 'fail')
  assert.equal(batch[0].detection.judge.classification, 'thrashing')
  assert.equal(batch[0].detection.judge.suggestedAction, 'revise the plan')
  assert.match(batch[0].detection.judge.inputDigest, /^[a-f0-9]{64}$/)

  const cached = runJudgeAdapter(project, batch[0].detection.detectionId, process.execPath, ['-e', judgeAdapter])
  assert.equal(cached.cached, true)
})
