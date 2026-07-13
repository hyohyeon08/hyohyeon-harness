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

function runHumanCli(project, args) {
  const cli = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8', env })
  assert.equal(result.status, 0, result.stderr)
  return result
}

function approveIntentFixture(project, id = 'INT-001') {
  const file = join(project, '.intent', 'intents', `${id}.json`)
  const intent = JSON.parse(readFileSync(file, 'utf8'))
  writeFileSync(
    file,
    JSON.stringify({ ...intent, status: 'approved', approvedBy: 'human', learnings: 'fixture learning' }, null, 2) + '\n',
    'utf8',
  )
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
  approveIntentFixture(project)
  runCli(project, ['run', 'start', 'INT-001', 'Wire contract guard'])
  runCli(project, ['contract', 'draft'])

  const contractFile = join(project, '.intent', 'contracts', 'CONTRACT-001.json')
  const contract = JSON.parse(readFileSync(contractFile, 'utf8'))
  writeFileSync(contractFile, JSON.stringify({ ...contract, forbiddenScope: ['src/secret/**'] }, null, 2) + '\n', 'utf8')

  const draftResult = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/secret/token.ts
+export const token = 'draft-does-not-enforce'
*** End Patch`,
    },
  })
  assert.equal(draftResult.status, 0, draftResult.stderr)
  assert.match(JSON.parse(draftResult.stdout).reason, /\[execution governance\]/)

  writeFileSync(
    contractFile,
    JSON.stringify({ ...contract, status: 'approved', approvedBy: 'human', approvedAt: 't', forbiddenScope: ['src/secret/**'] }, null, 2) + '\n',
    'utf8',
  )

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
  assert.equal(span.attributes.regionKey, 'src/new.ts:0')
  assert.match(span.attributes.reason, /approved intent/)
})

test('Codex Stop hook uses active contract evidence and records false_success detection', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Stop contract evidence', 'block missing evidence', '--type', 'feature', '--scope', 'src/**'])
  approveIntentFixture(project)
  runCli(project, ['run', 'start', 'INT-001', 'Wire stop hook contract'])
  runCli(project, ['contract', 'draft'])

  const result = runHook('stop-continue.js', { cwd: project })

  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.decision, 'block')
  assert.match(output.reason, /required evidence missing: typecheck/)

  const run = JSON.parse(readFileSync(join(project, '.intent', 'runs', 'RUN-001.json'), 'utf8'))
  const detection = JSON.parse(readFileSync(join(project, '.intent', 'detections', 'DET-001.json'), 'utf8'))
  assert.equal(run.status, 'blocked')
  assert.equal(detection.type, 'false_success')
  assert.deepEqual(detection.attributes.missingEvidenceTypes, ['typecheck', 'unit_test'])

  const second = runHook('stop-continue.js', { cwd: project })
  assert.equal(second.status, 0, second.stderr)
  const secondOutput = JSON.parse(second.stdout)
  assert.equal(secondOutput.decision, 'block')
  assert.match(secondOutput.reason, /required evidence missing: typecheck/)
})

test('Codex PostToolUse Bash hook records an observed run_command span', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Hook command trace', 'observe Bash output', '--type', 'chore'])
  runCli(project, ['run', 'start', 'INT-001', 'Wire command hook'])

  const result = runHook('post-command.js', {
    cwd: project,
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'npm test' },
    tool_response: { output: 'tests failed', exit_code: 1 },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  const span = JSON.parse(
    readFileSync(join(project, '.intent', 'raw', 'observability', 'spans', 'TRACE-RUN-001-SPAN-001.json'), 'utf8'),
  )
  assert.equal(span.kind, 'run_command')
  assert.equal(span.status, 'error')
  assert.equal(span.attributes.command, 'npm test')
  assert.equal(span.attributes.exitCode, 1)
})

test('Codex PreToolUse Bash hook blocks approval and direct intent-state writes', () => {
  const project = setupProject()
  const approval = runHook('pre-command-guard.js', {
    cwd: project,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: {
      command: 'env -u CODEX_THREAD_ID -u CODEX_SHELL intent approve INT-001',
    },
  })

  assert.equal(approval.status, 0, approval.stderr)
  assert.equal(JSON.parse(approval.stdout).decision, 'block')
  assert.match(JSON.parse(approval.stdout).reason, /human-only approval/)

  const directWrite = runHook('pre-command-guard.js', {
    cwd: project,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: {
      command: "printf '%s' approved > .intent/intents/INT-001.json",
    },
  })

  assert.equal(directWrite.status, 0, directWrite.stderr)
  assert.equal(JSON.parse(directWrite.stdout).decision, 'block')
  assert.match(JSON.parse(directWrite.stdout).reason, /protected \.intent state/)

  const readOnly = runHook('pre-command-guard.js', {
    cwd: project,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'intent status' },
  })
  assert.equal(readOnly.status, 0, readOnly.stderr)
  assert.equal(readOnly.stdout, '')
})

test('Codex write and Stop hooks fail closed on corrupt Intent state', () => {
  const project = setupProject()
  const intentsDir = join(project, '.intent', 'intents')
  writeFileSync(join(intentsDir, 'INT-001.json'), '{ corrupt', 'utf8')

  const write = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/corrupt-state.ts
+export function mustNotPass() {}
*** End Patch`,
    },
  })
  assert.equal(write.status, 0, write.stderr)
  const writeOutput = JSON.parse(write.stdout)
  assert.equal(writeOutput.decision, 'block')
  assert.match(writeOutput.reason, /\[intent state\]/)

  const stop = runHook('stop-continue.js', { cwd: project })
  assert.equal(stop.status, 0, stop.stderr)
  const stopOutput = JSON.parse(stop.stdout)
  assert.equal(stopOutput.decision, 'block')
  assert.match(stopOutput.reason, /\[intent state\]/)
})

