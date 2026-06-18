import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyChange } from '../dist/src/runtime/triviality.js'

const base = {
  path: 'src/foo.ts',
  addedLines: 0,
  removedLines: 0,
  newSymbols: false,
  addsControlFlow: false,
  onlyCommentsOrFormat: false,
  isNewFile: false,
}

test('small one-line edit is trivial', () => {
  const v = classifyChange({ ...base, addedLines: 1, removedLines: 1 })
  assert.equal(v.triviality, 'trivial')
})

test('comments/formatting only is trivial regardless of size', () => {
  const v = classifyChange({ ...base, addedLines: 40, onlyCommentsOrFormat: true })
  assert.equal(v.triviality, 'trivial')
})

test('new symbol is non-trivial even if tiny', () => {
  const v = classifyChange({ ...base, addedLines: 1, newSymbols: true })
  assert.equal(v.triviality, 'non-trivial')
})

test('adding control flow is non-trivial', () => {
  const v = classifyChange({ ...base, addedLines: 3, addsControlFlow: true })
  assert.equal(v.triviality, 'non-trivial')
})

test('new file is non-trivial', () => {
  const v = classifyChange({ ...base, addedLines: 2, isNewFile: true })
  assert.equal(v.triviality, 'non-trivial')
})

test('large change over maxLines is non-trivial', () => {
  const v = classifyChange({ ...base, addedLines: 6 }, 5)
  assert.equal(v.triviality, 'non-trivial')
})

test('maxLines is configurable', () => {
  const v = classifyChange({ ...base, addedLines: 6 }, 10)
  assert.equal(v.triviality, 'trivial')
})
