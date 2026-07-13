import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideGate } from '../dist/src/runtime/intent-gate.js'

const change = {
  path: 'src/foo.ts',
  addedLines: 0,
  removedLines: 0,
  newSymbols: false,
  addsControlFlow: false,
  onlyCommentsOrFormat: false,
  isNewFile: false,
}

const nonTrivial = { ...change, newSymbols: true }
const trivial = { ...change, addedLines: 2, onlyCommentsOrFormat: true }

function intent(status, scope = ['**'], id = 'INT-001') {
  return {
    id,
    what: 'x',
    why: 'y',
    type: 'feature',
    scope,
    dod: [],
    dodChecked: [],
    status,
    approvedBy: status === 'approved' ? 'human' : null,
    learnings: null,
    createdAt: 't',
    updatedAt: 't',
  }
}

test('trivial change is always allowed', () => {
  assert.equal(decideGate(trivial, []).allow, true)
})

test('non-trivial change with no intent is blocked', () => {
  const d = decideGate(nonTrivial, [])
  assert.equal(d.allow, false)
  assert.match(d.reason, /approved intent/)
})

test('non-trivial change with only a draft intent is blocked', () => {
  const d = decideGate(nonTrivial, [intent('draft')])
  assert.equal(d.allow, false)
  assert.match(d.reason, /awaiting human approval/)
})

test('non-trivial change with an approved intent is allowed', () => {
  const d = decideGate(nonTrivial, [intent('approved')])
  assert.equal(d.allow, true)
  assert.match(d.reason, /INT-001/)
})

test('non-trivial change inside an approved intent scope is allowed', () => {
  const change = { ...nonTrivial, path: 'src/order/cancel.ts' }
  const d = decideGate(change, [intent('approved', ['src/order/**'])])
  assert.equal(d.allow, true)
})

test('non-trivial change outside approved scope is blocked (scope creep)', () => {
  const change = { ...nonTrivial, path: 'src/stock/restore.ts' }
  const d = decideGate(change, [intent('approved', ['src/order/**'])])
  assert.equal(d.allow, false)
  assert.match(d.reason, /outside the scope/)
})
