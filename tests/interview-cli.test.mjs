import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-interview-cli-'))
}

function humanEnv() {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  return env
}

function cli(project, args, env = humanEnv()) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8', env })
}

function readJson(project, path) {
  return JSON.parse(readFileSync(join(project, ...path), 'utf8'))
}

test('intent interview draft/show/list persists a structured summary', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)

  const drafted = cli(project, [
    'interview',
    'draft',
    'Order cancellation',
    '--goal',
    'Agree on cancellation behavior.',
    '--why',
    'Prevent reservation leaks.',
    '--context',
    'Orders use a state machine.',
    '--constraint',
    'Refunds are asynchronous.',
    '--allow',
    'src/orders/**',
    '--forbid',
    'src/payments/**',
    '--success',
    'Inventory is released once.',
    '--failure',
    'Duplicate refunds occur.',
    '--verify',
    'Run order integration tests.',
    '--option',
    'Compensating transaction.',
    '--non-goal',
    'Redesign payments.',
    '--assumption',
    'Idempotency keys are supported.',
    '--question',
    'Who owns retry policy?',
  ])
  const shown = cli(project, ['interview', 'show', 'INTERVIEW-001'])
  const listed = cli(project, ['interview', 'list'])

  assert.equal(drafted.status, 0, drafted.stderr)
  assert.match(drafted.stdout, /interview drafted INTERVIEW-001/)
  assert.equal(shown.status, 0, shown.stderr)
  assert.match(shown.stdout, /INTERVIEW-001 \[draft\] Order cancellation/)
  assert.match(shown.stdout, /success criteria:\s+- Inventory is released once\./)
  assert.equal(listed.status, 0, listed.stderr)
  assert.match(listed.stdout, /INTERVIEW-001 \[draft\] Order cancellation/)
  assert.deepEqual(readJson(project, ['.intent', 'interviews', 'INTERVIEW-001.json']).allowedScope, ['src/orders/**'])
})

test('intent interview archive and revise creates a new draft revision', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['interview', 'draft', 'Original interview']).status, 0)
  assert.equal(cli(project, ['interview', 'approve', 'INTERVIEW-001']).status, 0)
  assert.equal(cli(project, ['interview', 'archive', 'INTERVIEW-001']).status, 0)
  const revised = cli(project, ['interview', 'revise', 'INTERVIEW-001', 'Revised interview'])

  assert.equal(revised.status, 0, revised.stderr)
  const record = readJson(project, ['.intent', 'interviews', 'INTERVIEW-002.json'])
  assert.equal(record.status, 'draft')
  assert.equal(record.revision, 2)
  assert.equal(record.supersedesInterviewId, 'INTERVIEW-001')
})

test('intent interview link updates Interview, Plan, and Run lineage', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['draft', 'Interview lineage', 'preserve goal context', '--type', 'feature']).status, 0)
  assert.equal(cli(project, ['run', 'start', 'INT-001', 'Wire interview lineage']).status, 0)
  assert.equal(cli(project, ['spec', 'draft', 'Interview Lineage']).status, 0)
  assert.equal(cli(project, ['plan', 'draft', 'Interview lineage plan']).status, 0)
  assert.equal(cli(project, ['interview', 'draft', 'Interview lineage', '--goal', 'Trace the source.']).status, 0)

  const linked = cli(project, [
    'interview',
    'link',
    'INTERVIEW-001',
    '--intent',
    'INT-001',
    '--spec',
    'spec-interview-lineage',
    '--plan',
    'PLAN-001',
    '--run',
    'RUN-001',
  ])

  assert.equal(linked.status, 0, linked.stderr)
  assert.match(linked.stdout, /linked INTERVIEW-001/)
  const interview = readJson(project, ['.intent', 'interviews', 'INTERVIEW-001.json'])
  const plan = readJson(project, ['.intent', 'plans', 'PLAN-001.json'])
  const run = readJson(project, ['.intent', 'runs', 'RUN-001.json'])
  assert.equal(interview.intentId, 'INT-001')
  assert.equal(interview.specSlug, 'spec-interview-lineage')
  assert.equal(interview.planId, 'PLAN-001')
  assert.equal(interview.runId, 'RUN-001')
  assert.equal(plan.interviewId, 'INTERVIEW-001')
  assert.equal(run.interviewId, 'INTERVIEW-001')
})

test('intent interview approve is human-only and records approval', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['interview', 'draft', 'Approval', '--goal', 'Confirm shared understanding.']).status, 0)

  const rejected = cli(project, ['interview', 'approve', 'INTERVIEW-001'], {
    ...humanEnv(),
    CODEX_THREAD_ID: 'agent-thread',
  })
  assert.equal(rejected.status, 1)
  assert.match(rejected.stderr, /interview approval is human-only/)

  const approved = cli(project, ['interview', 'approve', 'INTERVIEW-001'])
  assert.equal(approved.status, 0, approved.stderr)
  assert.match(approved.stdout, /approved INTERVIEW-001/)
  const summary = readJson(project, ['.intent', 'interviews', 'INTERVIEW-001.json'])
  assert.equal(summary.status, 'approved')
  assert.equal(summary.approvedBy, 'human')
})

test('approved Interview lineage propagates through Run, Spec, and Plan workflow', () => {
  const project = projectRoot()
  assert.equal(cli(project, ['setup']).status, 0)
  assert.equal(cli(project, ['interview', 'draft', 'Checkout', '--goal', 'Align checkout behavior.']).status, 0)
  assert.equal(cli(project, ['interview', 'approve', 'INTERVIEW-001']).status, 0)
  assert.equal(cli(project, ['draft', 'Checkout flow', 'implement shared understanding', '--type', 'feature']).status, 0)
  assert.equal(
    cli(project, ['run', 'start', 'INT-001', 'Implement checkout', '--interview', 'INTERVIEW-001']).status,
    0,
  )

  const spec = cli(project, ['spec', 'draft', 'Checkout', '--interview', 'INTERVIEW-001'])
  const plan = cli(project, ['plan', 'draft', 'Checkout plan'])

  assert.equal(spec.status, 0, spec.stderr)
  assert.equal(plan.status, 0, plan.stderr)
  const summary = readJson(project, ['.intent', 'interviews', 'INTERVIEW-001.json'])
  const run = readJson(project, ['.intent', 'runs', 'RUN-001.json'])
  const planRecord = readJson(project, ['.intent', 'plans', 'PLAN-001.json'])
  assert.equal(summary.intentId, 'INT-001')
  assert.equal(summary.specSlug, 'spec-checkout')
  assert.equal(summary.planId, 'PLAN-001')
  assert.equal(summary.runId, 'RUN-001')
  assert.equal(run.interviewId, 'INTERVIEW-001')
  assert.equal(run.specSlug, 'spec-checkout')
  assert.equal(run.planId, 'PLAN-001')
  assert.equal(planRecord.interviewId, 'INTERVIEW-001')
})
