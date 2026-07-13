import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import {
  DetectionRecordSchema,
  DetectionResultSchema,
  DetectionTypeSchema,
} from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'

test('DetectionTypeSchema accepts the MVP detection types', () => {
  assert.equal(DetectionTypeSchema.parse('thrashing'), 'thrashing')
  assert.equal(DetectionTypeSchema.parse('false_success'), 'false_success')
})

test('DetectionResultSchema accepts the MVP detection results', () => {
  assert.equal(DetectionResultSchema.parse('candidate'), 'candidate')
  assert.equal(DetectionResultSchema.parse('confirmed'), 'confirmed')
  assert.equal(DetectionResultSchema.parse('dismissed'), 'dismissed')
})

test('DetectionRecordSchema stores candidate evidence and defaults optional fields', () => {
  const detection = DetectionRecordSchema.parse({
    detectionId: 'DET-001',
    type: 'thrashing',
    runId: 'RUN-001',
    intentId: 'INT-001',
    title: 'Repeated command failure',
    summary: 'npm test failed with the same exit code three times.',
    evidenceRefs: ['TRACE-RUN-001-SPAN-001', '.intent/raw/unit_test-results/RUN-001.log'],
    attributes: {
      command: 'npm.cmd test',
      exitCode: 1,
      count: 3,
    },
    createdAt: '2026-07-06T06:30:00.000Z',
    updatedAt: '2026-07-06T06:30:00.000Z',
  })

  assert.equal(detection.result, 'candidate')
  assert.deepEqual(detection.judge, {
    status: 'not_run',
    judgement: null,
    confidence: null,
    classification: null,
    suggestedAction: null,
    inputDigest: null,
    adapterKey: null,
    updatedAt: null,
  })
  assert.equal(detection.embedding, null)
  assert.equal(detection.resolution, null)
  assert.equal(detection.resolvedAt, null)
  assert.deepEqual(detection.evidenceRefs, [
    'TRACE-RUN-001-SPAN-001',
    '.intent/raw/unit_test-results/RUN-001.log',
  ])
  assert.equal(detection.attributes.count, 3)
})

test('paths include .intent/detections locations', () => {
  const p = paths('C:\\work\\project')

  assert.equal(p.detectionsDir, join('C:\\work\\project', '.intent', 'detections'))
  assert.equal(p.detectionFile('DET-001'), join('C:\\work\\project', '.intent', 'detections', 'DET-001.json'))
})
