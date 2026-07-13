import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  activeRun,
  createRun,
  findRun,
  latestRunForIntent,
  loadRunIndex,
  loadRuns,
  markRunComplete,
  transitionRunPhase,
  updateRun,
} from '../dist/src/runtime/runs.js'
import { paths } from '../dist/src/state/paths.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-runs-'))
}

test('createRun writes RUN-001 with defaults and updates the active index', () => {
  const root = tempRoot()

  const run = createRun(root, { objective: 'Implement RunState CRUD', intentId: 'INT-001' })

  assert.equal(run.runId, 'RUN-001')
  assert.equal(run.objective, 'Implement RunState CRUD')
  assert.equal(run.status, 'active')
  assert.equal(run.phase, 'act')
  assert.equal(run.intentId, 'INT-001')
  assert.deepEqual(loadRunIndex(root), { version: 1, activeRunId: 'RUN-001', recentRunIds: ['RUN-001'] })
})

test('loadRuns returns valid run records sorted by id and ignores the index file', () => {
  const root = tempRoot()
  createRun(root, { objective: 'first' })
  createRun(root, { objective: 'second' })

  assert.deepEqual(loadRuns(root).map((run) => run.runId), ['RUN-001', 'RUN-002'])
})

test('findRun returns a run by id and null for a missing run', () => {
  const root = tempRoot()
  createRun(root, { objective: 'find me' })

  assert.equal(findRun(root, 'RUN-001')?.objective, 'find me')
  assert.equal(findRun(root, 'RUN-999'), null)
})

test('updateRun applies an immutable transform and refreshes updatedAt', () => {
  const root = tempRoot()
  const created = createRun(root, { objective: 'track next action', notes: ['schema first'] })

  const updated = updateRun(root, created.runId, (run) => ({
    ...run,
    nextAction: 'Add run CLI',
    notes: [...run.notes, 'runtime CRUD done'],
  }))

  assert.equal(updated.nextAction, 'Add run CLI')
  assert.deepEqual(updated.notes, ['schema first', 'runtime CRUD done'])
  assert.notEqual(updated.updatedAt, created.updatedAt)
})

test('activeRun follows the active index and falls back to the newest active run', () => {
  const root = tempRoot()
  createRun(root, { objective: 'first' })
  const second = createRun(root, { objective: 'second' })

  assert.equal(activeRun(root)?.runId, second.runId)

  writeFileSync(paths(root).runsLatest, JSON.stringify({ version: 1, activeRunId: 'RUN-404', recentRunIds: [] }))

  assert.equal(activeRun(root)?.runId, second.runId)
})

test('activeRun is null after the indexed active run leaves active status', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'finish me' })

  updateRun(root, run.runId, (r) => ({ ...r, status: 'passing', phase: 'done' }))

  assert.equal(activeRun(root), null)
  assert.equal(loadRunIndex(root).activeRunId, null)
})

test('latestRunForIntent returns the newest linked run regardless of status', () => {
  const root = tempRoot()
  createRun(root, { objective: 'first', intentId: 'INT-001' })
  const latest = createRun(root, { objective: 'latest', intentId: 'INT-001' })
  createRun(root, { objective: 'other intent', intentId: 'INT-002' })
  updateRun(root, latest.runId, (run) => ({ ...run, status: 'blocked' }))

  assert.equal(activeRun(root)?.runId, 'RUN-003')
  assert.equal(latestRunForIntent(root, 'INT-001')?.runId, latest.runId)
  assert.equal(latestRunForIntent(root, 'INT-001')?.status, 'blocked')
  assert.equal(latestRunForIntent(root, 'INT-404'), null)
})

test('transitionRunPhase enforces the forward loop and allows verify rework', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'state machine' })

  const verifying = transitionRunPhase(root, run.runId, 'verify')
  const reworking = transitionRunPhase(root, run.runId, 'act')

  assert.equal(verifying.phase, 'verify')
  assert.equal(reworking.phase, 'act')
  assert.throws(() => transitionRunPhase(root, run.runId, 'plan'), /invalid run phase transition: act -> plan/)
  assert.throws(() => transitionRunPhase(root, run.runId, 'done'), /done is completion-gated/)
})

test('markRunComplete is the terminal transition', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'finish state machine' })

  const completed = markRunComplete(root, run.runId)

  assert.equal(completed.phase, 'done')
  assert.equal(completed.status, 'passing')
  assert.equal(completed.nextAction, null)
  assert.equal(activeRun(root), null)
})
