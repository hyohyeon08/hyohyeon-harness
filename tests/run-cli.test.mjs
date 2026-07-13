import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
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

function humanCli(project, args) {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8', env })
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

test('intent run start derives required evidence from the intent type', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Feature run', 'require behavior evidence', '--type', 'feature']).status, 0)

  const result = cli(project, ['run', 'start', 'INT-001', 'Feature evidence run'])
  const run = JSON.parse(readFileSync(join(project, '.intent', 'runs', 'RUN-001.json'), 'utf8'))

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(run.requiredEvidenceTypes, ['typecheck', 'unit_test'])
  assert.equal(run.phase, 'plan')
})

test('feature phase transitions require approved Plan and Contract', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Govern phases', 'enforce artifacts', '--type', 'feature']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Govern phase workflow']).status, 0)

  const earlyContract = cli(project, ['run', 'phase', 'contract'])
  assert.equal(earlyContract.status, 1)
  assert.match(earlyContract.stderr, /approved linked Plan/)

  assert.equal(cli(project, ['plan', 'draft', 'Governed plan']).status, 0)
  assert.equal(humanCli(project, ['plan', 'approve', 'PLAN-001']).status, 0)
  assert.equal(cli(project, ['run', 'phase', 'contract']).status, 0)

  const earlyAct = cli(project, ['run', 'phase', 'act'])
  assert.equal(earlyAct.status, 1)
  assert.match(earlyAct.stderr, /approved linked Contract/)

  assert.equal(cli(project, ['contract', 'draft']).status, 0)
  assert.equal(humanCli(project, ['contract', 'approve', 'CONTRACT-001']).status, 0)
  assert.equal(cli(project, ['run', 'phase', 'act']).status, 0)
})

test('feature completion requires the approved Contract chain and verify phase', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Complete governed feature', 'close the execution loop', '--type', 'feature']).status, 0)
  assert.equal(humanCli(project, ['approve', 'INT-001']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Complete governed feature']).status, 0)
  assert.equal(cli(project, ['plan', 'draft', 'Governed completion plan']).status, 0)
  assert.equal(humanCli(project, ['plan', 'approve', 'PLAN-001']).status, 0)
  assert.equal(cli(project, ['run', 'phase', 'contract']).status, 0)
  assert.equal(cli(project, ['contract', 'draft']).status, 0)
  assert.equal(humanCli(project, ['contract', 'approve', 'CONTRACT-001']).status, 0)
  assert.equal(cli(project, ['run', 'phase', 'act']).status, 0)
  assert.equal(cli(project, ['run', 'phase', 'verify']).status, 0)
  assert.equal(cli(project, ['learn', 'INT-001', 'Approved artifacts and fresh evidence close the loop.']).status, 0)
  assert.equal(cli(project, ['verify', 'typecheck', '--', process.execPath, '-e', 'process.exit(0)']).status, 0)
  assert.equal(cli(project, ['verify', 'unit_test', '--', process.execPath, '-e', 'process.exit(0)']).status, 0)

  const complete = cli(project, ['complete', 'INT-001'])
  assert.equal(complete.status, 0, complete.stderr)
  const run = JSON.parse(readFileSync(join(project, '.intent', 'runs', 'RUN-001.json'), 'utf8'))
  assert.equal(run.phase, 'done')
  assert.equal(run.status, 'passing')
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

test('intent run phase updates the active run phase', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run CLI']).status, 0)

  const phase = cli(project, ['run', 'phase', 'verify'])
  const status = cli(project, ['run', 'status'])

  assert.equal(phase.status, 0, phase.stderr)
  assert.match(phase.stdout, /phase RUN-001: verify/)
  assert.match(status.stdout, /RUN-001 \[active\/verify\] Wire run CLI/)
})

test('intent run phase permits verify rework but rejects phase rewinds and direct done', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run FSM']).status, 0)
  assert.equal(cli(project, ['run', 'phase', 'verify']).status, 0)

  const rework = cli(project, ['run', 'phase', 'act'])
  const rewind = cli(project, ['run', 'phase', 'plan'])
  const done = cli(project, ['run', 'phase', 'done'])

  assert.equal(rework.status, 0, rework.stderr)
  assert.equal(rewind.status, 1)
  assert.match(rewind.stderr, /invalid run phase transition: act -> plan/)
  assert.equal(done.status, 1)
  assert.match(done.stderr, /done is completion-gated/)
})

test('intent run status-set updates a specific run status', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run CLI']).status, 0)

  const result = cli(project, ['run', 'status-set', 'blocked', 'RUN-001'])
  const list = cli(project, ['run', 'list'])
  const active = cli(project, ['run', 'status'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /status RUN-001: blocked/)
  assert.match(list.stdout, /RUN-001  \[blocked\/act\]  Wire run CLI/)
  assert.match(active.stdout, /active run: none/)
})

test('intent run next updates nextAction', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run CLI']).status, 0)

  const result = cli(project, ['run', 'next', 'Run contract checks'])
  const status = cli(project, ['run', 'status'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /next RUN-001: Run contract checks/)
  assert.match(status.stdout, /next: Run contract checks/)
})

test('intent run budget and attempt block a run when attempts are exhausted', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run CLI']).status, 0)

  const budget = cli(project, ['run', 'budget', '2'])
  const first = cli(project, ['run', 'attempt', 'first try'])
  const second = cli(project, ['run', 'attempt', 'second try', 'RUN-001'])

  assert.equal(budget.status, 0, budget.stderr)
  assert.match(budget.stdout, /budget RUN-001: 0\/2 active/)
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /attempt RUN-001: 1\/2 active/)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /attempt RUN-001: 2\/2 blocked/)

  const run = JSON.parse(readFileSync(join(project, '.intent', 'runs', 'RUN-001.json'), 'utf8'))
  assert.equal(run.status, 'blocked')
  assert.deepEqual(run.budget, { maxAttempts: 2, attemptsUsed: 2 })
  assert.match(run.nextAction, /Attempt budget exhausted \(2\/2\)/)
  assert.deepEqual(run.notes, ['attempt 1/2: first try', 'attempt 2/2: second try'])
})

test('intent run phase rejects invalid phases', () => {
  const project = setupProject()
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire run CLI']).status, 0)

  const result = cli(project, ['run', 'phase', 'review'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /usage: intent run phase/)
})
