import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDetection } from '../dist/src/runtime/detections.js'
import { buildJudgeInputBundle } from '../dist/src/runtime/judge.js'
import { appendSpanToRun } from '../dist/src/runtime/observability.js'
import { appendRunEvidence, createRun } from '../dist/src/runtime/runs.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-judge-'))
}

function evidence(over = {}) {
  return {
    evidenceId: 'VE-001',
    type: 'unit_test',
    status: 'passed',
    command: 'npm.cmd',
    args: ['test'],
    exitCode: 0,
    logPath: '.intent/raw/unit_test-results/RUN-001-pass.log',
    startedAt: 't',
    finishedAt: 't',
    ...over,
  }
}

test('buildJudgeInputBundle returns compact detection, evidence, log, and span context', () => {
  const root = tempRoot()
  const run = createRun(root, {
    objective: 'Judge repeated failure',
    intentId: 'INT-001',
    phase: 'verify',
    notes: ['not included in judge bundle'],
  })
  appendRunEvidence(root, run.runId, evidence())
  appendRunEvidence(
    root,
    run.runId,
    evidence({
      evidenceId: 'VE-002',
      type: 'custom',
      status: 'failed',
      command: process.execPath,
      args: ['-e', 'process.exit(2)'],
      exitCode: 2,
      logPath: '.intent/raw/custom-results/RUN-001-fail.log',
    }),
  )
  appendSpanToRun(root, run.runId, {
    kind: 'run_check',
    name: 'verify unit_test',
    status: 'ok',
    attributes: { evidenceId: 'VE-001', logPath: '.intent/raw/unit_test-results/RUN-001-pass.log' },
  })
  appendSpanToRun(root, run.runId, {
    kind: 'run_check',
    name: 'verify custom',
    status: 'error',
    attributes: {
      evidenceId: 'VE-002',
      logPath: '.intent/raw/custom-results/RUN-001-fail.log',
      errorSignature: 'stable failure',
    },
  })
  const detection = createDetection(root, {
    type: 'thrashing',
    runId: run.runId,
    intentId: 'INT-001',
    title: 'Repeated custom failure',
    summary: 'The same command failed repeatedly.',
    evidenceRefs: [`span:${run.runId}:SPAN-002`, 'VE-002', '.intent/raw/custom-results/manual.log'],
    attributes: { count: 3 },
  })

  const bundle = buildJudgeInputBundle(root, detection.detectionId)

  assert.equal(bundle.detection.detectionId, detection.detectionId)
  assert.deepEqual(bundle.run, {
    runId: run.runId,
    intentId: 'INT-001',
    objective: 'Judge repeated failure',
    phase: 'verify',
    status: 'active',
    requiredEvidenceTypes: [],
  })
  assert.deepEqual(bundle.evidence.map((item) => item.evidenceId), ['VE-002'])
  assert.deepEqual(bundle.relatedLogPaths, [
    '.intent/raw/custom-results/manual.log',
    '.intent/raw/custom-results/RUN-001-fail.log',
  ])
  assert.deepEqual(bundle.trace.spanIds, ['SPAN-002'])
  assert.equal(bundle.trace.traceId, 'TRACE-RUN-001')
  assert.equal(bundle.trace.spans[0].attributes.errorSignature, 'stable failure')
})

test('buildJudgeInputBundle falls back to run evidence and spans for broad run refs', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Judge false success', requiredEvidenceTypes: ['typecheck', 'unit_test'] })
  appendRunEvidence(root, run.runId, evidence({ type: 'typecheck', logPath: '.intent/raw/typecheck-results/RUN-001.log' }))
  appendSpanToRun(root, run.runId, {
    kind: 'run_check',
    name: 'verify typecheck',
    status: 'ok',
    attributes: { logPath: '.intent/raw/typecheck-results/RUN-001.log' },
  })
  const detection = createDetection(root, {
    type: 'false_success',
    runId: run.runId,
    title: 'Completion attempted without unit tests',
    summary: 'Required unit_test evidence is missing.',
    evidenceRefs: [`run:${run.runId}`],
    attributes: { missingEvidenceTypes: ['unit_test'] },
  })

  const bundle = buildJudgeInputBundle(root, detection.detectionId)

  assert.deepEqual(bundle.evidence.map((item) => item.type), ['typecheck'])
  assert.deepEqual(bundle.trace.spanIds, ['SPAN-001'])
  assert.deepEqual(bundle.relatedLogPaths, ['.intent/raw/typecheck-results/RUN-001.log'])
  assert.deepEqual(bundle.evidenceRefs, [`run:${run.runId}`])
})
