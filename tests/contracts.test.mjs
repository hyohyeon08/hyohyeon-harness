import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  archiveContract,
  approveContract,
  checkContractScope,
  checkContractForbiddenScope,
  createContract,
  findContract,
  loadContracts,
  reviseContract,
  updateContract,
} from '../dist/src/runtime/contracts.js'
import { SprintContractSchema } from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'
import { approvePlan, createPlan } from '../dist/src/runtime/plans.js'
import { createRun, updateRun } from '../dist/src/runtime/runs.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-contracts-'))
}

function intent(over = {}) {
  return {
    id: 'INT-001',
    what: 'Add contracts',
    why: 'preserve evaluation criteria',
    type: 'feature',
    scope: ['src/**', 'tests/**'],
    dod: ['typecheck passes', 'tests pass'],
    dodChecked: [],
    status: 'approved',
    approvedBy: 'human',
    learnings: null,
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

test('SprintContractSchema defaults draft status and optional contract fields', () => {
  const contract = SprintContractSchema.parse({
    contractId: 'CONTRACT-001',
    runId: 'RUN-001',
    intentId: 'INT-001',
    createdAt: 't',
    updatedAt: 't',
  })

  assert.equal(contract.status, 'draft')
  assert.equal(contract.revision, 1)
  assert.equal(contract.supersedesContractId, null)
  assert.equal(contract.approvedBy, null)
  assert.equal(contract.approvedAt, null)
  assert.deepEqual(contract.allowedScope, ['**'])
  assert.deepEqual(contract.forbiddenScope, [])
  assert.deepEqual(contract.architectureBoundaries, [])
  assert.deepEqual(contract.requiredChecks, [])
  assert.deepEqual(contract.definitionOfDone, [])
  assert.deepEqual(contract.rubric, {})
  assert.deepEqual(contract.stopConditions, [])
  assert.deepEqual(contract.requiresUserDecision, [])
})

test('approved Contract can be archived and cloned as a same-Run draft revision', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'revise contract', intentId: 'INT-001' })
  const plan = createPlan(root, { title: 'Approved plan', runId: run.runId, intentId: 'INT-001' })
  approvePlan(root, plan.planId, 'human')
  updateRun(root, run.runId, (current) => ({ ...current, planId: plan.planId }))
  const created = createContract(root, { runId: run.runId, intent: intent() })
  approveContract(root, created.contractId, 'human')
  const archived = archiveContract(root, created.contractId)
  const revised = reviseContract(root, archived.contractId)

  assert.equal(archived.status, 'archived')
  assert.equal(revised.status, 'draft')
  assert.equal(revised.revision, 2)
  assert.equal(revised.supersedesContractId, archived.contractId)
  assert.equal(revised.runId, run.runId)
  assert.deepEqual(revised.requiredChecks, archived.requiredChecks)
})

test('paths include .intent/contracts location', () => {
  assert.equal(paths('C:\\work\\project').contractsDir, join('C:\\work\\project', '.intent', 'contracts'))
})

test('createContract writes a draft contract with defaults from the intent and test matrix', () => {
  const root = tempRoot()

  const contract = createContract(root, { runId: 'RUN-001', intent: intent() })

  assert.equal(contract.contractId, 'CONTRACT-001')
  assert.equal(contract.runId, 'RUN-001')
  assert.equal(contract.intentId, 'INT-001')
  assert.equal(contract.status, 'draft')
  assert.deepEqual(contract.allowedScope, ['src/**', 'tests/**'])
  assert.deepEqual(contract.definitionOfDone, ['typecheck passes', 'tests pass'])
  assert.deepEqual(contract.requiredChecks, ['typecheck', 'unit_test'])
  assert.equal(findContract(root, 'CONTRACT-001')?.contractId, 'CONTRACT-001')
})

