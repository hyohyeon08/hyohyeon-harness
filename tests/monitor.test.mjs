import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDetections } from '../dist/src/runtime/detections.js'
import { appendSpanToRun } from '../dist/src/runtime/observability.js'
import {
  detectFalseSuccessOnCompletionAttempt,
  detectRepeatedCommandFailures,
  detectRepeatedErrorSignatures,
  detectRepeatedEditRegions,
  detectRepeatedFileEdits,
  detectRepeatedToolSequence,
  blockRunForDetections,
} from '../dist/src/runtime/monitor.js'
import { createRun } from '../dist/src/runtime/runs.js'
import { missingRequiredEvidenceTypes } from '../dist/src/runtime/stop-gate.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-monitor-'))
}

function intent(over = {}) {
  return {
    id: 'INT-001',
    what: 'Complete safely',
    why: 'avoid false success',
    type: 'feature',
    scope: ['**'],
    dod: ['done'],
    dodChecked: ['done'],
    status: 'approved',
    approvedBy: 'human',
    learnings: 'learned',
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

function evidence(over = {}) {
  return {
    evidenceId: 'VE-001',
    type: 'unit_test',
    status: 'passed',
    command: 'npm.cmd',
    args: ['test'],
    exitCode: 0,
    logPath: '.intent/raw/unit_test-results/RUN-001.log',
    startedAt: 't',
    finishedAt: 't',
    ...over,
  }
}

function run(over = {}) {
  return {
    runId: 'RUN-001',
    objective: 'Complete safely',
    phase: 'verify',
    status: 'active',
    intentId: 'INT-001',
    specSlug: null,
    planId: null,
    contractId: null,
    nextAction: null,
    notes: [],
    evidence: [],
    requiredEvidenceTypes: [],
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

function contract(over = {}) {
  return {
    contractId: 'CONTRACT-001',
    runId: 'RUN-001',
    intentId: 'INT-001',
    status: 'draft',
    allowedScope: ['**'],
    forbiddenScope: [],
    architectureBoundaries: [],
    testMatrix: {
      typecheck: 'optional',
      build: 'optional',
      lint: 'optional',
      unit_test: 'optional',
      integration_test: 'skipped',
      e2e_test: 'skipped',
      custom: 'skipped',
    },
    requiredChecks: ['typecheck', 'unit_test'],
    definitionOfDone: [],
    rubric: {},
    stopConditions: [],
    requiresUserDecision: [],
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

test('missingRequiredEvidenceTypes lists required checks without evidence', () => {
  const missing = missingRequiredEvidenceTypes(
    run({
      requiredEvidenceTypes: ['typecheck', 'unit_test'],
      evidence: [evidence({ type: 'typecheck' })],
    }),
  )

  assert.deepEqual(missing, ['unit_test'])
})

test('detectFalseSuccessOnCompletionAttempt writes a candidate for missing required evidence', () => {
  const root = tempRoot()

  const detection = detectFalseSuccessOnCompletionAttempt(
    root,
    intent(),
    run({ requiredEvidenceTypes: ['typecheck', 'unit_test'], evidence: [evidence({ type: 'typecheck' })] }),
  )

  assert.equal(detection?.detectionId, 'DET-001')
  assert.equal(detection?.type, 'false_success')
  assert.equal(detection?.result, 'candidate')
  assert.equal(detection?.runId, 'RUN-001')
  assert.deepEqual(detection?.attributes.missingEvidenceTypes, ['unit_test'])
  assert.deepEqual(detection?.evidenceRefs, ['intent:INT-001', 'run:RUN-001'])

  const path = join(root, '.intent', 'detections', 'DET-001.json')
  assert.equal(existsSync(path), true)
  assert.match(readFileSync(path, 'utf8'), /false_success/)
  assert.equal(loadDetections(root).length, 1)
})

test('detectFalseSuccessOnCompletionAttempt ignores satisfied evidence and unrelated runs', () => {
  const root = tempRoot()

  const satisfied = detectFalseSuccessOnCompletionAttempt(
    root,
    intent(),
    run({ requiredEvidenceTypes: ['unit_test'], evidence: [evidence()] }),
  )
  const unrelated = detectFalseSuccessOnCompletionAttempt(
    root,
    intent({ id: 'INT-002' }),
    run({ requiredEvidenceTypes: ['unit_test'] }),
  )

  assert.equal(satisfied, null)
  assert.equal(unrelated, null)
  assert.deepEqual(loadDetections(root), [])
})

test('detectFalseSuccessOnCompletionAttempt uses matching contract requiredChecks', () => {
  const root = tempRoot()

  const detection = detectFalseSuccessOnCompletionAttempt(
    root,
    intent(),
    run({ evidence: [evidence({ type: 'typecheck' })] }),
    contract(),
  )

  assert.equal(detection?.type, 'false_success')
  assert.deepEqual(detection?.attributes.missingEvidenceTypes, ['unit_test'])
})

test('detectRepeatedCommandFailures writes a thrashing candidate for three identical command failures', () => {
  const root = tempRoot()
  const active = createRun(root, { objective: 'Find repeated command failures' })
  for (const logPath of ['one.log', 'two.log', 'three.log']) {
    appendSpanToRun(root, active.runId, {
      kind: 'run_check',
      name: 'verify unit_test',
      status: 'error',
      attributes: {
        command: 'npm.cmd',
        args: ['test'],
        exitCode: 1,
        logPath,
      },
    })
  }

  const detections = detectRepeatedCommandFailures(root, active.runId)

  assert.equal(detections.length, 1)
  assert.equal(detections[0].type, 'thrashing')
  assert.equal(detections[0].result, 'candidate')
  assert.equal(detections[0].runId, active.runId)
  assert.equal(detections[0].attributes.command, 'npm.cmd')
  assert.deepEqual(detections[0].attributes.args, ['test'])
  assert.equal(detections[0].attributes.exitCode, 1)
  assert.equal(detections[0].attributes.count, 3)
  assert.deepEqual(detections[0].attributes.spanIds, ['SPAN-001', 'SPAN-002', 'SPAN-003'])
  assert.equal(loadDetections(root).length, 1)
})

test('detectRepeatedCommandFailures ignores failures below threshold or with different exit codes', () => {
  const root = tempRoot()
  const active = createRun(root, { objective: 'Ignore non-repeated failures' })
  appendSpanToRun(root, active.runId, {
    kind: 'run_check',
    name: 'verify unit_test',
    status: 'error',
    attributes: { command: 'npm.cmd', args: ['test'], exitCode: 1 },
  })
  appendSpanToRun(root, active.runId, {
    kind: 'run_check',
    name: 'verify unit_test',
    status: 'error',
    attributes: { command: 'npm.cmd', args: ['test'], exitCode: 2 },
  })
  appendSpanToRun(root, active.runId, {
    kind: 'run_check',
    name: 'verify unit_test',
    status: 'ok',
    attributes: { command: 'npm.cmd', args: ['test'], exitCode: 0 },
  })

  assert.deepEqual(detectRepeatedCommandFailures(root, active.runId), [])
  assert.deepEqual(loadDetections(root), [])
})

test('detectRepeatedErrorSignatures writes a thrashing candidate for repeated signatures across commands', () => {
  const root = tempRoot()
  const active = createRun(root, { objective: 'Find repeated signatures' })
  for (const [command, args] of [
    ['npm.cmd', ['test']],
    ['npm.cmd', ['run', 'typecheck']],
    [process.execPath, ['-e', 'process.exit(1)']],
  ]) {
    appendSpanToRun(root, active.runId, {
      kind: 'run_check',
      name: 'verify command',
      status: 'error',
      attributes: {
        command,
        args,
        exitCode: 1,
        errorSignature: 'Cannot find module stable',
      },
    })
  }

  const detections = detectRepeatedErrorSignatures(root, active.runId)

  assert.equal(detections.length, 1)
  assert.equal(detections[0].type, 'thrashing')
  assert.equal(detections[0].attributes.errorSignature, 'Cannot find module stable')
  assert.equal(detections[0].attributes.count, 3)
  assert.deepEqual(detections[0].attributes.spanIds, ['SPAN-001', 'SPAN-002', 'SPAN-003'])
  assert.deepEqual(detections[0].attributes.commands, ['npm.cmd', 'npm.cmd', process.execPath])
})

test('detectRepeatedErrorSignatures ignores blank signatures and below-threshold signatures', () => {
  const root = tempRoot()
  const active = createRun(root, { objective: 'Ignore weak signatures' })
  appendSpanToRun(root, active.runId, {
    kind: 'run_check',
    name: 'verify custom',
    status: 'error',
    attributes: { command: 'npm.cmd', exitCode: 1, errorSignature: '   ' },
  })
  appendSpanToRun(root, active.runId, {
    kind: 'run_check',
    name: 'verify custom',
    status: 'error',
    attributes: { command: 'npm.cmd', exitCode: 1, errorSignature: 'Only twice' },
  })
  appendSpanToRun(root, active.runId, {
    kind: 'run_check',
    name: 'verify custom',
    status: 'error',
    attributes: { command: 'node', exitCode: 1, errorSignature: 'Only twice' },
  })

  assert.deepEqual(detectRepeatedErrorSignatures(root, active.runId), [])
  assert.deepEqual(loadDetections(root), [])
})

test('detectRepeatedFileEdits writes a thrashing candidate for repeated edits to the same file', () => {
  const root = tempRoot()
  const active = createRun(root, { objective: 'Find repeated file edits' })
  for (const kind of ['apply_patch', 'edit', 'apply_patch', 'edit']) {
    appendSpanToRun(root, active.runId, {
      kind,
      name: `pre-write ${kind}`,
      status: 'ok',
      attributes: { path: 'src/runtime/monitor.ts' },
    })
  }

  const detections = detectRepeatedFileEdits(root, active.runId)

  assert.equal(detections.length, 1)
  assert.equal(detections[0].type, 'thrashing')
  assert.equal(detections[0].title, 'Repeated file edits')
  assert.equal(detections[0].attributes.path, 'src/runtime/monitor.ts')
  assert.equal(detections[0].attributes.count, 4)
  assert.deepEqual(detections[0].attributes.spanIds, ['SPAN-001', 'SPAN-002', 'SPAN-003', 'SPAN-004'])
})

test('general run_command failures feed repeated command and signature detection', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'trace general failures', intentId: 'INT-001' })
  for (let index = 0; index < 3; index++) {
    appendSpanToRun(root, run.runId, {
      kind: 'run_command',
      name: 'command npm test',
      status: 'error',
      attributes: {
        command: 'npm test',
        args: [],
        exitCode: 1,
        errorSignature: 'same general failure',
      },
    })
  }

  assert.equal(detectRepeatedCommandFailures(root, run.runId).length, 1)
  assert.equal(detectRepeatedErrorSignatures(root, run.runId).length, 1)
})

test('detectRepeatedEditRegions distinguishes the same file by line bucket', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'trace edit regions' })
  for (const regionKey of ['src/app.ts:1', 'src/app.ts:1', 'src/app.ts:4', 'src/app.ts:1']) {
    appendSpanToRun(root, run.runId, {
      kind: 'apply_patch',
      name: 'pre-write apply_patch',
      status: 'ok',
      attributes: { path: 'src/app.ts', regionKey },
    })
  }

  const detections = detectRepeatedEditRegions(root, run.runId)

  assert.equal(detections.length, 1)
  assert.equal(detections[0].title, 'Repeated edit region')
  assert.equal(detections[0].attributes.regionKey, 'src/app.ts:1')
  assert.equal(detections[0].attributes.count, 3)
})

