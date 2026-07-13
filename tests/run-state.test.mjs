import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import {
  RunPhaseSchema,
  RunStateSchema,
  RunStatusSchema,
  StateSchema,
} from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'

test('RunStatusSchema accepts the run lifecycle states', () => {
  assert.equal(RunStatusSchema.parse('active'), 'active')
  assert.equal(RunStatusSchema.parse('blocked'), 'blocked')
  assert.equal(RunStatusSchema.parse('passing'), 'passing')
  assert.equal(RunStatusSchema.parse('paused'), 'paused')
})

test('RunPhaseSchema accepts the MVP run phases', () => {
  assert.equal(RunPhaseSchema.parse('interview'), 'interview')
  assert.equal(RunPhaseSchema.parse('plan'), 'plan')
  assert.equal(RunPhaseSchema.parse('contract'), 'contract')
  assert.equal(RunPhaseSchema.parse('act'), 'act')
  assert.equal(RunPhaseSchema.parse('verify'), 'verify')
  assert.equal(RunPhaseSchema.parse('done'), 'done')
})

test('RunStateSchema defaults status, phase, references, budget, and notes', () => {
  const run = RunStateSchema.parse({
    runId: 'RUN-001',
    objective: 'Add RunState schema',
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  })

  assert.equal(run.status, 'active')
  assert.equal(run.phase, 'act')
  assert.equal(run.intentId, null)
  assert.equal(run.interviewId, null)
  assert.equal(run.specSlug, null)
  assert.equal(run.planId, null)
  assert.equal(run.contractId, null)
  assert.equal(run.nextAction, null)
  assert.deepEqual(run.budget, { maxAttempts: 3, attemptsUsed: 0 })
  assert.deepEqual(run.notes, [])
})

test('RunStateSchema keeps optional references when provided', () => {
  const run = RunStateSchema.parse({
    runId: 'RUN-002',
    objective: 'Track run references',
    intentId: 'INT-001',
    interviewId: 'INTERVIEW-001',
    specSlug: 'spec-run-state',
    planId: 'PLAN-001',
    contractId: 'CONTRACT-001',
    nextAction: 'Implement CRUD next',
    notes: ['schema first'],
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  })

  assert.equal(run.intentId, 'INT-001')
  assert.equal(run.interviewId, 'INTERVIEW-001')
  assert.equal(run.specSlug, 'spec-run-state')
  assert.equal(run.planId, 'PLAN-001')
  assert.equal(run.contractId, 'CONTRACT-001')
  assert.equal(run.nextAction, 'Implement CRUD next')
  assert.deepEqual(run.notes, ['schema first'])
})

test('StateSchema remains compatible with existing state files', () => {
  const state = StateSchema.parse({ version: 1, activeIntentId: null })
  assert.equal(state.activeIntentId, null)
})

test('paths include .intent/runs locations', () => {
  const p = paths('C:\\work\\project')
  assert.equal(p.runsDir, join('C:\\work\\project', '.intent', 'runs'))
  assert.equal(p.runsLatest, join('C:\\work\\project', '.intent', 'runs', 'latest-runs.json'))
})
