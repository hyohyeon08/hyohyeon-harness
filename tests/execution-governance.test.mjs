import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkExecutionGovernance } from '../dist/src/runtime/execution-governance.js'

const intent = { id: 'INT-001', type: 'feature' }
const run = { runId: 'RUN-001', intentId: 'INT-001', phase: 'act' }
const contract = { contractId: 'CONTRACT-001', status: 'approved', runId: 'RUN-001', intentId: 'INT-001' }

test('feature execution requires a matching act/verify Run and approved Contract', () => {
  assert.equal(checkExecutionGovernance(intent, null, null).allow, false)
  assert.match(checkExecutionGovernance(intent, run, null).reason, /approved Contract/)
  assert.match(checkExecutionGovernance(intent, { ...run, phase: 'plan' }, contract).reason, /phase plan/)
  assert.equal(checkExecutionGovernance(intent, run, contract).allow, true)
  assert.equal(checkExecutionGovernance(intent, { ...run, phase: 'verify' }, contract).allow, true)
})

test('tidy and chore execution stays contract-optional', () => {
  assert.equal(checkExecutionGovernance({ ...intent, type: 'tidy' }, null, null).allow, true)
  assert.equal(checkExecutionGovernance({ ...intent, type: 'chore' }, null, null).allow, true)
})
