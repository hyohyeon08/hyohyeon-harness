import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRules } from '../dist/src/runtime/rules.js'

const rule = (over) => ({
  id: 'RULE-001',
  kind: 'forbid-path',
  pattern: 'src/legacy/**',
  reason: 'legacy is frozen',
  status: 'approved',
  approvedBy: 'human',
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

test('no rules -> not blocked', () => {
  assert.equal(checkRules('src/a.ts', 'x', []).blocked, false)
})

test('approved forbid-path blocks a matching path', () => {
  const hit = checkRules('src/legacy/old.ts', 'x', [rule()])
  assert.equal(hit.blocked, true)
  assert.match(hit.reason, /RULE-001/)
})

test('forbid-path does not block a non-matching path', () => {
  assert.equal(checkRules('src/new/a.ts', 'x', [rule()]).blocked, false)
})

test('draft rules do not enforce', () => {
  assert.equal(checkRules('src/legacy/old.ts', 'x', [rule({ status: 'draft' })]).blocked, false)
})

test('approved forbid-pattern blocks matching content', () => {
  const r = rule({ kind: 'forbid-pattern', pattern: 'console\\.log', reason: 'no debug logs' })
  assert.equal(checkRules('src/a.ts', 'console.log(x)', [r]).blocked, true)
  assert.equal(checkRules('src/a.ts', 'return x', [r]).blocked, false)
})

test('an invalid regex rule is skipped, not thrown', () => {
  const r = rule({ kind: 'forbid-pattern', pattern: '(' })
  assert.equal(checkRules('src/a.ts', 'anything', [r]).blocked, false)
})
