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
