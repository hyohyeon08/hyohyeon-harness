import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-contract-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
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

test('intent contract show prints scope, required checks, and definition of done', () => {
  const project = setupProject()
  assert.equal(cli(project, ['contract', 'draft']).status, 0)

  const result = cli(project, ['contract', 'show', 'CONTRACT-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /CONTRACT-001 \[draft\] RUN-001 INT-001/)
  assert.match(result.stdout, /allowed scope:\s+- src\/\*\*\s+- tests\/\*\*/)
  assert.match(result.stdout, /required checks:\s+- typecheck\s+- unit_test/)
  assert.match(result.stdout, /definition of done:\s+- typecheck passes\s+- tests pass/)
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
