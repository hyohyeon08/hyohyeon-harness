import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-spec-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function readJson(project, path) {
  return JSON.parse(readFileSync(join(project, ...path), 'utf8'))
}

function setupProject() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Spec CLI', 'exercise spec linking', '--type', 'feature']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire spec CLI']).status, 0)
  return project
}

test('intent spec draft links the drafted spec to the active run', () => {
  const project = setupProject()

  const result = cli(project, ['spec', 'draft', 'Order Cancel Flow'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /spec drafted: wiki\/spec-order-cancel-flow/)
  assert.match(result.stdout, /linked spec-order-cancel-flow to RUN-001/)
  assert.equal(readJson(project, ['.intent', 'runs', 'RUN-001.json']).specSlug, 'spec-order-cancel-flow')
})

test('intent spec link connects an existing spec to an explicit run', () => {
  const project = setupProject()
  assert.equal(cli(project, ['spec', 'draft', 'Checkout Flow']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Second run']).status, 0)

  const result = cli(project, ['spec', 'link', 'spec-checkout-flow', 'RUN-002'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /linked spec-checkout-flow to RUN-002/)
  assert.equal(readJson(project, ['.intent', 'runs', 'RUN-002.json']).specSlug, 'spec-checkout-flow')
})