test('createContract accepts explicit scope, checks, matrix, and boundaries', () => {
  const root = tempRoot()

  const contract = createContract(root, {
    runId: 'RUN-001',
    intent: intent({ type: 'chore' }),
    allowedScope: ['docs/**'],
    forbiddenScope: ['src/runtime/**'],
    architectureBoundaries: ['docs only'],
    requiredChecks: ['typecheck'],
    definitionOfDone: ['docs updated'],
    rubric: { risk: 2 },
    stopConditions: ['blocked run requires review'],
    requiresUserDecision: ['approve release note wording'],
    testMatrix: {
      typecheck: 'required',
      build: 'skipped',
      lint: 'optional',
      unit_test: 'skipped',
      integration_test: 'skipped',
      e2e_test: 'skipped',
      custom: 'skipped',
    },
  })

  assert.deepEqual(contract.allowedScope, ['docs/**'])
  assert.deepEqual(contract.forbiddenScope, ['src/runtime/**'])
  assert.deepEqual(contract.architectureBoundaries, ['docs only'])
  assert.deepEqual(contract.requiredChecks, ['typecheck'])
  assert.deepEqual(contract.definitionOfDone, ['docs updated'])
  assert.deepEqual(contract.rubric, { risk: 2 })
  assert.deepEqual(contract.stopConditions, ['blocked run requires review'])
  assert.deepEqual(contract.requiresUserDecision, ['approve release note wording'])
  assert.equal(contract.testMatrix.build, 'skipped')
})

test('loadContracts returns valid contract records sorted by id', () => {
  const root = tempRoot()
  createContract(root, { runId: 'RUN-001', intent: intent() })
  createContract(root, { runId: 'RUN-002', intent: intent({ id: 'INT-002', type: 'tidy' }) })
  writeFileSync(join(paths(root).contractsDir, 'not-a-contract.json'), '{}')

  assert.deepEqual(loadContracts(root).map((contract) => contract.contractId), ['CONTRACT-001', 'CONTRACT-002'])
})

test('approveContract records human approval metadata and freezes the contract', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'approve contract', intentId: 'INT-001' })
  const plan = createPlan(root, { title: 'Approved plan', runId: run.runId, intentId: 'INT-001' })
  approvePlan(root, plan.planId, 'hyohyeon')
  updateRun(root, run.runId, (current) => ({ ...current, planId: plan.planId }))
  const contract = createContract(root, { runId: run.runId, intent: intent() })

  const approved = approveContract(root, contract.contractId, 'hyohyeon')

  assert.equal(approved.status, 'approved')
  assert.equal(approved.approvedBy, 'hyohyeon')
  assert.match(approved.approvedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.throws(
    () => updateContract(root, contract.contractId, (existing) => ({ ...existing, requiredChecks: [] })),
    /approved contract .* is immutable/,
  )
})

test('approveContract rejects a contract without an approved linked plan', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'missing plan', intentId: 'INT-001' })
  const contract = createContract(root, { runId: run.runId, intent: intent() })

  assert.throws(() => approveContract(root, contract.contractId, 'hyohyeon'), /needs an approved linked plan/)
})

test('contract scope is enforced only after approval and includes allowedScope', () => {
  const draft = SprintContractSchema.parse({
    contractId: 'CONTRACT-001',
    runId: 'RUN-001',
    intentId: 'INT-001',
    allowedScope: ['src/**'],
    createdAt: 't',
    updatedAt: 't',
  })
  const approved = SprintContractSchema.parse({ ...draft, status: 'approved' })

  assert.equal(checkContractScope('docs/readme.md', draft).blocked, false)
  assert.equal(checkContractScope('src/app.ts', approved).blocked, false)
  const outside = checkContractScope('docs/readme.md', approved)
  assert.equal(outside.blocked, true)
  assert.match(outside.reason, /outside allowedScope/)
})

test('checkContractForbiddenScope blocks paths inside forbidden scope', () => {
  const contract = SprintContractSchema.parse({
    contractId: 'CONTRACT-001',
    runId: 'RUN-001',
    intentId: 'INT-001',
    status: 'approved',
    allowedScope: ['src/**'],
    forbiddenScope: ['src/secret/**'],
    createdAt: 't',
    updatedAt: 't',
  })

  const blocked = checkContractForbiddenScope('src/secret/token.ts', contract)
  assert.equal(blocked.blocked, true)
  assert.match(blocked.reason, /CONTRACT-001 forbids changes/)
  assert.match(blocked.reason, /forbiddenScope/)

  assert.equal(checkContractForbiddenScope('src/public/app.ts', contract).blocked, false)
})

test('contract forbidden scope wins even when allowed scope also matches', () => {
  const contract = SprintContractSchema.parse({
    contractId: 'CONTRACT-001',
    runId: 'RUN-001',
    intentId: 'INT-001',
    status: 'approved',
    allowedScope: ['src/**'],
    forbiddenScope: ['src/**'],
    createdAt: 't',
    updatedAt: 't',
  })

  assert.equal(checkContractForbiddenScope('src/app.ts', contract).blocked, true)
})
