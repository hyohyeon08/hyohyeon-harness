import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesScope } from '../dist/src/runtime/scope.js'

test('** matches anything', () => {
  assert.equal(matchesScope('src/anywhere/deep/file.ts', ['**']), true)
})

test('dir/** matches files under it', () => {
  assert.equal(matchesScope('src/order/cancel.ts', ['src/order/**']), true)
  assert.equal(matchesScope('src/order/sub/deep.ts', ['src/order/**']), true)
})

test('dir/** does not match a sibling dir', () => {
  assert.equal(matchesScope('src/stock/restore.ts', ['src/order/**']), false)
})

test('exact pattern matches only the exact path', () => {
  assert.equal(matchesScope('src/foo.ts', ['src/foo.ts']), true)
  assert.equal(matchesScope('src/foo.tsx', ['src/foo.ts']), false)
})

test('single * stays within one segment', () => {
  assert.equal(matchesScope('src/a.ts', ['src/*.ts']), true)
  assert.equal(matchesScope('src/sub/a.ts', ['src/*.ts']), false)
})

test('windows backslash paths are normalized', () => {
  assert.equal(matchesScope('src\\order\\cancel.ts', ['src/order/**']), true)
})

test('any of multiple patterns matches', () => {
  assert.equal(matchesScope('src/stock/x.ts', ['src/order/**', 'src/stock/**']), true)
})
