import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-eval-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function setupDetection() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Eval CLI', 'exercise eval command', '--type', 'fix']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire eval CLI']).status, 0)
  for (let i = 0; i < 3; i++) {
    assert.equal(cli(project, ['verify', 'custom', '--', process.execPath, '-e', 'process.exit(5)']).status, 5)
  }
  assert.equal(cli(project, ['monitor', 'active']).status, 0)
  return project
}

test('intent eval draft-from-detection writes a draft eval case', () => {
  const project = setupDetection()

  const result = cli(project, ['eval', 'draft-from-detection', 'DET-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /eval drafted EVAL-001 from DET-001/)
  const evalCase = JSON.parse(readFileSync(join(project, '.intent', 'evals', 'EVAL-001.json'), 'utf8'))
  assert.equal(evalCase.sourceDetectionId, 'DET-001')
  assert.equal(evalCase.trigger, 'thrashing')
  assert.equal(evalCase.expected.shouldDetectThrashing, true)
})

test('intent eval run executes a draft eval and stores lastRun', () => {
  const project = setupDetection()
  assert.equal(cli(project, ['eval', 'draft-from-detection', 'DET-001']).status, 0)

  const result = cli(project, ['eval', 'run', 'EVAL-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /EVAL-001: passed/)
  const evalCase = JSON.parse(readFileSync(join(project, '.intent', 'evals', 'EVAL-001.json'), 'utf8'))
  assert.equal(evalCase.lastRun.status, 'passed')
  assert.match(evalCase.lastRun.reason, /replayed span fixture/)
})

test('intent eval draft-from-detection fails clearly for missing detections', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)

  const result = cli(project, ['eval', 'draft-from-detection', 'DET-999'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /no such detection: DET-999/)
})
