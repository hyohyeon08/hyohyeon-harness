import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-run-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function setupProject() {
  const project = projectRoot()
  const setup = cli(project, ['setup'])
  assert.equal(setup.status, 0, setup.stderr)
  const draft = cli(project, ['draft', 'Track Run CLI', 'exercise run command', '--type', 'chore'])
  assert.equal(draft.status, 0, draft.stderr)
  return project
}

test('intent run start creates an active run for an existing intent', () => {
  const project = setupProject()

  const result = cli(project, ['run', 'start', 'INT-001', 'Wire run CLI'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /started RUN-001/)
  assert.match(result.stdout, /INT-001/)
})

test('intent run status reports the active run', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run CLI']).status, 0)

  const result = cli(project, ['run', 'status'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /active run/)
  assert.match(result.stdout, /RUN-001 \[active\/act\] Wire run CLI/)
})

test('intent run list prints all runs in order', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'First run']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Second run']).status, 0)

  const result = cli(project, ['run', 'list'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /RUN-001  \[active\/act\]  First run/)
  assert.match(result.stdout, /RUN-002  \[active\/act\]  Second run/)
})

test('intent run note appends to the active run notes', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run CLI']).status, 0)

  const note = cli(project, ['run', 'note', 'Next: add SessionStart context'])
  const status = cli(project, ['run', 'status'])

  assert.equal(note.status, 0, note.stderr)
  assert.match(note.stdout, /noted RUN-001/)
  assert.match(status.stdout, /Next: add SessionStart context/)
})

test('intent run note fails when no active run exists', () => {
  const project = setupProject()

  const result = cli(project, ['run', 'note', 'no run yet'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /no active run/)
})
