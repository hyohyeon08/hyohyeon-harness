import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkAgentCommand } from '../dist/src/runtime/command-guard.js'

test('agent shell can run every autonomous governance action', () => {
  const commands = [
    'env -u CODEX_THREAD_ID -u CODEX_SHELL intent approve INT-001',
    'intent rule approve RULE-001',
    'intent spec approve spec-checkout',
    'intent interview approve INTERVIEW-001',
    'intent interview archive INTERVIEW-001',
    'intent plan approve PLAN-001',
    'intent plan archive PLAN-001',
    'intent contract approve CONTRACT-001',
    'intent contract archive CONTRACT-001',
    'intent detection resolve DET-001 dismissed "false positive"',
    'node /opt/intent/dist/src/cli/index.js contract approve CONTRACT-001',
  ]

  for (const command of commands) {
    assert.equal(checkAgentCommand(command).blocked, false, command)
  }
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
