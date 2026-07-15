import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-plan-cli-'))
}

function humanEnv() {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  return env
}

function codexEnv() {
  return { ...humanEnv(), CODEX_THREAD_ID: 'agent-thread' }
}

function cli(project, args, env = humanEnv()) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8', env })
}

function readJson(project, path) {
  return JSON.parse(readFileSync(join(project, ...path), 'utf8'))
}

function setupProject() {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(
    cli(project, [
      'draft',
      'Plan CLI workflow',
      'exercise plan command',
      '--type',
      'feature',
      '--scope',
      'src/**,tests/**',
      '--dod',
      'plan exists',
    ]).status,
    0,
  )
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire plan CLI']).status, 0)
  return project
}

test('intent setup creates the plans directory', () => {
  const project = projectRoot()

  const result = cli(project, ['setup'])

  assert.equal(result.status, 0, result.stderr)
  assert.equal(readJson(project, ['.intent', 'state.json']).version, 1)
  assert.equal(existsSync(join(project, '.intent', 'plans')), true)
})

test('intent plan archive and revise creates an unlinked draft revision', () => {
  const project = setupProject()
  assert.equal(cli(project, ['plan', 'draft', 'Original plan']).status, 0)
  assert.equal(cli(project, ['plan', 'approve', 'PLAN-001'], codexEnv()).status, 0)
  assert.equal(cli(project, ['plan', 'archive', 'PLAN-001'], codexEnv()).status, 0)
  const pausedRun = readJson(project, ['.intent', 'runs', 'RUN-001.json'])
  assert.equal(pausedRun.planId, null)
  assert.equal(pausedRun.phase, 'plan')
  const revised = cli(project, ['plan', 'revise', 'PLAN-001', 'Revised plan'])

  assert.equal(revised.status, 0, revised.stderr)
  const record = readJson(project, ['.intent', 'plans', 'PLAN-002.json'])
  assert.equal(record.status, 'draft')
  assert.equal(record.revision, 2)
  assert.equal(record.supersedesPlanId, 'PLAN-001')
  assert.equal(record.runId, null)
})

test('intent plan draft writes a plan artifact with strategy fields', () => {
  const project = setupProject()

  const result = cli(project, [
    'plan',
    'draft',
    'Add plan artifacts',
    '--objective',
    'Persist implementation strategy.',
    '--problem',
    'RunState has only planId.',
    '--scope',
    'src/runtime/**,tests/**',
    '--forbid',
    '.intent/**',
    '--change',
    'Add PlanSchema',
    '--research',
    'docs/final-goal-phase-feature-spec.md',
    '--step',
    'Add schema tests',
    '--test-strategy',
    'node:test coverage',
    '--check',
    'typecheck:npm run typecheck',
    '--dod',
    'typecheck passes',
    '--risk',
    'CLI ergonomics may evolve',
  ])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /plan drafted PLAN-001/)

  const plan = readJson(project, ['.intent', 'plans', 'PLAN-001.json'])
  assert.equal(plan.title, 'Add plan artifacts')
  assert.equal(plan.objective, 'Persist implementation strategy.')
  assert.equal(plan.problem, 'RunState has only planId.')
  assert.equal(plan.intentId, 'INT-001')
  assert.equal(plan.runId, 'RUN-001')
  assert.deepEqual(plan.allowedScope, ['src/runtime/**', 'tests/**'])
  assert.deepEqual(plan.forbiddenScope, ['.intent/**'])
  assert.deepEqual(plan.expectedChanges, ['Add PlanSchema'])
  assert.deepEqual(plan.implementationSteps, ['Add schema tests'])
  assert.equal(plan.testStrategy, 'node:test coverage')
  assert.deepEqual(plan.verificationCommands, [{ type: 'typecheck', command: 'npm', args: ['run', 'typecheck'] }])
  assert.deepEqual(plan.definitionOfDone, ['typecheck passes'])
  assert.deepEqual(plan.risks, ['CLI ergonomics may evolve'])
  assert.equal(readJson(project, ['.intent', 'runs', 'RUN-001.json']).planId, 'PLAN-001')
})

test('intent plan show and list print plan summaries', () => {
  const project = setupProject()
  assert.equal(cli(project, ['plan', 'draft', 'Review plan', '--step', 'Inspect contract gate']).status, 0)

  const show = cli(project, ['plan', 'show', 'PLAN-001'])
  const list = cli(project, ['plan', 'list'])

  assert.equal(show.status, 0, show.stderr)
  assert.match(show.stdout, /PLAN-001 \[draft\] Review plan/)
  assert.match(show.stdout, /steps:\s+- Inspect contract gate/)
  assert.equal(list.status, 0, list.stderr)
  assert.match(list.stdout, /PLAN-001 \[draft\] Review plan/)
})

test('intent plan link connects a plan to the active run', () => {
  const project = setupProject()
  assert.equal(cli(project, ['plan', 'draft', 'Linked plan']).status, 0)

  const result = cli(project, ['plan', 'link', 'PLAN-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /linked PLAN-001 to RUN-001/)

  const run = readJson(project, ['.intent', 'runs', 'RUN-001.json'])
  const plan = readJson(project, ['.intent', 'plans', 'PLAN-001.json'])
  assert.equal(run.planId, 'PLAN-001')
  assert.equal(plan.runId, 'RUN-001')
  assert.equal(plan.intentId, 'INT-001')
})

test('intent plan approve records the Codex actor and prevents relinking', () => {
  const project = setupProject()
  assert.equal(cli(project, ['plan', 'draft', 'Approved plan']).status, 0)

  const approved = cli(project, ['plan', 'approve', 'PLAN-001'], codexEnv())
  const relink = cli(project, ['plan', 'link', 'PLAN-001'])
  const plan = readJson(project, ['.intent', 'plans', 'PLAN-001.json'])

  assert.equal(approved.status, 0, approved.stderr)
  assert.match(approved.stdout, /approved PLAN-001/)
  assert.equal(plan.status, 'approved')
  assert.equal(plan.approvedBy, 'agent:codex')
  assert.match(plan.approvedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(relink.status, 1)
  assert.match(relink.stderr, /approved plan PLAN-001 is immutable/)
})

test('Claude Code can approve a prepared plan and records its actor', () => {
  const project = setupProject()
  assert.equal(cli(project, ['plan', 'draft', 'Agent approves']).status, 0)

  const result = cli(project, ['plan', 'approve', 'PLAN-001'], { ...humanEnv(), CLAUDECODE: '1' })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(readJson(project, ['.intent', 'plans', 'PLAN-001.json']).approvedBy, 'agent:claude-code')
})
