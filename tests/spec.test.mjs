import { test } from 'node:test'
import assert from 'node:assert/strict'
import { specSlug, composeSpecStatus } from '../dist/src/runtime/spec.js'

test('specSlug prefixes spec- and slugifies', () => {
  assert.equal(specSlug('Order Cancel Flow'), 'spec-order-cancel-flow')
})

test('draft status points the agent to the explicit approval command', () => {
  const s = composeSpecStatus('draft')
  assert.match(s, /draft/)
  assert.match(s, /intent spec approve <slug>/)
})

test('approved status records who and when', () => {
  const s = composeSpecStatus('approved', 'human', '2026-06-17')
  assert.match(s, /approved by human on 2026-06-17/)
})
