import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-contract-cli-'))
}

function humanEnv() {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  return env
}

function codexEnv() {
  return { ...humanEnv(), CODEX_THREAD_ID: 'agent-thread' }
}

function cli(project, args, env = humanEnv()) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8', env })
}

function setupProject() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(
    cli(project, [
      'draft',
      'Track Contract CLI',
      'exercise contract command',
      '--type',
      'feature',
      '--scope',
      'src/**,tests/**',
      '--dod',
      'typecheck passes',
      '--dod',
      'tests pass',
    ]).status,
    0,
  )
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire contract CLI']).status, 0)
  assert.equal(cli(project, ['plan', 'draft', 'Contract execution plan']).status, 0)
  assert.equal(cli(project, ['plan', 'approve', 'PLAN-001'], codexEnv()).status, 0)
  return project
}

function readJson(project, path) {
  return JSON.parse(readFileSync(join(project, ...path), 'utf8'))
}

test('intent contract draft creates a contract for the active run and links it back to the run', () => {
  const project = setupProject()

  const result = cli(project, ['contract', 'draft'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /contract drafted CONTRACT-001 for RUN-001 \(INT-001\)/)
  assert.match(result.stdout, /required: typecheck, unit_test/)

  const contract = readJson(project, ['.intent', 'contracts', 'CONTRACT-001.json'])
  assert.equal(contract.runId, 'RUN-001')
  assert.equal(contract.intentId, 'INT-001')
  assert.deepEqual(contract.allowedScope, ['src/**', 'tests/**'])
  assert.deepEqual(contract.definitionOfDone, ['typecheck passes', 'tests pass'])

  const run = readJson(project, ['.intent', 'runs', 'RUN-001.json'])
  assert.equal(run.contractId, 'CONTRACT-001')
})

test('intent contract show separates machine policy from reviewer metadata', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)
  assert.equal(
    cli(project, [
      'contract',
      'edit',
      'CONTRACT-001',
      '--forbid',
      'dist/**',
      '--boundary',
      'runtime schemas stay zod-validated',
      '--stop',
      'pause when evidence is ambiguous',
      '--decision',
      'select public CLI names',
      '--rubric',
      'risk=2',
    ]).status,
    0,
  )

  const result = cli(project, ['contract', 'show', 'CONTRACT-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /CONTRACT-001 \[draft\] RUN-001 INT-001/)
  assert.match(result.stdout, /machine-enforced policy \(active only when approved and linked\):/)
  assert.match(result.stdout, /status: draft/)
  assert.match(result.stdout, /lineage: run=RUN-001 intent=INT-001 revision=1 supersedes=—/)
  assert.match(result.stdout, /allowed scope:\s+- src\/\*\*\s+- tests\/\*\*/)
  assert.match(result.stdout, /forbidden scope:\s+- dist\/\*\*/)
  assert.match(result.stdout, /required checks:\s+- typecheck\s+- unit_test/)
  assert.match(result.stdout, /reviewer metadata \(not automatic completion gates\):/)
  assert.match(result.stdout, /architecture boundaries:\s+- runtime schemas stay zod-validated/)
  assert.match(result.stdout, /definition of done:\s+- typecheck passes\s+- tests pass/)
  assert.match(result.stdout, /rubric:\s+- risk: 2/)
  assert.match(result.stdout, /stop conditions:\s+- pause when evidence is ambiguous/)
  assert.match(result.stdout, /requires user decision:\s+- select public CLI names/)
})

test('intent contract approve records the Codex actor', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)

  const result = cli(project, ['contract', 'approve', 'CONTRACT-001'], codexEnv())

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /approved CONTRACT-001/)
  const contract = readJson(project, ['.intent', 'contracts', 'CONTRACT-001.json'])
  assert.equal(contract.status, 'approved')
  assert.equal(contract.approvedBy, 'agent:codex')
  assert.match(contract.approvedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('intent contract archive and revise pauses the Run on a new draft revision', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)
  assert.equal(cli(project, ['contract', 'approve', 'CONTRACT-001'], codexEnv()).status, 0)
  assert.equal(cli(project, ['contract', 'archive', 'CONTRACT-001'], codexEnv()).status, 0)
  const pausedRun = readJson(project, ['.intent', 'runs', 'RUN-001.json'])
  assert.equal(pausedRun.contractId, null)
  assert.equal(pausedRun.phase, 'contract')
  const revised = cli(project, ['contract', 'revise', 'CONTRACT-001'])

  assert.equal(revised.status, 0, revised.stderr)
  const record = readJson(project, ['.intent', 'contracts', 'CONTRACT-002.json'])
  const run = readJson(project, ['.intent', 'runs', 'RUN-001.json'])
  assert.equal(record.status, 'draft')
  assert.equal(record.revision, 2)
  assert.equal(record.supersedesContractId, 'CONTRACT-001')
  assert.equal(run.contractId, 'CONTRACT-002')
  assert.equal(run.phase, 'contract')
})

