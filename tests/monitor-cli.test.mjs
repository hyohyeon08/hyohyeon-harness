import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-monitor-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function setupProject() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Monitor CLI', 'exercise monitor command', '--type', 'fix']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire monitor CLI']).status, 0)
  return project
}

function failSameCommandThreeTimes(project) {
  for (let i = 0; i < 3; i++) {
    const result = cli(project, ['verify', 'custom', '--', process.execPath, '-e', 'process.exit(7)'])
    assert.equal(result.status, 7)
  }
}

function detectionFiles(project) {
  return readdirSync(join(project, '.intent', 'detections')).filter((file) => file.endsWith('.json')).sort()
}

function readDetection(project, file = 'DET-001.json') {
  return JSON.parse(readFileSync(join(project, '.intent', 'detections', file), 'utf8'))
}

function readRun(project, file = 'RUN-001.json') {
  return JSON.parse(readFileSync(join(project, '.intent', 'runs', file), 'utf8'))
}

test('intent monitor run creates a thrashing detection for repeated command failures', () => {
  const project = setupProject()
  failSameCommandThreeTimes(project)

  const result = cli(project, ['monitor', 'run', 'RUN-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /monitor RUN-001: 1 detection\(s\)/)
  assert.match(result.stdout, /DET-001 \[candidate\] thrashing Repeated command failure/)

  const detection = readDetection(project)
  assert.equal(detection.type, 'thrashing')
  assert.equal(detection.runId, 'RUN-001')
  assert.equal(detection.attributes.exitCode, 7)
  assert.equal(detection.attributes.count, 3)

  const run = readRun(project)
  assert.equal(run.status, 'active')
  assert.equal(run.nextAction, null)
  assert.deepEqual(run.notes, [])
})

test('intent monitor active uses the active run', () => {
  const project = setupProject()
  failSameCommandThreeTimes(project)

  const result = cli(project, ['monitor', 'active'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /monitor RUN-001: 1 detection\(s\)/)
})

test('intent monitor run is idempotent for the same repeated failure group', () => {
  const project = setupProject()
  failSameCommandThreeTimes(project)

  assert.equal(cli(project, ['monitor', 'run', 'RUN-001']).status, 0)
  assert.equal(cli(project, ['monitor', 'run', 'RUN-001']).status, 0)

  assert.deepEqual(detectionFiles(project), ['DET-001.json'])
})

test('intent monitor active fails clearly without an active run', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)

  const result = cli(project, ['monitor', 'active'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /usage: intent monitor active/)
})
