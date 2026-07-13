import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-detection-cli-'))
}

function humanEnv() {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  return env
}

function cli(project, args, env = humanEnv()) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8', env })
}

function setupProject() {
  const project = projectRoot()
  const setup = cli(project, ['setup'])
  assert.equal(setup.status, 0, setup.stderr)
  mkdirSync(join(project, '.intent', 'detections'), { recursive: true })
  writeDetection(project, {
    detectionId: 'DET-001',
    type: 'false_success',
    result: 'candidate',
    runId: 'RUN-001',
    intentId: 'INT-001',
    title: 'Completion attempted without required evidence',
    summary: 'Completion was attempted while unit_test evidence was missing.',
    evidenceRefs: ['intent:INT-001', 'run:RUN-001'],
    attributes: { missingEvidenceTypes: ['unit_test'] },
    resolution: null,
    createdAt: '2026-07-06T07:00:00.000Z',
    updatedAt: '2026-07-06T07:00:00.000Z',
    resolvedAt: null,
  })
  return project
}

function writeDetection(project, detection) {
  writeFileSync(
    join(project, '.intent', 'detections', `${detection.detectionId}.json`),
    JSON.stringify(detection, null, 2) + '\n',
    'utf8',
  )
}

function readDetection(project) {
  return JSON.parse(readFileSync(join(project, '.intent', 'detections', 'DET-001.json'), 'utf8'))
}

test('intent detection list prints detection summaries', () => {
  const project = setupProject()

  const result = cli(project, ['detection', 'list'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /DET-001 \[candidate\] false_success Completion attempted without required evidence \(RUN-001\)/)
})

test('intent detection show prints details, evidence refs, and attributes', () => {
  const project = setupProject()

  const result = cli(project, ['detection', 'show', 'DET-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /summary: Completion was attempted while unit_test evidence was missing\./)
  assert.match(result.stdout, /intent: INT-001/)
  assert.match(result.stdout, /  - intent:INT-001/)
  assert.match(result.stdout, /"missingEvidenceTypes"/)
})

test('intent detection resolve updates result and resolution from a human shell', () => {
  const project = setupProject()

  const result = cli(project, ['detection', 'resolve', 'DET-001', 'dismissed', 'Known local-only run'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /resolved DET-001 as dismissed/)
  const detection = readDetection(project)
  assert.equal(detection.result, 'dismissed')
  assert.equal(detection.resolution, 'Known local-only run')
  assert.match(detection.resolvedAt, /^20/)
  assert.match(result.stdout, /wiki: detection-det-001-completion-attempted-without-required-evidence/)
  const wiki = readFileSync(
    join(project, '.intent', 'wiki', 'problems', 'detection-det-001-completion-attempted-without-required-evidence.md'),
    'utf8',
  )
  assert.match(wiki, /status: resolved/)
  assert.match(wiki, /Known local-only run/)
})

test('intent detection resolve is human-only', () => {
  const project = setupProject()

  const result = cli(project, ['detection', 'resolve', 'DET-001', 'confirmed', 'Real issue'], {
    ...humanEnv(),
    CODEX_THREAD_ID: 'thread',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /detection resolve is human-only/)
})
