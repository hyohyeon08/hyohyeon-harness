import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-reviewer-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function setupRun() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(
    cli(project, [
      'draft',
      'Reviewer CLI',
      'exercise reviewer command',
      '--type',
      'feature',
      '--scope',
      'src/**,tests/**',
      '--dod',
      'typecheck passes',
    ]).status,
    0,
  )
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire reviewer CLI']).status, 0)
  assert.equal(cli(project, ['contract', 'draft']).status, 0)
  assert.equal(cli(project, ['verify', 'typecheck', '--', process.execPath, '-e', 'process.exit(0)']).status, 0)
  return project
}

test('intent reviewer checklist prints the active run checklist', () => {
  const project = setupRun()

  const result = cli(project, ['reviewer', 'checklist'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^# Reviewer Checklist: RUN-001/m)
  assert.match(result.stdout, /- \[ \] Contract reviewed: CONTRACT-001/)
  assert.match(result.stdout, /- \[x\] typecheck: passed via/)
  assert.match(result.stdout, /- \[ \] unit_test: missing required evidence/)
})

test('intent reviewer checklist accepts an explicit run id', () => {
  const project = setupRun()

  const result = cli(project, ['reviewer', 'checklist', 'RUN-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^# Reviewer Checklist: RUN-001/m)
})
