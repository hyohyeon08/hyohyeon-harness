import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendScratch, composeHandoff, readScratch } from '../dist/src/runtime/handoff.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-handoff-'))
}

const intent = (over) => ({
  id: 'INT-001',
  what: 'restore stock',
  why: 'bug',
  type: 'feature',
  scope: ['**'],
  dod: ['a', 'b'],
  dodChecked: ['a'],
  status: 'approved',
  approvedBy: 'human',
  learnings: null,
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

const run = (over) => ({
  runId: 'RUN-001',
  objective: 'Wire handoff context',
  phase: 'act',
  status: 'active',
  intentId: 'INT-001',
  specSlug: null,
  planId: null,
  contractId: null,
  nextAction: 'Add verification schema',
  notes: ['Use activeRun(root) in writeHandoff'],
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

const base = {
  generatedAt: '2026-06-17T00:00:00Z',
  openIntents: [intent()],
  activeRun: null,
  scratch: { deadEnds: [], nextSteps: [], openQuestions: [] },
  recentDecisions: [],
  recentLearnings: [],
}

test('handoff surfaces open intents with remaining DoD', () => {
  const md = composeHandoff(base)
  assert.match(md, /현재 작업 상태/)
  assert.match(md, /INT-001 \[approved\] restore stock — DoD 1\/2/)
})

test('dead-ends are rendered so the next session does not repeat them', () => {
  const md = composeHandoff({ ...base, scratch: { deadEnds: ['tried optimistic lock — deadlocks'], nextSteps: [], openQuestions: [] } })
  assert.match(md, /막다른 길/)
  assert.match(md, /optimistic lock/)
})

test('empty narrative sections render a placeholder', () => {
  const md = composeHandoff(base)
  assert.match(md, /## 다음 단계\n\n— 없음/)
})

test('knowledge deltas combine decisions and learnings', () => {
  const md = composeHandoff({ ...base, recentDecisions: ['chose pessimistic lock'], recentLearnings: ['flush timing'] })
  assert.match(md, /chose pessimistic lock/)
  assert.match(md, /flush timing/)
})

test('no open intents states it explicitly', () => {
  const md = composeHandoff({ ...base, openIntents: [intent({ status: 'done' })] })
  assert.match(md, /진행 중인 의도 없음/)
})

test('active run is rendered as a separate handoff section', () => {
  const md = composeHandoff({ ...base, activeRun: run() })
  assert.match(md, /## Active Run/)
  assert.match(md, /RUN-001 \[active\/act\] Wire handoff context \(INT-001\)/)
  assert.match(md, /next: Add verification schema/)
  assert.match(md, /Use activeRun\(root\) in writeHandoff/)
})

test('appendScratch stores scratch notes without losing existing sections', () => {
  const root = tempRoot()

  appendScratch(root, 'deadend', 'avoid retrying stale branch')
  appendScratch(root, 'next', 'run typecheck')
  const scratch = appendScratch(root, 'question', 'confirm release scope')

  assert.deepEqual(scratch.deadEnds, ['avoid retrying stale branch'])
  assert.deepEqual(scratch.nextSteps, ['run typecheck'])
  assert.deepEqual(scratch.openQuestions, ['confirm release scope'])
  assert.deepEqual(readScratch(root), scratch)
})
