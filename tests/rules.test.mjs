import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkRules,
  composeAgentsRuleCandidate,
  composeCiRuleCandidate,
  composeRuleImpactReport,
  draftRule,
  findRule,
  loadRules,
  recordRuleReflection,
} from '../dist/src/runtime/rules.js'
import { RuleSchema } from '../dist/src/runtime/schemas.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-rules-'))
}

const rule = (over) => ({
  id: 'RULE-001',
  kind: 'forbid-path',
  pattern: 'src/legacy/**',
  reason: 'legacy is frozen',
  status: 'approved',
  approvedBy: 'human',
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

test('no rules -> not blocked', () => {
  assert.equal(checkRules('src/a.ts', 'x', []).blocked, false)
})

test('approved forbid-path blocks a matching path', () => {
  const hit = checkRules('src/legacy/old.ts', 'x', [rule()])
  assert.equal(hit.blocked, true)
  assert.match(hit.reason, /RULE-001/)
})

test('forbid-path does not block a non-matching path', () => {
  assert.equal(checkRules('src/new/a.ts', 'x', [rule()]).blocked, false)
})

test('draft rules do not enforce', () => {
  assert.equal(checkRules('src/legacy/old.ts', 'x', [rule({ status: 'draft' })]).blocked, false)
})

test('approved forbid-pattern blocks matching content', () => {
  const r = rule({ kind: 'forbid-pattern', pattern: 'console\\.log', reason: 'no debug logs' })
  assert.equal(checkRules('src/a.ts', 'console.log(x)', [r]).blocked, true)
  assert.equal(checkRules('src/a.ts', 'return x', [r]).blocked, false)
})

test('an approved invalid regex rule fails closed', () => {
  const r = rule({ kind: 'forbid-pattern', pattern: '(' })
  const hit = checkRules('src/a.ts', 'anything', [r])
  assert.equal(hit.blocked, true)
  assert.match(hit.reason, /invalid regex/)
})

test('RuleSchema keeps old rule JSON compatible with sourceDetectionId default', () => {
  const parsed = RuleSchema.parse({
    id: 'RULE-001',
    kind: 'forbid-path',
    pattern: 'src/legacy/**',
    reason: 'legacy is frozen',
    status: 'draft',
    createdAt: 't',
    updatedAt: 't',
  })

  assert.equal(parsed.sourceDetectionId, null)
  assert.deepEqual(parsed.reflections, [])
})

test('draftRule can link a rule candidate to its source detection', () => {
  const root = tempRoot()

  const drafted = draftRule(root, 'forbid-pattern', 'console\\.log', 'no debug logs', {
    sourceDetectionId: 'DET-001',
  })

  assert.equal(drafted.sourceDetectionId, 'DET-001')
  assert.equal(findRule(root, drafted.id)?.id, drafted.id)
  assert.equal(loadRules(root)[0].sourceDetectionId, 'DET-001')
})

test('recordRuleReflection stores AGENTS and CI reflection state on a rule', () => {
  const root = tempRoot()
  const drafted = draftRule(root, 'forbid-pattern', 'console\\.log', 'no debug logs')

  recordRuleReflection(root, drafted.id, {
    kind: 'agents',
    status: 'candidate',
    target: 'AGENTS.md',
    evidence: 'candidate printed',
  })
  const updated = recordRuleReflection(root, drafted.id, {
    kind: 'ci',
    status: 'applied',
    target: '.github/workflows/intent.yml',
    evidence: 'workflow updated',
  })

  assert.deepEqual(updated.reflections.map((reflection) => `${reflection.kind}:${reflection.status}:${reflection.target}`), [
    'agents:candidate:AGENTS.md',
    'ci:applied:.github/workflows/intent.yml',
  ])
  assert.match(updated.reflections[1].updatedAt, /^20/)
})

test('composeAgentsRuleCandidate renders a human-reviewable AGENTS.md rule snippet', () => {
  const md = composeAgentsRuleCandidate(rule({
    id: 'RULE-009',
    kind: 'forbid-pattern',
    pattern: 'console\\.log',
    reason: 'debug logging regressed a completion',
    sourceDetectionId: 'DET-001',
  }))

  assert.match(md, /AGENTS\.md Candidate: RULE-009/)
  assert.match(md, /Source detection: DET-001/)
  assert.match(md, /Do not introduce content matching `\/console\\\.log\/`/)
  assert.match(md, /debug logging regressed a completion/)
})

test('composeCiRuleCandidate renders a CI step candidate for a pattern rule', () => {
  const md = composeCiRuleCandidate(rule({
    id: 'RULE-010',
    kind: 'forbid-pattern',
    pattern: 'console\\.log',
    reason: 'no debug logs',
    sourceDetectionId: 'DET-001',
  }))

  assert.match(md, /CI Candidate: RULE-010/)
  assert.match(md, /Source detection: DET-001/)
  assert.match(md, /rg -n 'console\\\.log'/)
})

test('composeRuleImpactReport reports hook enforcement and reflections', () => {
  const md = composeRuleImpactReport(rule({
    id: 'RULE-011',
    status: 'approved',
    sourceDetectionId: 'DET-002',
    reflections: [
      {
        kind: 'agents',
        status: 'applied',
        target: 'AGENTS.md',
        evidence: 'manual patch',
        updatedAt: 't',
      },
    ],
  }))

  assert.match(md, /rule impact RULE-011 \[approved\]/)
  assert.match(md, /hook enforcement: active/)
  assert.match(md, /source detection: DET-002/)
  assert.match(md, /agents\/applied: AGENTS\.md — manual patch/)
})
