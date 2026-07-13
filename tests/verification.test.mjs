import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRun, findRun } from '../dist/src/runtime/runs.js'
import {
  RunStateSchema,
  VerificationEvidenceSchema,
  VerificationEvidenceStatusSchema,
  VerificationEvidenceTypeSchema,
} from '../dist/src/runtime/schemas.js'
import { listSpans } from '../dist/src/runtime/observability.js'
import { extractErrorSignature, runVerification } from '../dist/src/runtime/verification.js'
import { paths } from '../dist/src/state/paths.js'
import { createRunContentFingerprint } from '../dist/src/runtime/provenance.js'
import { staleRequiredEvidenceTypes } from '../dist/src/runtime/completion.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-verification-'))
}

test('VerificationEvidenceTypeSchema accepts the MVP evidence types', () => {
  assert.equal(VerificationEvidenceTypeSchema.parse('typecheck'), 'typecheck')
  assert.equal(VerificationEvidenceTypeSchema.parse('build'), 'build')
  assert.equal(VerificationEvidenceTypeSchema.parse('lint'), 'lint')
  assert.equal(VerificationEvidenceTypeSchema.parse('unit_test'), 'unit_test')
  assert.equal(VerificationEvidenceTypeSchema.parse('integration_test'), 'integration_test')
  assert.equal(VerificationEvidenceTypeSchema.parse('e2e_test'), 'e2e_test')
  assert.equal(VerificationEvidenceTypeSchema.parse('custom'), 'custom')
})

test('VerificationEvidenceStatusSchema accepts pass and fail outcomes', () => {
  assert.equal(VerificationEvidenceStatusSchema.parse('passed'), 'passed')
  assert.equal(VerificationEvidenceStatusSchema.parse('failed'), 'failed')
})

test('VerificationEvidenceSchema stores structured command evidence and defaults args', () => {
  const evidence = VerificationEvidenceSchema.parse({
    evidenceId: 'VE-001',
    type: 'unit_test',
    status: 'passed',
    command: 'npm.cmd',
    exitCode: 0,
    logPath: '.intent/raw/unit_test-results/RUN-001-20260706T052200.log',
    startedAt: '2026-07-06T05:22:00.000Z',
    finishedAt: '2026-07-06T05:22:10.000Z',
  })

  assert.equal(evidence.evidenceId, 'VE-001')
  assert.equal(evidence.command, 'npm.cmd')
  assert.deepEqual(evidence.args, [])
  assert.equal(evidence.exitCode, 0)
  assert.equal(evidence.provenance, null)
})

test('RunStateSchema defaults verification evidence fields', () => {
  const run = RunStateSchema.parse({
    runId: 'RUN-001',
    objective: 'Add verification evidence',
    createdAt: '2026-07-06T05:22:00.000Z',
    updatedAt: '2026-07-06T05:22:00.000Z',
  })

  assert.deepEqual(run.evidence, [])
  assert.deepEqual(run.requiredEvidenceTypes, [])
})

test('RunStateSchema keeps verification evidence and required evidence types', () => {
  const run = RunStateSchema.parse({
    runId: 'RUN-002',
    objective: 'Keep evidence',
    requiredEvidenceTypes: ['typecheck', 'unit_test'],
    evidence: [
      {
        evidenceId: 'VE-001',
        type: 'typecheck',
        status: 'passed',
        command: 'npm.cmd',
        args: ['run', 'typecheck'],
        exitCode: 0,
        logPath: '.intent/raw/typecheck-results/RUN-002-20260706T052200.log',
        startedAt: '2026-07-06T05:22:00.000Z',
        finishedAt: '2026-07-06T05:22:04.000Z',
      },
    ],
    createdAt: '2026-07-06T05:22:00.000Z',
    updatedAt: '2026-07-06T05:22:04.000Z',
  })

  assert.deepEqual(run.requiredEvidenceTypes, ['typecheck', 'unit_test'])
  assert.equal(run.evidence[0].type, 'typecheck')
  assert.deepEqual(run.evidence[0].args, ['run', 'typecheck'])
})

test('paths include .intent/raw verification result locations', () => {
  const p = paths('C:\\work\\project')

  assert.equal(p.rawDir, join('C:\\work\\project', '.intent', 'raw'))
  assert.equal(
    p.verificationResultsDir('unit_test'),
    join('C:\\work\\project', '.intent', 'raw', 'unit_test-results'),
  )
})

test('extractErrorSignature returns the last non-empty stderr line', () => {
  const log = [
    '[verification] custom',
    '',
    '[stdout]',
    'not the signature',
    '',
    '[stderr]',
    '',
    'first failure line',
    '  final failure line  ',
    '',
  ].join('\n')

  assert.equal(extractErrorSignature(log), 'final failure line')
})

