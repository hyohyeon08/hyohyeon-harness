import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify, composePostmortem } from '../dist/src/runtime/postmortem.js'

test('slugify makes kebab-case from ascii', () => {
  assert.equal(slugify('Stock Restore On Cancel!'), 'stock-restore-on-cancel')
})

test('slugify keeps unicode letters (Korean stays meaningful)', () => {
  const s = slugify('재고 복원 누락')
  assert.ok(s.length > 0)
  assert.equal(s, '재고-복원-누락')
})

test('slugify falls back to untitled when empty', () => {
  assert.equal(slugify('!!! ---'), 'untitled')
})

test('composePostmortem renders cause and prevention', () => {
  const md = composePostmortem({ cause: 'missing stock call', prevention: 'add integration test' })
  assert.match(md, /## 근본 원인\nmissing stock call/)
  assert.match(md, /## 재발 방지\nadd integration test/)
})

test('composePostmortem references a drafted rule when present', () => {
  const md = composePostmortem({ cause: 'c', prevention: 'p', ruleRef: 'RULE-003' })
  assert.match(md, /gate rule drafted: RULE-003/)
})

test('composePostmortem omits rule line when absent', () => {
  const md = composePostmortem({ cause: 'c', prevention: 'p' })
  assert.doesNotMatch(md, /gate rule/)
})
