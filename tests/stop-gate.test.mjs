import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateStopGate, canComplete } from '../dist/src/runtime/stop-gate.js'

function intent(over = {}) {
  return {
    id: 'INT-001',
    what: 'x',
    why: 'y',
    type: 'feature',
    scope: ['**'],
    dod: ['a', 'b'],
    dodChecked: ['a', 'b'],
    status: 'approved',
    approvedBy: 'human',
    learnings: 'learned X',
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

function evidence(over = {}) {
  return {
    evidenceId: 'VE-001',
    type: 'unit_test',
    status: 'passed',
    command: 'npm.cmd',
    args: ['test'],
    exitCode: 0,
    logPath: '.intent/raw/unit_test-results/RUN-001.log',
    startedAt: 't',
    finishedAt: 't',
    ...over,
  }
}

function run(over = {}) {
  return {
    runId: 'RUN-001',
    objective: 'x',
    phase: 'verify',
    status: 'active',
    intentId: 'INT-001',
    specSlug: null,
    planId: null,
    contractId: null,
    nextAction: null,
    notes: [],
    evidence: [],
    requiredEvidenceTypes: [],
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

test('no intents -> gate clear', () => {
  assert.equal(evaluateStopGate([]).block, false)
})

test('approved intent with unchecked DoD blocks', () => {
  const d = evaluateStopGate([intent({ dodChecked: ['a'] })])
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /DoD incomplete \(1\/2\)/)
})

test('feature with all DoD checked but no learning blocks', () => {
  const d = evaluateStopGate([intent({ learnings: null })])
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /learning note/)
})

test('feature fully done with learning -> gate clear', () => {
  assert.equal(evaluateStopGate([intent()]).block, false)
})

test('tidy is exempt from the learning requirement', () => {
  const d = evaluateStopGate([intent({ type: 'tidy', learnings: null })])
  assert.equal(d.block, false)
})

test('draft and done intents are ignored by the stop gate', () => {
  const drafts = [intent({ status: 'draft', learnings: null, dodChecked: [] })]
  const done = [intent({ status: 'done', learnings: null })]
  assert.equal(evaluateStopGate(drafts).block, false)
  assert.equal(evaluateStopGate(done).block, false)
})

test('canComplete rejects a non-approved intent', () => {
  assert.equal(canComplete(intent({ status: 'draft' })).ok, false)
})

test('canComplete passes a fully satisfied feature', () => {
  assert.equal(canComplete(intent()).ok, true)
})

test('required evidence missing blocks completion when a run requires it', () => {
  const d = evaluateStopGate([intent()], run({ requiredEvidenceTypes: ['unit_test'] }))
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence missing: unit_test/)
})

test('failed required evidence blocks completion', () => {
  const d = evaluateStopGate(
    [intent()],
    run({ requiredEvidenceTypes: ['unit_test'], evidence: [evidence({ status: 'failed', exitCode: 7 })] }),
  )
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence failed: unit_test/)
})

test('passed required evidence allows completion', () => {
  const d = evaluateStopGate([intent()], run({ requiredEvidenceTypes: ['unit_test'], evidence: [evidence()] }))
  assert.equal(d.block, false)
})

test('active run required evidence only applies to its linked intent', () => {
  const d = evaluateStopGate([intent({ id: 'INT-002' })], run({ requiredEvidenceTypes: ['unit_test'] }))
  assert.equal(d.block, false)
})
