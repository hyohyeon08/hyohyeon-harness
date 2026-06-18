import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeHandoff } from '../dist/src/runtime/handoff.js'

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

const base = {
  generatedAt: '2026-06-17T00:00:00Z',
  openIntents: [intent()],
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
