import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  archiveInterview,
  approveInterview,
  createInterview,
  findInterview,
  linkInterview,
  loadInterviews,
  reviseInterview,
  updateInterview,
} from '../dist/src/runtime/interviews.js'
import { InterviewSummarySchema } from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-interviews-'))
}

test('InterviewSummarySchema defaults lifecycle, structured fields, and lineage', () => {
  const summary = InterviewSummarySchema.parse({
    interviewId: 'INTERVIEW-001',
    title: 'Order cancellation',
    goal: 'Agree on cancellation behavior.',
    createdAt: 't',
    updatedAt: 't',
  })

  assert.equal(summary.status, 'draft')
  assert.equal(summary.revision, 1)
  assert.equal(summary.supersedesInterviewId, null)
  assert.equal(summary.approvedBy, null)
  assert.equal(summary.approvedAt, null)
  assert.deepEqual(summary.context, [])
  assert.deepEqual(summary.constraints, [])
  assert.deepEqual(summary.allowedScope, ['**'])
  assert.deepEqual(summary.forbiddenScope, [])
  assert.deepEqual(summary.successCriteria, [])
  assert.deepEqual(summary.failureCriteria, [])
  assert.deepEqual(summary.verification, [])
  assert.deepEqual(summary.consideredOptions, [])
  assert.deepEqual(summary.nonGoals, [])
  assert.deepEqual(summary.assumptions, [])
  assert.deepEqual(summary.openQuestions, [])
  assert.equal(summary.intentId, null)
  assert.equal(summary.specSlug, null)
  assert.equal(summary.planId, null)
  assert.equal(summary.runId, null)
})

test('approved Interview can be archived and cloned as a new draft revision', () => {
  const root = tempRoot()
  const created = createInterview(root, { title: 'Original', goal: 'Preserve the goal', context: ['context'] })
  approveInterview(root, created.interviewId, 'human')
  const archived = archiveInterview(root, created.interviewId)
  const revised = reviseInterview(root, archived.interviewId, 'Revised')

  assert.equal(archived.status, 'archived')
  assert.equal(revised.status, 'draft')
  assert.equal(revised.revision, 2)
  assert.equal(revised.supersedesInterviewId, archived.interviewId)
  assert.equal(revised.title, 'Revised')
  assert.deepEqual(revised.context, ['context'])
  assert.equal(revised.runId, null)
})

test('paths include .intent/interviews locations', () => {
  const p = paths('C:\\work\\project')
  assert.equal(p.interviewsDir, join('C:\\work\\project', '.intent', 'interviews'))
  assert.equal(p.interviewFile('INTERVIEW-001'), join('C:\\work\\project', '.intent', 'interviews', 'INTERVIEW-001.json'))
})

test('createInterview persists structured interview data', () => {
  const root = tempRoot()

  const created = createInterview(root, {
    title: 'Order cancellation',
    goal: 'Preserve inventory and payment invariants.',
    why: 'Cancellation currently leaks reservations.',
    context: ['Existing orders use a state machine.'],
    constraints: ['Refunds are asynchronous.'],
    allowedScope: ['src/orders/**'],
    forbiddenScope: ['src/payments/**'],
    successCriteria: ['Reserved inventory is released once.'],
    failureCriteria: ['Duplicate refunds are possible.'],
    verification: ['Run order integration tests.'],
    consideredOptions: ['Compensating transaction.'],
    nonGoals: ['Redesign payments.'],
    assumptions: ['Gateway supports idempotency keys.'],
    openQuestions: ['Who owns retry policy?'],
  })

  assert.equal(created.interviewId, 'INTERVIEW-001')
  assert.equal(created.why, 'Cancellation currently leaks reservations.')
  assert.deepEqual(created.allowedScope, ['src/orders/**'])
  assert.equal(existsSync(paths(root).interviewFile(created.interviewId)), true)
  assert.equal(findInterview(root, created.interviewId)?.goal, created.goal)
  assert.deepEqual(loadInterviews(root).map((item) => item.interviewId), ['INTERVIEW-001'])
})

test('approved interview content is immutable but downstream lineage is append-only', () => {
  const root = tempRoot()
  const created = createInterview(root, { title: 'Lineage', goal: 'Keep the chain.' })
  const approved = approveInterview(root, created.interviewId, 'hyohyeon')

  assert.equal(approved.status, 'approved')
  assert.equal(approved.approvedBy, 'hyohyeon')
  assert.match(approved.approvedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.throws(
    () => updateInterview(root, created.interviewId, (current) => ({ ...current, goal: 'mutated' })),
    /approved interview .* content is immutable/,
  )

  const linked = linkInterview(root, created.interviewId, {
    intentId: 'INT-001',
    specSlug: 'spec-lineage',
    planId: 'PLAN-001',
    runId: 'RUN-001',
  })
  assert.equal(linked.intentId, 'INT-001')
  assert.equal(linked.planId, 'PLAN-001')
  assert.throws(
    () => linkInterview(root, created.interviewId, { planId: 'PLAN-002' }),
    /interview lineage planId is already PLAN-001/,
  )
})
