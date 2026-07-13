import { test } from 'node:test'
import assert from 'node:assert/strict'
import { staleRequiredEvidenceTypes } from '../dist/src/runtime/completion.js'

function run(over = {}) {
  return {
    runId: 'RUN-001',
    objective: 'fresh evidence',
    phase: 'verify',
    status: 'active',
    intentId: 'INT-001',
    interviewId: null,
    specSlug: null,
    planId: null,
    contractId: null,
    nextAction: null,
    budget: { maxAttempts: 3, attemptsUsed: 0 },
    notes: [],
    requiredEvidenceTypes: ['unit_test'],
    evidence: [{
      evidenceId: 'VE-001',
      type: 'unit_test',
      status: 'passed',
      command: 'npm',
      args: ['test'],
      exitCode: 0,
      logPath: 'test.log',
      startedAt: '2026-07-10T00:00:00.000Z',
      finishedAt: '2026-07-10T00:01:00.000Z',
    }],
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:01:00.000Z',
    ...over,
  }
}

function editSpan(at) {
  return {
    spanId: 'SPAN-001',
    traceId: 'TRACE-RUN-001',
    runId: 'RUN-001',
    parentSpanId: null,
    kind: 'apply_patch',
    name: 'pre-write apply_patch',
    status: 'ok',
    attributes: { path: 'src/app.ts' },
    startedAt: at,
    endedAt: at,
  }
}

test('required evidence becomes stale after a later successful edit span', () => {
  assert.deepEqual(
    staleRequiredEvidenceTypes(run(), null, [editSpan('2026-07-10T00:02:00.000Z')]),
    ['unit_test'],
  )
})

test('evidence produced after the last edit remains fresh', () => {
  assert.deepEqual(
    staleRequiredEvidenceTypes(run(), null, [editSpan('2026-07-09T23:59:00.000Z')]),
    [],
  )
})

test('required evidence becomes stale when scoped content digest changes without an observed edit', () => {
  const withProvenance = run({
    evidence: [{
      ...run().evidence[0],
      provenance: {
        version: 1,
        algorithm: 'sha256',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        digest: 'old-digest',
        files: [],
      },
    }],
  })

  assert.deepEqual(staleRequiredEvidenceTypes(withProvenance, null, [], 'new-digest'), ['unit_test'])
})

test('legacy required evidence without provenance requires re-verification', () => {
  assert.deepEqual(staleRequiredEvidenceTypes(run(), null, [], 'current-digest'), ['unit_test'])
})
