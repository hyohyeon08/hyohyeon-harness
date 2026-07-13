import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRun, findRun, loadRunIndex, updateRun } from '../dist/src/runtime/runs.js'
import { createInterview } from '../dist/src/runtime/interviews.js'
import { createPlan } from '../dist/src/runtime/plans.js'
import { createContract } from '../dist/src/runtime/contracts.js'
import { reconcileState } from '../dist/src/runtime/reconcile.js'
import { paths } from '../dist/src/state/paths.js'

function root() {
  return mkdtempSync(join(tmpdir(), 'intent-reconcile-'))
}

function intent() {
  return {
    id: 'INT-001', what: 'reconcile', why: 'recover partial writes', type: 'feature', scope: ['src/**'],
    dod: [], dodChecked: [], status: 'approved', approvedBy: 'human', learnings: null, createdAt: 't', updatedAt: 't',
  }
}

test('reconcile repairs missing backlinks and a corrupt derived Run index idempotently', () => {
  const project = root()
  const run = createRun(project, { objective: 'recover lineage', intentId: 'INT-001' })
  const interview = createInterview(project, { title: 'source', intentId: 'INT-001', runId: run.runId })
  const plan = createPlan(project, {
    title: 'plan', intentId: 'INT-001', interviewId: interview.interviewId, runId: run.runId,
  })
  const contract = createContract(project, { runId: run.runId, intent: intent() })
  writeFileSync(paths(project).runsLatest, '{ corrupt', 'utf8')

  const dryRun = reconcileState(project)
  assert.equal(dryRun.applied, false)
  assert.deepEqual(dryRun.conflicts, [])
  assert.match(dryRun.repairs.join('\n'), /link RUN-001 to PLAN-001/)
  assert.match(dryRun.repairs.join('\n'), /link RUN-001 to CONTRACT-001/)
  assert.match(dryRun.repairs.join('\n'), /link RUN-001 to INTERVIEW-001/)
  assert.match(dryRun.repairs.join('\n'), /rebuild derived Run index/)

  const applied = reconcileState(project, true)
  assert.equal(applied.applied, true)
  assert.deepEqual(applied.conflicts, [])
  const repaired = findRun(project, run.runId)
  assert.equal(repaired?.planId, plan.planId)
  assert.equal(repaired?.contractId, contract.contractId)
  assert.equal(repaired?.interviewId, interview.interviewId)
  assert.equal(loadRunIndex(project).activeRunId, run.runId)

  assert.deepEqual(reconcileState(project), { applied: false, repairs: [], conflicts: [] })
})

test('reconcile reports conflicting lineage without applying partial repairs', () => {
  const project = root()
  const first = createRun(project, { objective: 'first', intentId: 'INT-001' })
  const second = createRun(project, { objective: 'second', intentId: 'INT-001' })
  const plan = createPlan(project, { title: 'owned by second', intentId: 'INT-001', runId: second.runId })
  updateRun(project, first.runId, (run) => ({ ...run, planId: plan.planId }))

  const result = reconcileState(project, true)

  assert.equal(result.applied, false)
  assert.match(result.conflicts.join('\n'), /RUN-001 conflicts with PLAN-001 linked to RUN-002/)
  assert.equal(findRun(project, first.runId)?.planId, plan.planId)
})
