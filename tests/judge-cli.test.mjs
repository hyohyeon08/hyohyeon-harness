import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-judge-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function setupDetection() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Judge CLI', 'exercise judge command', '--type', 'fix']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire judge CLI']).status, 0)
  for (let i = 0; i < 3; i++) {
    assert.equal(cli(project, ['verify', 'custom', '--', process.execPath, '-e', 'process.exit(9)']).status, 9)
  }
  assert.equal(cli(project, ['monitor', 'run', 'RUN-001']).status, 0)
  return project
}

test('intent judge bundle prints deterministic JSON for a detection', () => {
  const project = setupDetection()

  const result = cli(project, ['judge', 'bundle', 'DET-001'])

  assert.equal(result.status, 0, result.stderr)
  const bundle = JSON.parse(result.stdout)
  assert.equal(bundle.detection.detectionId, 'DET-001')
  assert.equal(bundle.detection.type, 'thrashing')
  assert.equal(bundle.run.runId, 'RUN-001')
  assert.equal(bundle.evidence.length, 3)
  assert.equal(bundle.trace.runId, 'RUN-001')
  assert.deepEqual(bundle.evidenceRefs, bundle.detection.evidenceRefs)
})

test('intent judge bundle fails clearly for missing detections', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)

  const result = cli(project, ['judge', 'bundle', 'DET-999'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /no such detection: DET-999/)
})

test('intent judge record stores a judge result on the detection', () => {
  const project = setupDetection()

  const result = cli(project, ['judge', 'record', 'DET-001', 'fail', 'Repeated failure is real', '--confidence', '0.75'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /judge recorded DET-001: fail/)
  const detection = JSON.parse(readFileSync(join(project, '.intent', 'detections', 'DET-001.json'), 'utf8'))
  assert.deepEqual(detection.judge.status, 'fail')
  assert.equal(detection.judge.judgement, 'Repeated failure is real')
  assert.equal(detection.judge.confidence, 0.75)
  assert.match(detection.judge.updatedAt, /^20/)
})

test('intent judge run executes an external judge adapter and stores its JSON result', () => {
  const project = setupDetection()
  const adapter = `
let input = ''
process.stdin.on('data', chunk => input += chunk)
process.stdin.on('end', () => {
  const bundle = JSON.parse(input)
  process.stdout.write(JSON.stringify({
    status: 'fail',
    judgement: 'adapter judged ' + bundle.detection.detectionId,
    confidence: 0.8
  }))
})
`

  const result = cli(project, ['judge', 'run', 'DET-001', '--', process.execPath, '-e', adapter])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /judge adapter recorded DET-001: fail/)
  const detection = JSON.parse(readFileSync(join(project, '.intent', 'detections', 'DET-001.json'), 'utf8'))
  assert.equal(detection.judge.status, 'fail')
  assert.equal(detection.judge.judgement, 'adapter judged DET-001')
  assert.equal(detection.judge.confidence, 0.8)
})

test('intent judge semantic caches embeddings and queue applies the policy threshold', () => {
  const project = setupDetection()
  const adapter = `
let input = ''
process.stdin.on('data', chunk => input += chunk)
process.stdin.on('end', () => {
  const payload = JSON.parse(input)
  process.stdout.write(JSON.stringify({ embeddings: payload.candidates.map(candidate => ({
    detectionId: candidate.detectionId,
    vector: [1, 0]
  })) }))
})
`

  const policy = cli(project, ['judge', 'policy'])
  assert.equal(policy.status, 0, policy.stderr)
  assert.equal(JSON.parse(policy.stdout).maxJudgeCandidates, 3)

  const semantic = cli(project, ['judge', 'semantic', '--model', 'test-model', '--', process.execPath, '-e', adapter])
  assert.equal(semantic.status, 0, semantic.stderr)
  assert.match(semantic.stdout, /embedding adapter ran/)
  const detection = JSON.parse(readFileSync(join(project, '.intent', 'detections', 'DET-001.json'), 'utf8'))
  assert.equal(detection.embedding.modelKey, 'test-model')

  const cached = cli(project, ['judge', 'semantic', '--model', 'test-model', '--', process.execPath, '-e', 'process.exit(9)'])
  assert.equal(cached.status, 0, cached.stderr)
  assert.match(cached.stdout, /embedding adapter cache hit/)

  const queue = cli(project, ['judge', 'queue', '--model', 'test-model'])
  assert.equal(queue.status, 0, queue.stderr)
  assert.match(queue.stdout, /judge queue: 0 candidate\(s\)/)
})
