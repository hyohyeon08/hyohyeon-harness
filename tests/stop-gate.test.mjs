import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateStopGate, canComplete } from '../dist/src/runtime/stop-gate.js'

function intent(over = {}) {
  return {
    id: 'INT-001',
    what: 'x',
    why: 'y',
    type: 'feature',
    scope: ['**'],
    dod: ['a', 'b'],
    dodChecked: ['a', 'b'],
    status: 'approved',
    approvedBy: 'human',
    learnings: 'learned X',
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

function evidence(over = {}) {
  return {
    evidenceId: 'VE-001',
    type: 'unit_test',
    status: 'passed',
    command: 'npm.cmd',
    args: ['test'],
    exitCode: 0,
    logPath: '.intent/raw/unit_test-results/RUN-001.log',
    startedAt: 't',
    finishedAt: 't',
    ...over,
  }
}

function run(over = {}) {
  return {
    runId: 'RUN-001',
    objective: 'x',
    phase: 'verify',
    status: 'active',
    intentId: 'INT-001',
    specSlug: null,
    planId: null,
    contractId: null,
    nextAction: null,
    notes: [],
    evidence: [],
    requiredEvidenceTypes: [],
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

function contract(over = {}) {
  return {
    contractId: 'CONTRACT-001',
    runId: 'RUN-001',
    intentId: 'INT-001',
    status: 'approved',
    approvedBy: 'human',
    approvedAt: 't',
    allowedScope: ['**'],
    forbiddenScope: [],
    architectureBoundaries: [],
    testMatrix: {
      typecheck: 'optional',
      build: 'optional',
      lint: 'optional',
      unit_test: 'optional',
      integration_test: 'skipped',
      e2e_test: 'skipped',
      custom: 'skipped',
    },
    requiredChecks: ['unit_test'],
    definitionOfDone: [],
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }
}

test('no intents -> gate clear', () => {
  assert.equal(evaluateStopGate([]).block, false)
})

test('approved intent with unchecked DoD blocks', () => {
  const d = evaluateStopGate([intent({ dodChecked: ['a'] })])
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /DoD incomplete \(1\/2\)/)
})

test('feature with all DoD checked but no learning blocks', () => {
  const d = evaluateStopGate([intent({ learnings: null })])
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /learning note/)
})

test('feature fully done with learning still needs a governed run', () => {
  const d = evaluateStopGate([intent()])
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /governed run/)
})

test('feature fully done with learning and a governed run -> gate clear', () => {
  assert.equal(evaluateStopGate([intent()], run(), contract({ requiredChecks: [] })).block, false)
})

test('tidy is exempt from the learning requirement', () => {
  const d = evaluateStopGate([intent({ type: 'tidy', learnings: null })])
  assert.equal(d.block, false)
})

test('draft and done intents are ignored by the stop gate', () => {
  const drafts = [intent({ status: 'draft', learnings: null, dodChecked: [] })]
  const done = [intent({ status: 'done', learnings: null })]
  assert.equal(evaluateStopGate(drafts).block, false)
  assert.equal(evaluateStopGate(done).block, false)
})

test('canComplete rejects a non-approved intent', () => {
  assert.equal(canComplete(intent({ status: 'draft' })).ok, false)
})

test('canComplete rejects a feature without a governed run', () => {
  const d = canComplete(intent())
  assert.equal(d.ok, false)
  assert.match(d.reason, /governed run/)
})

test('canComplete passes a fully satisfied feature with a governed run', () => {
  assert.equal(canComplete(intent(), run(), contract({ requiredChecks: [] })).ok, true)
})

test('canComplete rejects a feature without an approved matching Contract', () => {
  const missing = canComplete(intent(), run())
  const draft = canComplete(intent(), run(), contract({ status: 'draft', requiredChecks: [] }))

  assert.equal(missing.ok, false)
  assert.match(missing.reason, /approved Contract/)
  assert.equal(draft.ok, false)
  assert.match(draft.reason, /approved Contract/)
})

test('canComplete requires verify phase for behavior changes', () => {
  const decision = canComplete(intent(), run({ phase: 'act' }), contract({ requiredChecks: [] }))

  assert.equal(decision.ok, false)
  assert.match(decision.reason, /requires verify phase/)
})

test('required evidence missing blocks completion when a run requires it', () => {
  const d = evaluateStopGate([intent()], run({ requiredEvidenceTypes: ['unit_test'] }))
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence missing: unit_test/)
})

