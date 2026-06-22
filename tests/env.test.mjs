import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAiAgent } from '../dist/src/runtime/env.js'

test('human shell has no agent markers', () => {
  assert.equal(isAiAgent({}), false)
})

test('Claude Code shell is detected', () => {
  assert.equal(isAiAgent({ CLAUDECODE: '1' }), true)
})

test('Codex shell is detected', () => {
  assert.equal(isAiAgent({ CODEX_THREAD_ID: 'thread', CODEX_SHELL: 'powershell' }), true)
})