test('extractErrorSignature falls back to a TAP failure headline', () => {
  const log = [
    '[stdout]',
    'TAP version 13',
    'not ok 3 - computes the intent gate',
    '  ---',
    '',
    '[stderr]',
    '',
  ].join('\n')

  assert.equal(extractErrorSignature(log), 'tap:not ok - computes the intent gate')
})

test('runVerification records passed command output and appends evidence to the run', () => {
  const root = tempRoot()
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'app.ts'), 'export const value = 1\n', 'utf8')
  const run = createRun(root, { objective: 'Record passing evidence', requiredEvidenceTypes: ['unit_test'] })

  const evidence = runVerification(root, {
    runId: run.runId,
    type: 'unit_test',
    command: process.execPath,
    args: ['-e', "process.stdout.write('pass-output')"],
  })

  assert.equal(evidence.evidenceId, 'VE-001')
  assert.equal(evidence.status, 'passed')
  assert.equal(evidence.exitCode, 0)
  assert.equal(evidence.command, process.execPath)
  assert.deepEqual(evidence.args, ['-e', "process.stdout.write('pass-output')"])
  assert.match(evidence.logPath, /^\.intent\/raw\/unit_test-results\/RUN-001-/)
  assert.equal(existsSync(join(root, evidence.logPath)), true)
  assert.equal(evidence.provenance?.algorithm, 'sha256')
  assert.deepEqual(evidence.provenance?.files.map((file) => file.path), ['src/app.ts'])
  const log = readFileSync(join(root, evidence.logPath), 'utf8')
  assert.equal(log.includes(`cwd: ${root}`), true)
  assert.match(log, /pass-output/)

  const stored = findRun(root, run.runId)
  assert.equal(stored?.evidence.length, 1)
  assert.equal(stored?.evidence[0].logPath, evidence.logPath)

  writeFileSync(join(root, 'src', 'app.ts'), 'export const value = 2\n', 'utf8')
  const current = createRunContentFingerprint(root, stored)
  assert.deepEqual(staleRequiredEvidenceTypes(stored, null, [], current.digest), ['unit_test'])
})

test('runVerification records failed command output and keeps the failure evidence', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Record failing evidence' })

  const evidence = runVerification(root, {
    runId: run.runId,
    type: 'custom',
    command: process.execPath,
    args: ['-e', "console.error('fail-output'); process.exit(7)"],
  })

  assert.equal(evidence.status, 'failed')
  assert.equal(evidence.exitCode, 7)
  assert.match(evidence.logPath, /^\.intent\/raw\/custom-results\/RUN-001-/)
  assert.match(readFileSync(join(root, evidence.logPath), 'utf8'), /fail-output/)

  const stored = findRun(root, run.runId)
  assert.equal(stored?.evidence.length, 1)
  assert.equal(stored?.evidence[0].status, 'failed')
})

test('runVerification records an ok run_check span for passed commands', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Record passing command span' })

  const evidence = runVerification(root, {
    runId: run.runId,
    type: 'typecheck',
    command: process.execPath,
    args: ['-e', "process.stdout.write('typecheck-ok')"],
  })

  const spans = listSpans(root, run.runId)
  assert.equal(spans.length, 1)
  assert.equal(spans[0].kind, 'run_check')
  assert.equal(spans[0].name, 'verify typecheck')
  assert.equal(spans[0].status, 'ok')
  assert.equal(spans[0].attributes.command, process.execPath)
  assert.deepEqual(spans[0].attributes.args, ['-e', "process.stdout.write('typecheck-ok')"])
  assert.equal(spans[0].attributes.evidenceStatus, 'passed')
  assert.equal(spans[0].attributes.exitCode, 0)
  assert.equal(spans[0].attributes.logPath, evidence.logPath)
})

test('runVerification records an error run_check span for failed commands', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Record failing command span' })

  const evidence = runVerification(root, {
    runId: run.runId,
    type: 'custom',
    command: process.execPath,
    args: ['-e', 'process.exit(4)'],
  })

  const spans = listSpans(root, run.runId)
  assert.equal(spans.length, 1)
  assert.equal(spans[0].kind, 'run_check')
  assert.equal(spans[0].name, 'verify custom')
  assert.equal(spans[0].status, 'error')
  assert.equal(spans[0].attributes.evidenceStatus, 'failed')
  assert.equal(spans[0].attributes.exitCode, 4)
  assert.equal(spans[0].attributes.logPath, evidence.logPath)
})

test('runVerification adds errorSignature to failed command spans', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Record failure signature' })

  runVerification(root, {
    runId: run.runId,
    type: 'custom',
    command: process.execPath,
    args: ['-e', "console.error('first failure'); console.error('stable failure'); process.exit(6)"],
  })

  const spans = listSpans(root, run.runId)
  assert.equal(spans[0].status, 'error')
  assert.equal(spans[0].attributes.errorSignature, 'stable failure')
})
