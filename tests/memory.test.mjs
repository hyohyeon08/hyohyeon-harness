import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatSessionContext } from '../dist/src/runtime/memory.js'

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

test('no open intents reports none', () => {
  const out = formatSessionContext({ intents: [], decisions: [], learnings: [] })
  assert.match(out, /open intents: none/)
})

test('open (approved/draft) intents are surfaced with DoD progress', () => {
  const out = formatSessionContext({ intents: [intent()], decisions: [], learnings: [] })
  assert.match(out, /INT-001 \[approved\] restore stock \(DoD 1\/2\)/)
})

test('done intents are not surfaced as open', () => {
  const out = formatSessionContext({ intents: [intent({ status: 'done' })], decisions: [], learnings: [] })
  assert.match(out, /open intents: none/)
})

test('recent decisions and learnings are included', () => {
  const out = formatSessionContext({
    intents: [],
    decisions: ['chose zod for validation'],
    learnings: ['JPA flush timing'],
  })
  assert.match(out, /chose zod/)
  assert.match(out, /JPA flush timing/)
})