test('Codex write and Stop hooks fail closed on corrupt linked Contract state', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Contract state', 'preserve linked contract policy', '--type', 'feature', '--scope', 'src/**'])
  approveIntentFixture(project)
  runCli(project, ['run', 'start', 'INT-001', 'Guard contract state'])
  runCli(project, ['contract', 'draft'])
  writeFileSync(join(project, '.intent', 'contracts', 'CONTRACT-001.json'), '{ corrupt', 'utf8')

  const write = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/corrupt-contract.ts
+export function mustNotPass() {}
*** End Patch`,
    },
  })
  assert.equal(write.status, 0, write.stderr)
  assert.match(JSON.parse(write.stdout).reason, /\[contract state\]/)

  const stop = runHook('stop-continue.js', { cwd: project })
  assert.equal(stop.status, 0, stop.stderr)
  assert.match(JSON.parse(stop.stdout).reason, /\[contract state\]/)
})

test('Codex write hook fails closed on corrupt Rule state', () => {
  const project = setupProject()
  writeFileSync(join(project, '.intent', 'rules', 'RULE-001.json'), '{ corrupt', 'utf8')

  const write = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/corrupt-rule.ts
+export function mustNotPass() {}
*** End Patch`,
    },
  })
  assert.equal(write.status, 0, write.stderr)
  assert.match(JSON.parse(write.stdout).reason, /\[rule state\]/)
})

test('Codex write and Stop hooks fail closed on corrupt Run state', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Run state', 'preserve governed run policy', '--type', 'feature', '--scope', 'src/**'])
  approveIntentFixture(project)
  runCli(project, ['run', 'start', 'INT-001', 'Guard run state'])
  writeFileSync(join(project, '.intent', 'runs', 'RUN-001.json'), '{ corrupt', 'utf8')

  const write = runHook('pre-write-guard.js', {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/corrupt-run.ts
+export function mustNotPass() {}
*** End Patch`,
    },
  })
  assert.equal(write.status, 0, write.stderr)
  assert.match(JSON.parse(write.stdout).reason, /\[run state\]/)

  const stop = runHook('stop-continue.js', { cwd: project })
  assert.equal(stop.status, 0, stop.stderr)
  assert.match(JSON.parse(stop.stdout).reason, /\[run state\]/)
})

test('Codex non-trivial feature write requires approved execution governance', () => {
  const project = setupProject()
  runCli(project, ['draft', 'Execution governance', 'require approved contract', '--type', 'feature', '--scope', 'src/**'])
  approveIntentFixture(project)
  runCli(project, ['run', 'start', 'INT-001', 'Guard feature writes'])

  const payload = {
    cwd: project,
    tool_name: 'apply_patch',
    tool_input: {
      patch: `*** Begin Patch
*** Add File: src/governed.ts
+export function governed() {}
*** End Patch`,
    },
  }
  const before = runHook('pre-write-guard.js', payload)
  assert.equal(before.status, 0, before.stderr)
  assert.match(JSON.parse(before.stdout).reason, /\[execution governance\].*phase plan/)

  runCli(project, ['plan', 'draft', 'Governed execution plan'])
  runHumanCli(project, ['plan', 'approve', 'PLAN-001'])
  runCli(project, ['run', 'phase', 'contract'])
  runCli(project, ['contract', 'draft'])
  runHumanCli(project, ['contract', 'approve', 'CONTRACT-001'])
  runCli(project, ['run', 'phase', 'act'])

  const after = runHook('pre-write-guard.js', payload)
  assert.equal(after.status, 0, after.stderr)
  assert.equal(after.stdout, '')
})