test('detectRepeatedToolSequence finds repeated edit-failed-command cycles', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'trace tool sequence' })
  for (let index = 0; index < 3; index++) {
    appendSpanToRun(root, run.runId, {
      kind: 'edit',
      name: 'pre-write Edit',
      status: 'ok',
      attributes: { path: 'src/app.ts', regionKey: 'src/app.ts:1' },
    })
    appendSpanToRun(root, run.runId, {
      kind: 'run_command',
      name: 'command npm test',
      status: 'error',
      attributes: { command: 'npm test', args: [], exitCode: 1 },
    })
  }

  const detections = detectRepeatedToolSequence(root, run.runId)

  assert.equal(detections.length, 1)
  assert.equal(detections[0].title, 'Repeated tool sequence')
  assert.deepEqual(detections[0].attributes.pattern, ['edit:ok', 'run_command:error'])
  assert.equal(detections[0].attributes.repetitions, 3)
})

test('candidate detections do not hard-block a run until confirmed', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'separate candidate and verdict' })
  const candidate = {
    detectionId: 'DET-001',
    type: 'thrashing',
    result: 'candidate',
    runId: run.runId,
    intentId: null,
    title: 'Candidate only',
    summary: 'Needs semantic judgement.',
    evidenceRefs: [],
    attributes: {},
    judge: { status: 'not_run', judgement: null, confidence: null, classification: null, suggestedAction: null, inputDigest: null, adapterKey: null, updatedAt: null },
    embedding: null,
    resolution: null,
    createdAt: 't',
    updatedAt: 't',
    resolvedAt: null,
  }

  assert.equal(blockRunForDetections(root, run.runId, [candidate]), null)
  assert.equal(
    blockRunForDetections(root, run.runId, [{ ...candidate, detectionId: 'DET-002', type: 'false_success' }]),
    null,
  )
  const blocked = blockRunForDetections(root, run.runId, [{ ...candidate, result: 'confirmed' }])
  assert.equal(blocked.status, 'blocked')
})
