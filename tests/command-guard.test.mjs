import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkAgentCommand } from '../dist/src/runtime/command-guard.js'

test('agent shell cannot hide markers and run a human-only approval', () => {
  const decision = checkAgentCommand(
    'env -u CODEX_THREAD_ID -u CODEX_SHELL intent approve INT-001',
  )

  assert.equal(decision.blocked, true)
  assert.match(decision.reason, /human-only approval/)
})

test('agent shell cannot invoke approval through the compiled CLI path', () => {
  const decision = checkAgentCommand(
    'node /opt/intent/dist/src/cli/index.js contract approve CONTRACT-001',
  )

  assert.equal(decision.blocked, true)
  assert.match(decision.reason, /human-only approval/)
})

test('agent shell cannot redirect content into protected intent state', () => {
  const decision = checkAgentCommand("printf '%s' approved > .intent/intents/INT-001.json")

  assert.equal(decision.blocked, true)
  assert.match(decision.reason, /protected \.intent state/)
})

test('read-only intent inspection and ordinary CLI writes remain available', () => {
  assert.equal(checkAgentCommand('rg approved .intent/intents').blocked, false)
  assert.equal(checkAgentCommand('intent draft "what" "why"').blocked, false)
  assert.equal(checkAgentCommand('intent status').blocked, false)
})
