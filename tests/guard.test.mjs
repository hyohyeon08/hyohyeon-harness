import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { isProtectedPath } from '../dist/src/runtime/guard.js'

const root = resolve('demo-root')

test('intent record file is protected', () => {
  assert.equal(isProtectedPath(join('.intent', 'intents', 'INT-001.json'), root), true)
})

test('any .intent state file is protected', () => {
  assert.equal(isProtectedPath('.intent/state.json', root), true)
})

test('the .intent dir itself is protected', () => {
  assert.equal(isProtectedPath('.intent', root), true)
})

test('absolute path inside .intent is protected', () => {
  assert.equal(isProtectedPath(join(root, '.intent', 'config.json'), root), true)
})

test('source files are not protected', () => {
  assert.equal(isProtectedPath('src/order/cancel.ts', root), false)
  assert.equal(isProtectedPath(join(root, 'src', 'foo.ts'), root), false)
})

test('a sibling dir that merely starts with .intent is not protected', () => {
  assert.equal(isProtectedPath('.intentional/foo.ts', root), false)
})
