import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractChange } from '../dist/src/runtime/change-extract.js'
import { classifyChange } from '../dist/src/runtime/triviality.js'

const edit = (over) => ({ path: 'src/x.ts', newText: '', oldText: '', isNewFile: false, ...over })

test('small value tweak is trivial', () => {
  const c = extractChange(edit({ newText: 'port = 4000', oldText: 'port = 3000' }))
  assert.equal(classifyChange(c).triviality, 'trivial')
})

test('comment-only addition is trivial even if it mentions "if"', () => {
  const c = extractChange(edit({ newText: '// check if the order is valid' }))
  assert.equal(c.onlyCommentsOrFormat, true)
  assert.equal(c.addsControlFlow, false)
  assert.equal(classifyChange(c).triviality, 'trivial')
})

test('adding a function is non-trivial', () => {
  const c = extractChange(edit({ newText: 'function restore(qty) { return qty }' }))
  assert.equal(c.newSymbols, true)
  assert.equal(classifyChange(c).triviality, 'non-trivial')
})

test('adding control flow is non-trivial', () => {
  const c = extractChange(edit({ newText: 'if (cancelled) return' }))
  assert.equal(c.addsControlFlow, true)
  assert.equal(classifyChange(c).triviality, 'non-trivial')
})

test('writing a new file is non-trivial', () => {
  const c = extractChange(edit({ newText: 'a\nb', isNewFile: true }))
  assert.equal(c.isNewFile, true)
  assert.equal(classifyChange(c).triviality, 'non-trivial')
})
