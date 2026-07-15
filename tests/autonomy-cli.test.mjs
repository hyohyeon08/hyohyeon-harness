import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-autonomy-cli-'))
}

function cleanEnv() {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  return env
}

function codexEnv() {
  return { ...cleanEnv(), CODEX_THREAD_ID: 'agent-thread' }
}

function cli(project, args, env = cleanEnv()) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8', env })
}

function setupProject() {
  const project = projectRoot()
  const setup = cli(project, ['setup'])
  assert.equal(setup.status, 0, setup.stderr)
  return project
}

function readJson(project, path) {
  return JSON.parse(readFileSync(join(project, ...path), 'utf8'))
}

test('Codex can approve an intent and records truthful approval provenance', () => {
  const project = setupProject()
  assert.equal(cli(project, ['draft', 'Autonomous intent', 'remove manual approval']).status, 0)

  const approved = cli(project, ['approve', 'INT-001'], codexEnv())

  assert.equal(approved.status, 0, approved.stderr)
  const intent = readJson(project, ['.intent', 'intents', 'INT-001.json'])
  assert.equal(intent.status, 'approved')
  assert.equal(intent.approvedBy, 'agent:codex')
})

test('Codex can approve a gate rule and records truthful approval provenance', () => {
  const project = setupProject()
  assert.equal(cli(project, ['rule', 'draft', 'forbid-path', 'secrets/**', 'protect secrets']).status, 0)

  const approved = cli(project, ['rule', 'approve', 'RULE-001'], codexEnv())

  assert.equal(approved.status, 0, approved.stderr)
  const rule = readJson(project, ['.intent', 'rules', 'RULE-001.json'])
  assert.equal(rule.status, 'approved')
  assert.equal(rule.approvedBy, 'agent:codex')
})

test('Codex can approve a shared-understanding spec and records its actor', () => {
  const project = setupProject()
  assert.equal(cli(project, ['spec', 'draft', 'Autonomous Spec']).status, 0)

  const approved = cli(project, ['spec', 'approve', 'spec-autonomous-spec'], codexEnv())

  assert.equal(approved.status, 0, approved.stderr)
  const spec = readFileSync(
    join(project, '.intent', 'wiki', 'knowledge', 'spec-autonomous-spec.md'),
    'utf8',
  )
  assert.match(spec, /approved by agent:codex on \d{4}-\d{2}-\d{2}/)
})
