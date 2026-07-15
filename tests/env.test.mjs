import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvalActor, isAiAgent } from '../dist/src/runtime/env.js'

test('human shell has no agent markers', () => {
  assert.equal(isAiAgent({}), false)
  assert.equal(approvalActor({}), 'human')
})

test('Claude Code shell is detected', () => {
  assert.equal(isAiAgent({ CLAUDECODE: '1' }), true)
  assert.equal(approvalActor({ CLAUDECODE: '1' }), 'agent:claude-code')
})

test('Codex shell is detected', () => {
  assert.equal(isAiAgent({ CODEX_THREAD_ID: 'thread', CODEX_SHELL: 'powershell' }), true)
  assert.equal(approvalActor({ CODEX_THREAD_ID: 'thread', CODEX_SHELL: 'powershell' }), 'agent:codex')
})
