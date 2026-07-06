import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createDetection,
  recordDetectionWikiPage,
  unIngestedDetections,
} from '../dist/src/runtime/detections.js'
import {
  composeIndex,
  extractLinks,
  parseFrontmatter,
  serializeFrontmatter,
  composeLogEntry,
  lintWiki,
  areaOf,
} from '../dist/src/runtime/wiki.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-wiki-'))
}

const art = (over) => {
  const type = over.type ?? 'concept'
  const area = ['failure', 'issue'].includes(type) ? 'problem' : 'knowledge'
  return { slug: 'x', title: 'X', type, area, summary: '', tags: [], links: [], ...over }
}

// ── links / area ──
test('extractLinks finds [[slug]] references, deduped and lowercased', () => {
  assert.deepEqual(extractLinks('see [[stock-model]] and [[Stock-Model]] and [[order]]'), ['stock-model', 'order'])
})

test('areaOf routes failure/issue to problem, rest to knowledge', () => {
  assert.equal(areaOf('failure'), 'problem')
  assert.equal(areaOf('issue'), 'problem')
  assert.equal(areaOf('concept'), 'knowledge')
  assert.equal(areaOf('decision'), 'knowledge')
})

// ── frontmatter ──
test('parseFrontmatter round-trips keys and arrays', () => {
  const s = serializeFrontmatter({ title: 'T', type: 'concept', tags: ['a', 'b'] })
  const { fm, body } = parseFrontmatter(s + '\n# T\n\nhello')
  assert.equal(fm.title, 'T')
  assert.deepEqual(fm.tags, ['a', 'b'])
  assert.match(body, /hello/)
})

test('serializeFrontmatter drops empty fields', () => {
  assert.doesNotMatch(serializeFrontmatter({ title: 'T', status: '' }), /status/)
})

// ── index: two areas ──
test('empty wiki renders a placeholder index', () => {
  assert.match(composeIndex([]), /no articles yet/)
})

test('index separates 정보(knowledge) by type', () => {
  const idx = composeIndex([
    art({ slug: 'order-cancel', title: 'Cancel', type: 'concept', summary: '취소 흐름' }),
    art({ slug: 'd-lock', type: 'decision', summary: 'pessimistic lock' }),
  ])
  assert.match(idx, /## 정보 \(knowledge\)/)
  assert.match(idx, /### Concepts/)
  assert.match(idx, /### Decisions/)
  assert.match(idx, /\[\[order-cancel\]\] — 취소 흐름/)
})

test('index separates 문제(problems) into open and resolved', () => {
  const idx = composeIndex([
    art({ slug: 'bug-stock', type: 'issue', status: 'open', summary: '재고 미복원' }),
    art({ slug: 'failure-lock', type: 'failure', status: 'resolved', summary: '락 데드락' }),
  ])
  assert.match(idx, /## 문제 \(problems\)/)
  assert.match(idx, /### 미해결 \(open\)/)
  assert.match(idx, /### 해결됨 \(resolved\)/)
  assert.match(idx, /\[\[bug-stock\]\] — 재고 미복원/)
})

test('index computes backlinks across areas', () => {
  const idx = composeIndex([art({ slug: 'failure-x', type: 'failure', links: ['order-cancel'] }), art({ slug: 'order-cancel' })])
  assert.match(idx, /order-cancel ← failure-x/)
})

// ── log ──
test('composeLogEntry is grep-able and lists created pages', () => {
  const e = composeLogEntry({ date: '2026-06-17', kind: 'ingest', title: 'Order Cancel', created: ['order-cancel'] })
  assert.match(e, /^## \[2026-06-17\] ingest \| Order Cancel/)
  assert.match(e, /생성: \[\[order-cancel\]\]/)
})

// ── lint ──
test('lintWiki flags orphans and dead links', () => {
  const r = lintWiki([art({ slug: 'a', links: ['ghost'] }), art({ slug: 'b' })])
  assert.ok(r.orphans.includes('a') && r.orphans.includes('b'))
  assert.deepEqual(r.deadLinks, [{ from: 'a', to: 'ghost' }])
})

test('lintWiki reports open problems', () => {
  const r = lintWiki([art({ slug: 'bug', type: 'issue', status: 'open' }), art({ slug: 'failure-x', type: 'failure', status: 'resolved' })])
  assert.deepEqual(r.openProblems, ['bug'])
})

test('overview pages are not treated as orphans', () => {
  assert.deepEqual(lintWiki([art({ slug: 'overview', type: 'overview' })]).orphans, [])
})

test('recordDetectionWikiPage writes a problem wiki page with detection evidence', () => {
  const root = tempRoot()
  const detection = createDetection(root, {
    type: 'false_success',
    runId: 'RUN-001',
    intentId: 'INT-001',
    title: 'Completion attempted without required evidence',
    summary: 'unit_test evidence was missing.',
    evidenceRefs: ['intent:INT-001', 'run:RUN-001', '.intent/raw/unit_test-results/RUN-001.log'],
    attributes: { missingEvidenceTypes: ['unit_test'] },
  })

  const recorded = recordDetectionWikiPage(root, detection.detectionId)

  assert.equal(recorded.slug, 'detection-det-001-completion-attempted-without-required-evidence')
  assert.equal(existsSync(recorded.file), true)
  const md = readFileSync(recorded.file, 'utf8')
  assert.match(md, /type: issue/)
  assert.match(md, /status: open/)
  assert.match(md, /unit_test evidence was missing\./)
  assert.match(md, /\.intent\/raw\/unit_test-results\/RUN-001\.log/)
  assert.match(readFileSync(join(root, '.intent', 'wiki', 'index.md'), 'utf8'), /detection-det-001/)
})

test('unIngestedDetections reports detections that do not have wiki pages yet', () => {
  const root = tempRoot()
  const detection = createDetection(root, {
    type: 'thrashing',
    runId: 'RUN-001',
    title: 'Repeated command failure',
    summary: 'npm test failed repeatedly.',
    evidenceRefs: ['span:RUN-001:SPAN-001'],
    attributes: { command: 'npm.cmd' },
  })

  assert.deepEqual(unIngestedDetections(root).map((d) => d.detectionId), ['DET-001'])

  recordDetectionWikiPage(root, detection.detectionId)

  assert.deepEqual(unIngestedDetections(root), [])
})
