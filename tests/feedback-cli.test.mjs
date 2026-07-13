import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function projectRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-feedback-cli-'))
}

function humanEnv() {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CODEX_THREAD_ID
  delete env.CODEX_SHELL
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  return env
}

function cli(project, args, env = humanEnv()) {
  const bin = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  return spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: 'utf8', env })
}

function setupProject() {
  const project = projectRoot()
  const setup = cli(project, ['setup'])
  assert.equal(setup.status, 0, setup.stderr)
  mkdirSync(join(project, '.intent', 'detections'), { recursive: true })
  writeDetection(project, {
    detectionId: 'DET-001',
    type: 'false_success',
    result: 'candidate',
    runId: 'RUN-001',
    intentId: 'INT-001',
    title: 'Completion attempted without required evidence',
    summary: 'Completion was attempted while unit_test evidence was missing.',
    evidenceRefs: ['intent:INT-001', 'run:RUN-001'],
    attributes: { missingEvidenceTypes: ['unit_test'] },
    resolution: null,
    createdAt: '2026-07-06T07:00:00.000Z',
    updatedAt: '2026-07-06T07:00:00.000Z',
    resolvedAt: null,
  })
  return project
}

function writeDetection(project, detection) {
  writeFileSync(
    join(project, '.intent', 'detections', `${detection.detectionId}.json`),
    JSON.stringify(detection, null, 2) + '\n',
    'utf8',
  )
}

test('intent wiki ingest detection records a problem page and updates the index', () => {
  const project = setupProject()

  const result = cli(project, ['wiki', 'ingest', 'detection', 'DET-001'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /wiki: ingested detection DET-001 -> detection-det-001-completion-attempted-without-required-evidence/)

  const page = join(
    project,
    '.intent',
    'wiki',
    'problems',
    'detection-det-001-completion-attempted-without-required-evidence.md',
  )
  assert.equal(existsSync(page), true)
  assert.match(readFileSync(page, 'utf8'), /Completion was attempted while unit_test evidence was missing\./)
  assert.match(readFileSync(join(project, '.intent', 'wiki', 'index.md'), 'utf8'), /detection-det-001/)
})

test('intent rule draft-from-detection links a draft rule to its source detection', () => {
  const project = setupProject()

  const result = cli(project, [
    'rule',
    'draft-from-detection',
    'DET-001',
    'forbid-pattern',
    'console\\.log',
    'no debug logs',
  ])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /drafted RULE-001 from DET-001 \(forbid-pattern\)/)
  const rule = JSON.parse(readFileSync(join(project, '.intent', 'rules', 'RULE-001.json'), 'utf8'))
  assert.equal(rule.sourceDetectionId, 'DET-001')
  assert.equal(rule.kind, 'forbid-pattern')
  assert.equal(rule.pattern, 'console\\.log')
  assert.equal(rule.reason, 'no debug logs')
  assert.equal(rule.status, 'draft')

  const candidate = cli(project, ['rule', 'agents-candidate', 'RULE-001'])
  assert.equal(candidate.status, 0, candidate.stderr)
  assert.match(candidate.stdout, /AGENTS\.md Candidate: RULE-001/)
  assert.match(candidate.stdout, /Source detection: DET-001/)
  assert.match(candidate.stdout, /Do not introduce content matching `\/console\\\.log\/`/)

  const ciCandidate = cli(project, ['rule', 'ci-candidate', 'RULE-001'])
  assert.equal(ciCandidate.status, 0, ciCandidate.stderr)
  assert.match(ciCandidate.stdout, /CI Candidate: RULE-001/)
  assert.match(ciCandidate.stdout, /rg -n 'console\\\.log'/)

  const reflected = cli(project, [
    'rule',
    'reflect',
    'RULE-001',
    'agents',
    'applied',
    'AGENTS.md',
    'candidate copied',
  ])
  assert.equal(reflected.status, 0, reflected.stderr)
  assert.match(reflected.stdout, /reflected RULE-001: agents\/applied AGENTS\.md/)

  const impact = cli(project, ['rule', 'impact', 'RULE-001'])
  assert.equal(impact.status, 0, impact.stderr)
  assert.match(impact.stdout, /rule impact RULE-001 \[draft\]/)
  assert.match(impact.stdout, /hook enforcement: inactive/)
  assert.match(impact.stdout, /agents\/applied: AGENTS\.md — candidate copied/)
})

test('intent rule draft-from-detection fails for an unknown detection', () => {
  const project = setupProject()

  const result = cli(project, ['rule', 'draft-from-detection', 'DET-999', 'forbid-pattern', 'console\\.log'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /no such detection: DET-999/)
})