test('failed required evidence blocks completion', () => {
  const d = evaluateStopGate(
    [intent()],
    run({ requiredEvidenceTypes: ['unit_test'], evidence: [evidence({ status: 'failed', exitCode: 7 })] }),
  )
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence failed: unit_test/)
})

test('passed required evidence allows completion', () => {
  const d = evaluateStopGate(
    [intent()],
    run({ requiredEvidenceTypes: ['unit_test'], evidence: [evidence()] }),
    contract({ requiredChecks: ['unit_test'] }),
  )
  assert.equal(d.block, false)
})

test('a run linked to another intent does not satisfy the governed run requirement', () => {
  const d = evaluateStopGate([intent({ id: 'INT-002' })], run({ requiredEvidenceTypes: ['unit_test'] }))
  assert.equal(d.block, true)
  assert.match(d.reasons[0], /governed run/)
})

test('blocked, paused, and passing governed runs remain completion inputs', () => {
  for (const status of ['blocked', 'paused', 'passing']) {
    const d = canComplete(intent(), run({ status }), contract({ requiredChecks: [] }))
    assert.equal(d.ok, true, status)
  }
})

test('latest failed evidence invalidates an earlier pass', () => {
  const d = evaluateStopGate(
    [intent()],
    run({
      requiredEvidenceTypes: ['unit_test'],
      evidence: [
        evidence(),
        evidence({ evidenceId: 'VE-002', status: 'failed', exitCode: 7 }),
      ],
    }),
    contract({ requiredChecks: ['unit_test'] }),
  )

  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence failed: unit_test/)
})

test('latest passed evidence supersedes an earlier failure', () => {
  const d = evaluateStopGate(
    [intent()],
    run({
      requiredEvidenceTypes: ['unit_test'],
      evidence: [
        evidence({ status: 'failed', exitCode: 7 }),
        evidence({ evidenceId: 'VE-002' }),
      ],
    }),
    contract({ requiredChecks: ['unit_test'] }),
  )

  assert.equal(d.block, false)
})

test('contract requiredChecks block completion when evidence is missing', () => {
  const d = evaluateStopGate([intent()], run(), contract({ requiredChecks: ['typecheck', 'unit_test'] }))

  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence missing: typecheck, unit_test/)
})

test('contract requiredChecks block completion when evidence failed', () => {
  const d = evaluateStopGate(
    [intent()],
    run({ evidence: [evidence({ type: 'unit_test', status: 'failed', exitCode: 1 })] }),
    contract({ requiredChecks: ['unit_test'] }),
  )

  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence failed: unit_test/)
})

test('contract requiredChecks allow completion when all checks passed', () => {
  const d = evaluateStopGate(
    [intent()],
    run({ evidence: [evidence({ type: 'unit_test' })] }),
    contract({ requiredChecks: ['unit_test'] }),
  )

  assert.equal(d.block, false)
})

test('run requiredEvidenceTypes is fallback only when no matching contract is present', () => {
  const withContract = evaluateStopGate(
    [intent({ type: 'tidy', learnings: null })],
    run({ requiredEvidenceTypes: ['custom'] }),
    contract({ requiredChecks: [] }),
  )
  const withoutContract = evaluateStopGate(
    [intent({ type: 'tidy', learnings: null })],
    run({ requiredEvidenceTypes: ['custom'] }),
  )

  assert.equal(withContract.block, false)
  assert.equal(withoutContract.block, true)
  assert.match(withoutContract.reasons[0], /required evidence missing: custom/)
})

test('draft contracts do not override governed run evidence policy', () => {
  const d = evaluateStopGate(
    [intent({ type: 'tidy', learnings: null })],
    run({ requiredEvidenceTypes: ['custom'] }),
    contract({ status: 'draft', requiredChecks: [] }),
  )

  assert.equal(d.block, true)
  assert.match(d.reasons[0], /required evidence missing: custom/)
})

test('stale required evidence blocks completion after a later edit', () => {
  const d = canComplete(
    intent(),
    run({ requiredEvidenceTypes: ['unit_test'], evidence: [evidence()] }),
    null,
    ['unit_test'],
  )

  assert.equal(d.ok, false)
  assert.match(d.reason, /required evidence stale after later edit: unit_test/)
})