test('Codex can approve contracts and approved contracts cannot be edited', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)

  const agentApproval = cli(project, ['contract', 'approve', 'CONTRACT-001'], {
    ...codexEnv(),
  })
  assert.equal(agentApproval.status, 0, agentApproval.stderr)
  assert.equal(readJson(project, ['.intent', 'contracts', 'CONTRACT-001.json']).approvedBy, 'agent:codex')

  const edit = cli(project, ['contract', 'edit', 'CONTRACT-001', '--require', 'build'])
  assert.equal(edit.status, 1)
  assert.match(edit.stderr, /approved contract CONTRACT-001 is immutable/)
})

test('intent contract edit appends lifecycle fields and rubric scores', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)

  const result = cli(project, [
    'contract',
    'edit',
    'CONTRACT-001',
    '--require',
    'build',
    '--forbid',
    'dist/**',
    '--boundary',
    'runtime schemas stay zod-validated',
    '--stop',
    'blocked run requires human decision',
    '--decision',
    'approve public CLI names',
    '--rubric',
    'risk=2',
    '--rubric',
    'coverage=3',
  ])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /edited CONTRACT-001/)
  const contract = readJson(project, ['.intent', 'contracts', 'CONTRACT-001.json'])
  assert.deepEqual(contract.requiredChecks, ['typecheck', 'unit_test', 'build'])
  assert.deepEqual(contract.forbiddenScope, ['dist/**'])
  assert.deepEqual(contract.architectureBoundaries, ['runtime schemas stay zod-validated'])
  assert.deepEqual(contract.stopConditions, ['blocked run requires human decision'])
  assert.deepEqual(contract.requiresUserDecision, ['approve public CLI names'])
  assert.deepEqual(contract.rubric, { risk: 2, coverage: 3 })
})

test('intent contract report summarizes required check evidence', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)
  assert.equal(
    cli(project, [
      'contract',
      'edit',
      'CONTRACT-001',
      '--boundary',
      'runtime schemas stay zod-validated',
      '--stop',
      'pause when evidence is ambiguous',
      '--decision',
      'select public CLI names',
      '--rubric',
      'risk=2',
    ]).status,
    0,
  )
  assert.equal(cli(project, ['verify', 'typecheck', '--', process.execPath, '-e', 'process.exit(0)']).status, 0)

  const result = cli(project, ['contract', 'report', 'CONTRACT-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /contract report CONTRACT-001 \[draft\]/)
  assert.match(result.stdout, /machine-enforced policy \(active only when approved and linked\):/)
  assert.match(result.stdout, /typecheck: passed \(VE-001\)/)
  assert.match(result.stdout, /unit_test: missing/)
  assert.match(result.stdout, /reviewer metadata \(not automatic completion gates\):/)
  assert.match(result.stdout, /architecture boundaries:\s+- runtime schemas stay zod-validated/)
  assert.match(result.stdout, /definition of done:\s+- typecheck passes\s+- tests pass/)
  assert.match(result.stdout, /rubric:\s+- risk: 2/)
  assert.match(result.stdout, /stop conditions:\s+- pause when evidence is ambiguous/)
  assert.match(result.stdout, /requires user decision:\s+- select public CLI names/)
})

test('intent contract report uses the latest result for each required check', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)
  assert.equal(cli(project, ['verify', 'typecheck', '--', process.execPath, '-e', 'process.exit(0)']).status, 0)
  assert.equal(cli(project, ['verify', 'typecheck', '--', process.execPath, '-e', 'process.exit(7)']).status, 7)

  const result = cli(project, ['contract', 'report', 'CONTRACT-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /typecheck: failed \(VE-002\)/)
})

test('intent contract list prints contract summaries', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)

  const result = cli(project, ['contract', 'list'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /CONTRACT-001 \[draft\] RUN-001 INT-001/)
})

test('intent contract draft fails clearly without an active run', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)

  const result = cli(project, ['contract', 'draft'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /usage: intent contract draft/)
})
