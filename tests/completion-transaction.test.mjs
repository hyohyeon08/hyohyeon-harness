import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { draftIntent, approveIntent, loadIntents } from '../dist/src/runtime/intents.js'
import { createRun, findRun } from '../dist/src/runtime/runs.js'
import {
  completeIntentTransaction,
  loadCompletionTransactions,
} from '../dist/src/runtime/completion-transaction.js'
import { reconcileState } from '../dist/src/runtime/reconcile.js'

function setupProject() {
  const project = mkdtempSync(join(tmpdir(), 'intent-completion-transaction-'))
  const intent = draftIntent(project, {
    what: 'Complete atomically',
    why: 'recover cross-record completion',
    type: 'chore',
  })
  approveIntent(project, intent.id)
  const run = createRun(project, { objective: 'exercise completion recovery', intentId: intent.id })
  return { project, intent, run }
}

test('reconcile finishes an interrupted completion transaction idempotently', () => {
  const { project, intent, run } = setupProject()

  assert.throws(
    () => completeIntentTransaction(project, intent.id, run, null, {
      afterIntentCompleted: () => { throw new Error('simulated crash after Intent write') },
    }),
    /simulated crash/,
  )

  assert.equal(loadIntents(project)[0].status, 'done')
  assert.equal(findRun(project, run.runId)?.status, 'active')
  assert.equal(loadCompletionTransactions(project)[0].status, 'pending')

  const dryRun = reconcileState(project)
  assert.equal(dryRun.applied, false)
  assert.deepEqual(dryRun.conflicts, [])
  assert.match(dryRun.repairs.join('\n'), /finish completion INT-001 with RUN-001/)

  const applied = reconcileState(project, true)
  assert.equal(applied.applied, true)
  assert.deepEqual(applied.conflicts, [])
  assert.equal(findRun(project, run.runId)?.phase, 'done')
  assert.equal(findRun(project, run.runId)?.status, 'passing')
  assert.equal(loadCompletionTransactions(project)[0].status, 'committed')

  assert.deepEqual(reconcileState(project), { applied: false, repairs: [], conflicts: [] })
})

test('retrying a committed completion transaction is a no-op', () => {
  const { project, intent, run } = setupProject()

  const first = completeIntentTransaction(project, intent.id, run)
  const second = completeIntentTransaction(project, intent.id, findRun(project, run.runId))

  assert.equal(first.status, 'done')
  assert.equal(second.status, 'done')
  assert.equal(loadCompletionTransactions(project)[0].status, 'committed')
  assert.equal(findRun(project, run.runId)?.status, 'passing')
})
