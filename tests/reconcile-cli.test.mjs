import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

test('intent reconcile dry-runs and applies derived Run index recovery', () => {
  const project = mkdtempSync(join(tmpdir(), 'intent-reconcile-cli-'))
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Recover state', 'rebuild index', '--type', 'chore']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Recover Run index']).status, 0)
  writeFileSync(join(project, '.intent', 'runs', 'latest-runs.json'), '{ corrupt', 'utf8')

  const dryRun = cli(project, ['reconcile'])
  assert.equal(dryRun.status, 0, dryRun.stderr)
  assert.match(dryRun.stdout, /reconcile dry-run/)
  assert.match(dryRun.stdout, /rebuild derived Run index/)

  const applied = cli(project, ['reconcile', '--apply'])
  assert.equal(applied.status, 0, applied.stderr)
  assert.match(applied.stdout, /reconcile applied/)
  assert.equal(cli(project, ['run', 'status']).status, 0)
})
