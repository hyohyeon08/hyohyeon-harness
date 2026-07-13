import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recordObservedCommand, runCommand } from '../dist/src/runtime/commands.js'
import { listSpans } from '../dist/src/runtime/observability.js'
import { createRun } from '../dist/src/runtime/runs.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-commands-'))
}

test('runCommand records stdout, log, and an ok run_command span', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'trace commands' })

  const result = runCommand(root, {
    runId: run.runId,
    command: process.execPath,
    args: ['-e', "process.stdout.write('command-pass')"],
  })

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, 'command-pass')
  assert.equal(existsSync(join(root, result.logPath)), true)
  assert.match(readFileSync(join(root, result.logPath), 'utf8'), /command-pass/)
  const span = listSpans(root, run.runId)[0]
  assert.equal(span.kind, 'run_command')
  assert.equal(span.status, 'ok')
  assert.equal(span.attributes.exitCode, 0)
  assert.equal(span.attributes.logPath, result.logPath)
})

test('runCommand records failed commands with an error signature', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'trace failures' })

  const result = runCommand(root, {
    runId: run.runId,
    command: process.execPath,
    args: ['-e', "console.error('command-fail'); process.exit(7)"],
  })

  assert.equal(result.exitCode, 7)
  const span = listSpans(root, run.runId)[0]
  assert.equal(span.status, 'error')
  assert.equal(span.attributes.errorSignature, 'command-fail')
})

test('recordObservedCommand writes hook output without re-executing the command', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'trace hook output' })

  const result = recordObservedCommand(root, {
    runId: run.runId,
    command: 'npm test',
    exitCode: 1,
    stdout: 'not ok 1 - observed failure',
    stderr: '',
    source: 'codex-post-tool-use',
  })

  assert.equal(result.exitCode, 1)
  const span = listSpans(root, run.runId)[0]
  assert.equal(span.attributes.source, 'codex-post-tool-use')
  assert.equal(span.attributes.errorSignature, 'tap:not ok - observed failure')
})
