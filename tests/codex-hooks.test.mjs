import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
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
