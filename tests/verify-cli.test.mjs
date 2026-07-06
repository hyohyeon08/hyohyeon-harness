import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-verify-cli-'))
}

function cli(project, args) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8' })
}

function setupProject() {
  const project = projectRoot()
  const setup = cli(project, ['setup'])
  assert.equal(setup.status, 0, setup.stderr)
  const draft = cli(project, ['draft', 'Track Verify CLI', 'exercise verify command', '--type', 'chore'])
  assert.equal(draft.status, 0, draft.stderr)
  const run = cli(project, ['run', 'start', 'INT-001', 'Wire verify CLI'])
  assert.equal(run.status, 0, run.stderr)
  return project
}

function readRun(project) {
  return JSON.parse(readFileSync(join(project, '.intent', 'runs', 'RUN-001.json'), 'utf8'))
}

function writeRun(project, run) {
  writeFileSync(join(project, '.intent', 'runs', 'RUN-001.json'), JSON.stringify(run, null, 2) + '\n', 'utf8')
}

function approveDraftIntent(project) {
  const file = join(project, '.intent', 'intents', 'INT-001.json')
  const intent = JSON.parse(readFileSync(file, 'utf8'))
  writeFileSync(file, JSON.stringify({ ...intent, status: 'approved', approvedBy: 'human' }, null, 2) + '\n', 'utf8')
}

test('intent verify preserves the command after -- and records passed evidence', () => {
  const project = setupProject()
  const commandText = "process.stdout.write('cli-pass')"

  const result = cli(project, ['verify', 'unit_test', '--', process.execPath, '-e', commandText])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /verify passed: RUN-001 unit_test exit=0/)
  assert.match(result.stdout, /log: \.intent\/raw\/unit_test-results\/RUN-001-/)

  const run = readRun(project)
  assert.equal(run.evidence.length, 1)
  assert.equal(run.evidence[0].status, 'passed')
  assert.equal(run.evidence[0].command, process.execPath)
  assert.deepEqual(run.evidence[0].args, ['-e', commandText])
  assert.equal(existsSync(join(project, run.evidence[0].logPath)), true)
  assert.match(readFileSync(join(project, run.evidence[0].logPath), 'utf8'), /cli-pass/)
})

test('intent verify returns the checked command exit code after recording failed evidence', () => {
  const project = setupProject()

  const result = cli(project, [
    'verify',
    'custom',
    '--',
    process.execPath,
    '-e',
    "console.error('cli-fail'); process.exit(7)",
  ])

  assert.equal(result.status, 7)
  assert.match(result.stdout, /verify failed: RUN-001 custom exit=7/)

  const run = readRun(project)
  assert.equal(run.evidence.length, 1)
  assert.equal(run.evidence[0].status, 'failed')
  assert.equal(run.evidence[0].exitCode, 7)
  assert.match(readFileSync(join(project, run.evidence[0].logPath), 'utf8'), /cli-fail/)
})

test('intent verify list prints active run evidence', () => {
  const project = setupProject()
  assert.equal(cli(project, ['verify', 'unit_test', '--', process.execPath, '-e', "process.stdout.write('listed')"]).status, 0)

  const result = cli(project, ['verify', 'list'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /VE-001  \[passed\]  unit_test  exit=0/)
  assert.match(result.stdout, /log: \.intent\/raw\/unit_test-results\/RUN-001-/)
})

test('intent verify fails clearly when there is no active run', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)

  const result = cli(project, ['verify', 'unit_test', '--', process.execPath, '-e', "process.exit(0)"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /no active run/)
})

test('intent verify requires -- before the command', () => {
  const project = setupProject()

  const result = cli(project, ['verify', 'unit_test', process.execPath, '-e', "process.exit(0)"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /usage: intent verify/)
})

test('intent complete checks active run required evidence', () => {
  const project = setupProject()
  approveDraftIntent(project)
  writeRun(project, { ...readRun(project), requiredEvidenceTypes: ['unit_test'] })

  const blocked = cli(project, ['complete', 'INT-001'])
  assert.equal(blocked.status, 1)
  assert.match(blocked.stderr, /required evidence missing: unit_test/)

  const verify = cli(project, ['verify', 'unit_test', '--', process.execPath, '-e', "process.exit(0)"])
  assert.equal(verify.status, 0, verify.stderr)

  const completed = cli(project, ['complete', 'INT-001'])
  assert.equal(completed.status, 0, completed.stderr)
  assert.match(completed.stdout, /completed INT-001/)
})
