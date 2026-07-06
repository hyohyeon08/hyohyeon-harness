import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkContractForbiddenScope,
  createContract,
  findContract,
  loadContracts,
} from '../dist/src/runtime/contracts.js'
import { SprintContractSchema } from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'

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
  assert.deepEqual(contract.allowedScope, ['**'])
  assert.deepEqual(contract.forbiddenScope, [])
  assert.deepEqual(contract.architectureBoundaries, [])
  assert.deepEqual(contract.requiredChecks, [])
  assert.deepEqual(contract.definitionOfDone, [])
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
  assert.equal(contract.testMatrix.build, 'skipped')
})

test('loadContracts returns valid contract records sorted by id', () => {
  const root = tempRoot()
  createContract(root, { runId: 'RUN-001', intent: intent() })
  createContract(root, { runId: 'RUN-002', intent: intent({ id: 'INT-002', type: 'tidy' }) })
  writeFileSync(join(paths(root).contractsDir, 'not-a-contract.json'), '{}')

  assert.deepEqual(loadContracts(root).map((contract) => contract.contractId), ['CONTRACT-001', 'CONTRACT-002'])
})

test('checkContractForbiddenScope blocks paths inside forbidden scope', () => {
  const contract = SprintContractSchema.parse({
    contractId: 'CONTRACT-001',
    runId: 'RUN-001',
    intentId: 'INT-001',
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
    allowedScope: ['src/**'],
    forbiddenScope: ['src/**'],
    createdAt: 't',
    updatedAt: 't',
  })

  assert.equal(checkContractForbiddenScope('src/app.ts', contract).blocked, true)
})
