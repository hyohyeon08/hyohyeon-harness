import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDetection } from '../dist/src/runtime/detections.js'
import {
  draftEvalCaseFromDetection,
  findEvalCase,
  loadEvalCases,
} from '../dist/src/runtime/evals.js'
import {
  EvalCaseSchema,
  EvalCaseStatusSchema,
} from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-evals-'))
}

test('EvalCaseStatusSchema accepts the MVP eval lifecycle states', () => {
  assert.equal(EvalCaseStatusSchema.parse('draft'), 'draft')
  assert.equal(EvalCaseStatusSchema.parse('approved'), 'approved')
  assert.equal(EvalCaseStatusSchema.parse('archived'), 'archived')
})

test('EvalCaseSchema stores a false_success regression fixture and defaults optional fields', () => {
  const evalCase = EvalCaseSchema.parse({
    evalId: 'EVAL-001',
    trigger: 'false_success',
    title: 'Completion requires unit tests',
    summary: 'A run should not complete while unit_test evidence is missing.',
    input: {
      runId: 'RUN-001',
      missingEvidenceTypes: ['unit_test'],
    },
    expected: {
      shouldBlockCompletion: true,
      requiredEvidenceTypes: ['unit_test'],
    },
    evidenceRefs: ['DET-001', 'run:RUN-001'],
    createdAt: '2026-07-06T07:00:00.000Z',
    updatedAt: '2026-07-06T07:00:00.000Z',
  })

  assert.equal(evalCase.status, 'draft')
  assert.equal(evalCase.sourceDetectionId, null)
  assert.equal(evalCase.trigger, 'false_success')
  assert.deepEqual(evalCase.tags, [])
  assert.deepEqual(evalCase.input.missingEvidenceTypes, ['unit_test'])
  assert.equal(evalCase.expected.shouldBlockCompletion, true)
})

test('paths include .intent/evals locations', () => {
  const p = paths('C:\\work\\project')

  assert.equal(p.evalsDir, join('C:\\work\\project', '.intent', 'evals'))
  assert.equal(p.evalCaseFile('EVAL-001'), join('C:\\work\\project', '.intent', 'evals', 'EVAL-001.json'))
})

test('draftEvalCaseFromDetection creates a false_success eval draft', () => {
  const root = tempRoot()
  const detection = createDetection(root, {
    type: 'false_success',
    runId: 'RUN-001',
    intentId: 'INT-001',
    title: 'Completion without unit tests',
    summary: 'Completion was attempted while unit_test evidence was missing.',
    evidenceRefs: ['run:RUN-001'],
    attributes: {
      missingEvidenceTypes: ['unit_test'],
    },
  })

  const evalCase = draftEvalCaseFromDetection(root, detection.detectionId)

  assert.equal(evalCase.evalId, 'EVAL-001')
  assert.equal(evalCase.status, 'draft')
  assert.equal(evalCase.sourceDetectionId, detection.detectionId)
  assert.equal(evalCase.trigger, 'false_success')
  assert.equal(evalCase.title, 'Regression: Completion without unit tests')
  assert.equal(evalCase.input.detectionId, detection.detectionId)
  assert.deepEqual(evalCase.expected.missingEvidenceTypes, ['unit_test'])
  assert.equal(evalCase.expected.shouldBlockCompletion, true)
  assert.deepEqual(evalCase.evidenceRefs, [`detection:${detection.detectionId}`, 'run:RUN-001'])
  assert.deepEqual(evalCase.tags, ['detection', 'false_success'])
  assert.equal(existsSync(paths(root).evalCaseFile(evalCase.evalId)), true)
  assert.equal(findEvalCase(root, evalCase.evalId)?.evalId, evalCase.evalId)
  assert.deepEqual(loadEvalCases(root).map((item) => item.evalId), ['EVAL-001'])
})

test('draftEvalCaseFromDetection creates a thrashing eval draft', () => {
  const root = tempRoot()
  const detection = createDetection(root, {
    type: 'thrashing',
    runId: 'RUN-001',
    title: 'Repeated error signature',
    summary: 'The same error signature repeated across commands.',
    evidenceRefs: ['span:RUN-001:SPAN-001'],
    attributes: {
      count: 3,
      errorSignature: 'stable failure',
    },
  })

  const evalCase = draftEvalCaseFromDetection(root, detection.detectionId)

  assert.equal(evalCase.trigger, 'thrashing')
  assert.equal(evalCase.expected.shouldDetectThrashing, true)
  assert.equal(evalCase.expected.count, 3)
  assert.equal(evalCase.expected.errorSignature, 'stable failure')
  assert.deepEqual(evalCase.tags, ['detection', 'thrashing'])
})
