import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRepositoryRelativePath, matchesScope } from '../dist/src/runtime/scope.js'

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

test('broad scope never matches a path outside the repository root', () => {
  for (const path of ['../outside.txt', 'src/../../outside.txt', '/tmp/outside.txt', 'C:\\outside.txt', '\\\\server\\share\\outside.txt']) {
    assert.equal(isRepositoryRelativePath(path), false, path)
    assert.equal(matchesScope(path, ['**']), false, path)
  }
})

test('unsafe scope patterns never authorize a repository path', () => {
  assert.equal(matchesScope('src/app.ts', ['../**']), false)
  assert.equal(matchesScope('src/app.ts', ['/src/**']), false)
  assert.equal(matchesScope('src/app.ts', ['C:\\src\\**']), false)
})
