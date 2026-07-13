import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-command-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function setupProject() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Command tracing', 'observe shell commands', '--type', 'chore']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Trace command CLI']).status, 0)
  return project
}

test('intent command forwards output and records a run_command span', () => {
  const project = setupProject()

  const result = cli(project, ['command', '--', process.execPath, '-e', "process.stdout.write('wrapped-output')"])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /wrapped-output/)
  assert.match(result.stderr, /command exit=0/)
  const span = JSON.parse(
    readFileSync(join(project, '.intent', 'raw', 'observability', 'spans', 'TRACE-RUN-001-SPAN-001.json'), 'utf8'),
  )
  assert.equal(span.kind, 'run_command')
  assert.equal(span.attributes.exitCode, 0)
})

test('intent command returns the wrapped exit code after recording failure', () => {
  const project = setupProject()

  const result = cli(project, ['command', '--', process.execPath, '-e', "console.error('wrapped-fail'); process.exit(6)"])

  assert.equal(result.status, 6)
  assert.match(result.stderr, /wrapped-fail/)
  assert.match(result.stderr, /command exit=6/)
})
