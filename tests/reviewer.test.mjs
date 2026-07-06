import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContract } from '../dist/src/runtime/contracts.js'
import { createDetection } from '../dist/src/runtime/detections.js'
import { buildReviewerChecklist } from '../dist/src/runtime/reviewer.js'
import { appendRunEvidence, createRun, updateRun } from '../dist/src/runtime/runs.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-reviewer-'))
}

function intent(over = {}) {
  return {
    id: 'INT-001',
    what: 'Add reviewer checklist',
    why: 'make human review faster',
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

function evidence(over = {}) {
  return {
    evidenceId: 'VE-001',
    type: 'typecheck',
    status: 'passed',
    command: 'npm.cmd',
    args: ['run', 'typecheck'],
    exitCode: 0,
    logPath: '.intent/raw/typecheck-results/RUN-001.log',
    startedAt: 't',
    finishedAt: 't',
    ...over,
  }
}

test('buildReviewerChecklist renders a passing contract-backed run', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Review passing run', intentId: 'INT-001', phase: 'verify' })
  const contract = createContract(root, { runId: run.runId, intent: intent() })
  updateRun(root, run.runId, (current) => ({
    ...current,
    contractId: contract.contractId,
    requiredEvidenceTypes: contract.requiredChecks,
  }))
  appendRunEvidence(root, run.runId, evidence())
  appendRunEvidence(
    root,
    run.runId,
    evidence({
      evidenceId: 'VE-002',
      type: 'unit_test',
      command: 'npm.cmd',
      args: ['test'],
      logPath: '.intent/raw/unit_test-results/RUN-001.log',
    }),
  )

  const checklist = buildReviewerChecklist(root, run.runId)

  assert.match(checklist, /^# Reviewer Checklist: RUN-001/m)
  assert.match(checklist, /- \[ \] Contract reviewed: CONTRACT-001/)
  assert.match(checklist, /- \[ \] Allowed scope: src\/\*\*/)
  assert.match(checklist, /- \[ \] DoD: typecheck passes/)
  assert.match(checklist, /- \[x\] typecheck: passed via `npm\.cmd run typecheck`/)
  assert.match(checklist, /- \[x\] unit_test: passed via `npm\.cmd test`/)
  assert.match(checklist, /- \[x\] No detections for this run\./)
})

test('buildReviewerChecklist surfaces failed required evidence and candidate detections', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Review failed run' })
  updateRun(root, run.runId, (current) => ({ ...current, requiredEvidenceTypes: ['unit_test'] }))
  appendRunEvidence(
    root,
    run.runId,
    evidence({
      type: 'unit_test',
      status: 'failed',
      command: 'npm.cmd',
      args: ['test'],
      exitCode: 1,
      logPath: '.intent/raw/unit_test-results/RUN-001-fail.log',
    }),
  )
  createDetection(root, {
    type: 'false_success',
    runId: run.runId,
    title: 'Completion without tests',
    summary: 'The run tried to complete without passing unit tests.',
  })

  const checklist = buildReviewerChecklist(root, run.runId)

  assert.match(checklist, /- \[ \] unit_test: failed via `npm\.cmd test`/)
  assert.match(checklist, /- \[ \] DET-001 candidate false_success: Completion without tests/)
})

test('buildReviewerChecklist marks missing required evidence on blocked runs', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Review blocked run', status: 'blocked' })
  updateRun(root, run.runId, (current) => ({
    ...current,
    requiredEvidenceTypes: ['typecheck', 'unit_test'],
  }))
  appendRunEvidence(root, run.runId, evidence())

  const checklist = buildReviewerChecklist(root, run.runId)

  assert.match(checklist, /- \[ \] Status reviewed: blocked/)
  assert.match(checklist, /- \[x\] typecheck: passed via `npm\.cmd run typecheck`/)
  assert.match(checklist, /- \[ \] unit_test: missing required evidence/)
  assert.match(checklist, /- \[ \] Contract reviewed: none/)
})
