import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function setupProject() {
  const project = mkdtempSync(join(tmpdir(), 'intent-codex-hook-'))
  const cli = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  const result = spawnSync(process.execPath, [cli, 'setup'], { cwd: project, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return project
}

function runCli(project, args) {
  const cli = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result
}

function runHook(name, payload) {
  const hook = join(process.cwd(), 'dist', 'hooks', name)
  return spawnSync(process.execPath, [hook], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  })
}

test('Codex apply_patch payload is blocked without an approved intent', () => {
  const project = setupProject()
  const result = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/new.ts
+export function run() {}
*** End Patch`,
    },
  })

  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.decision, 'block')
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(output.reason, /approved intent/)
})

test('Codex SessionStart receives structured additional context', () => {
  const project = setupProject()
  const result = runHook('session-start.js', { cwd: project })

  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.match(output.hookSpecificOutput.additionalContext, /\[intent\] session memory/)
})

test('Codex SessionStart includes active run context', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Session memory run', 'prove active run context', '--type', 'chore'])
  runCli(project, ['run', 'start', 'INT-001', 'Wire SessionStart context'])
  runCli(project, ['run', 'note', 'Next: add handoff active run'])

  const result = runHook('session-start.js', { cwd: project })

  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.match(output.hookSpecificOutput.additionalContext, /active run:/)
  assert.match(output.hookSpecificOutput.additionalContext, /RUN-001 \[active\/act\] Wire SessionStart context/)
  assert.match(output.hookSpecificOutput.additionalContext, /Next: add handoff active run/)
})

test('Codex apply_patch payload is blocked by active contract forbidden scope', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Contract guard', 'block forbidden scope', '--type', 'feature', '--scope', 'src/**'])
  runCli(project, ['run', 'start', 'INT-001', 'Wire contract guard'])
  runCli(project, ['contract', 'draft'])

  const contractFile = join(project, '.intent', 'contracts', 'CONTRACT-001.json')
  const contract = JSON.parse(readFileSync(contractFile, 'utf8'))
  writeFileSync(contractFile, JSON.stringify({ ...contract, forbiddenScope: ['src/secret/**'] }, null, 2) + '\n', 'utf8')

  const result = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/secret/token.ts
+export const token = 'nope'
*** End Patch`,
    },
  })

  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.decision, 'block')
  assert.match(output.reason, /\[contract gate\]/)
  assert.match(output.reason, /CONTRACT-001 forbids changes/)
  assert.match(output.reason, /forbiddenScope/)
})

test('Codex apply_patch payload records a pre-write span for checked edits', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Span pre-write', 'record checked edits', '--type', 'feature', '--scope', 'src/**'])
  runCli(project, ['run', 'start', 'INT-001', 'Wire pre-write spans'])

  const result = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/new.ts
+export function run() {}
*** End Patch`,
    },
  })

  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.decision, 'block')
  assert.match(output.reason, /approved intent/)

  const spanFile = join(project, '.intent', 'raw', 'observability', 'spans', 'TRACE-RUN-001-SPAN-001.json')
  const span = JSON.parse(readFileSync(spanFile, 'utf8'))
  assert.equal(span.kind, 'apply_patch')
  assert.equal(span.status, 'blocked')
  assert.equal(span.attributes.path, 'src/new.ts')
  assert.match(span.attributes.reason, /approved intent/)
})
