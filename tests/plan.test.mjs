import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  archivePlan,
  approvePlan,
  createPlan,
  findPlan,
  loadPlans,
  revisePlan,
  updatePlan,
} from '../dist/src/runtime/plans.js'
import {
  PlanSchema,
  PlanStatusSchema,
  PlanVerificationCommandSchema,
} from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-plans-'))
}

test('PlanStatusSchema accepts the MVP plan lifecycle states', () => {
  assert.equal(PlanStatusSchema.parse('draft'), 'draft')
  assert.equal(PlanStatusSchema.parse('approved'), 'approved')
  assert.equal(PlanStatusSchema.parse('archived'), 'archived')
})

test('PlanVerificationCommandSchema stores structured verification commands', () => {
  const command = PlanVerificationCommandSchema.parse({
    type: 'unit_test',
    command: 'npm',
    args: ['test'],
  })

  assert.equal(command.type, 'unit_test')
  assert.deepEqual(command.args, ['test'])
})

test('PlanSchema preserves execution strategy fields and defaults optional collections', () => {
  const plan = PlanSchema.parse({
    planId: 'PLAN-001',
    title: 'Add monitor CLI',
    objective: 'Expose deterministic monitor checks to operators.',
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
  })

  assert.equal(plan.status, 'draft')
  assert.equal(plan.revision, 1)
  assert.equal(plan.supersedesPlanId, null)
  assert.equal(plan.approvedBy, null)
  assert.equal(plan.approvedAt, null)
  assert.equal(plan.problem, '')
  assert.equal(plan.intentId, null)
  assert.equal(plan.interviewId, null)
  assert.equal(plan.specSlug, null)
  assert.equal(plan.runId, null)
  assert.deepEqual(plan.allowedScope, ['**'])
  assert.deepEqual(plan.forbiddenScope, [])
  assert.deepEqual(plan.expectedChanges, [])
  assert.deepEqual(plan.researchRefs, [])
  assert.deepEqual(plan.implementationSteps, [])
  assert.deepEqual(plan.verificationCommands, [])
  assert.deepEqual(plan.definitionOfDone, [])
  assert.deepEqual(plan.risks, [])
})

test('approved Plan can be archived and cloned as an unlinked draft revision', () => {
  const root = tempRoot()
  const created = createPlan(root, {
    title: 'Original plan',
    intentId: 'INT-001',
    runId: 'RUN-001',
    implementationSteps: ['first step'],
  })
  approvePlan(root, created.planId, 'human')
  const archived = archivePlan(root, created.planId)
  const revised = revisePlan(root, archived.planId, 'Revised plan')

  assert.equal(archived.status, 'archived')
  assert.equal(revised.status, 'draft')
  assert.equal(revised.revision, 2)
  assert.equal(revised.supersedesPlanId, archived.planId)
  assert.equal(revised.runId, null)
  assert.deepEqual(revised.implementationSteps, ['first step'])
})

test('paths include .intent/plans locations', () => {
  const p = paths('C:\\work\\project')

  assert.equal(p.plansDir, join('C:\\work\\project', '.intent', 'plans'))
  assert.equal(p.planFile('PLAN-001'), join('C:\\work\\project', '.intent', 'plans', 'PLAN-001.json'))
})

test('createPlan writes PLAN-001 and loadPlans returns sorted valid plans', () => {
  const root = tempRoot()
  const first = createPlan(root, {
    title: 'Plan artifact',
    objective: 'Persist implementation strategy.',
    problem: 'RunState has only planId.',
    intentId: 'INT-001',
    interviewId: 'INTERVIEW-001',
    specSlug: 'spec-plan-artifact',
    runId: 'RUN-001',
    allowedScope: ['src/runtime/**', 'tests/**'],
    forbiddenScope: ['.intent/**'],
    expectedChanges: ['Add schema and paths'],
    researchRefs: ['docs/final-goal-phase-feature-spec.md'],
    implementationSteps: ['Add PlanSchema', 'Add path helper'],
    testStrategy: 'node:test schema/path coverage',
    verificationCommands: [{ type: 'typecheck', command: 'npm', args: ['run', 'typecheck'] }],
    definitionOfDone: ['typecheck passes'],
    risks: ['CLI deferred to next item'],
  })
  const second = createPlan(root, { title: 'Plan CLI' })

  assert.equal(first.planId, 'PLAN-001')
  assert.equal(second.planId, 'PLAN-002')
  assert.equal(existsSync(paths(root).planFile(first.planId)), true)
  assert.equal(findPlan(root, 'PLAN-001')?.title, 'Plan artifact')
  assert.deepEqual(loadPlans(root).map((plan) => plan.planId), ['PLAN-001', 'PLAN-002'])
  assert.deepEqual(first.allowedScope, ['src/runtime/**', 'tests/**'])
  assert.equal(first.interviewId, 'INTERVIEW-001')
  assert.deepEqual(first.verificationCommands[0].args, ['run', 'typecheck'])
})

test('updatePlan applies an immutable transform and refreshes updatedAt', () => {
  const root = tempRoot()
  const plan = createPlan(root, { title: 'Initial plan' })

  const updated = updatePlan(root, plan.planId, (existing) => ({
    ...existing,
    risks: [...existing.risks, 'deferred CLI ergonomics'],
  }))

  assert.equal(updated.planId, plan.planId)
  assert.deepEqual(updated.risks, ['deferred CLI ergonomics'])
  assert.notEqual(updated.updatedAt, plan.updatedAt)
})

test('approvePlan records human approval metadata and freezes the plan', () => {
  const root = tempRoot()
  const plan = createPlan(root, { title: 'Approval lifecycle' })

  const approved = approvePlan(root, plan.planId, 'hyohyeon')

  assert.equal(approved.status, 'approved')
  assert.equal(approved.approvedBy, 'hyohyeon')
  assert.match(approved.approvedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.throws(
    () => updatePlan(root, plan.planId, (existing) => ({ ...existing, risks: ['late mutation'] })),
    /approved plan .* is immutable/,
  )
})
