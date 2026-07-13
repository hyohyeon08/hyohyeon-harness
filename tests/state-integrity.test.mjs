import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadIntents } from '../dist/src/runtime/intents.js'
import { loadRules } from '../dist/src/runtime/rules.js'
import { loadRuns } from '../dist/src/runtime/runs.js'
import { loadPlans } from '../dist/src/runtime/plans.js'
import { loadInterviews } from '../dist/src/runtime/interviews.js'
import { loadContracts } from '../dist/src/runtime/contracts.js'
import { loadDetections } from '../dist/src/runtime/detections.js'
import { loadEvalCases } from '../dist/src/runtime/evals.js'

test('loadIntents fails closed on malformed or schema-invalid state', () => {
  const root = mkdtempSync(join(tmpdir(), 'intent-state-integrity-'))
  const dir = join(root, '.intent', 'intents')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'INT-001.json'), '{ malformed', 'utf8')

  assert.throws(() => loadIntents(root), /invalid intent state INT-001\.json/)

  writeFileSync(join(dir, 'INT-001.json'), JSON.stringify({ id: 'INT-001' }), 'utf8')
  assert.throws(() => loadIntents(root), /invalid intent state INT-001\.json/)
})

test('loadRules fails closed instead of dropping a malformed approved gate candidate', () => {
  const root = mkdtempSync(join(tmpdir(), 'intent-rule-state-integrity-'))
  const dir = join(root, '.intent', 'rules')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'RULE-001.json'), '{ malformed', 'utf8')

  assert.throws(() => loadRules(root), /invalid rule state RULE-001\.json/)
})

test('loadRuns fails closed instead of falling back to an older governed run', () => {
  const root = mkdtempSync(join(tmpdir(), 'intent-run-state-integrity-'))
  const dir = join(root, '.intent', 'runs')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'RUN-002.json'), JSON.stringify({ runId: 'RUN-002' }), 'utf8')

  assert.throws(() => loadRuns(root), /invalid run state RUN-002\.json/)
})

test('artifact collection loaders fail closed on malformed records', () => {
  const cases = [
    ['plans', 'PLAN-001.json', loadPlans, /invalid plan state/],
    ['interviews', 'INTERVIEW-001.json', loadInterviews, /invalid interview state/],
    ['contracts', 'CONTRACT-001.json', loadContracts, /invalid linked contract state/],
    ['detections', 'DET-001.json', loadDetections, /invalid detection state/],
    ['evals', 'EVAL-001.json', loadEvalCases, /invalid eval state/],
  ]

  for (const [directory, file, loader, expected] of cases) {
    const root = mkdtempSync(join(tmpdir(), `intent-${directory}-state-integrity-`))
    const dir = join(root, '.intent', directory)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, file), '{ malformed', 'utf8')
    assert.throws(() => loader(root), expected)
  }
})
