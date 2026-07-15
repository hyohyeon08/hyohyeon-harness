import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendSpanToRun,
  appendSpanToActiveRun,
  listSpans,
  tryAppendSpanToActiveRun,
} from '../dist/src/runtime/observability.js'
import { createRun } from '../dist/src/runtime/runs.js'
import {
  SpanKindSchema,
  SpanSchema,
  SpanStatusSchema,
  TraceSchema,
} from '../dist/src/runtime/schemas.js'
import { paths } from '../dist/src/state/paths.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-observability-'))
}

test('SpanKindSchema accepts the MVP span kinds', () => {
  assert.equal(SpanKindSchema.parse('edit'), 'edit')
  assert.equal(SpanKindSchema.parse('apply_patch'), 'apply_patch')
  assert.equal(SpanKindSchema.parse('run_command'), 'run_command')
  assert.equal(SpanKindSchema.parse('run_check'), 'run_check')
  assert.equal(SpanKindSchema.parse('hook'), 'hook')
  assert.equal(SpanKindSchema.parse('cli'), 'cli')
})

test('SpanStatusSchema accepts terminal span statuses', () => {
  assert.equal(SpanStatusSchema.parse('ok'), 'ok')
  assert.equal(SpanStatusSchema.parse('error'), 'error')
  assert.equal(SpanStatusSchema.parse('blocked'), 'blocked')
})

test('TraceSchema defaults root span and span id list', () => {
  const trace = TraceSchema.parse({
    traceId: 'TRACE-001',
    runId: 'RUN-001',
    createdAt: '2026-07-06T06:00:00.000Z',
    updatedAt: '2026-07-06T06:00:00.000Z',
  })

  assert.equal(trace.rootSpanId, null)
  assert.deepEqual(trace.spanIds, [])
})

test('SpanSchema stores trace/run linkage and defaults optional fields', () => {
  const span = SpanSchema.parse({
    spanId: 'SPAN-001',
    traceId: 'TRACE-001',
    runId: 'RUN-001',
    kind: 'apply_patch',
    name: 'pre-write apply_patch',
    startedAt: '2026-07-06T06:00:00.000Z',
  })

  assert.equal(span.parentSpanId, null)
  assert.equal(span.status, 'ok')
  assert.deepEqual(span.attributes, {})
  assert.equal(span.endedAt, null)
})

test('SpanSchema keeps attributes and error status for failed command spans', () => {
  const span = SpanSchema.parse({
    spanId: 'SPAN-002',
    traceId: 'TRACE-001',
    runId: 'RUN-001',
    kind: 'run_check',
    name: 'verify unit_test',
    status: 'error',
    attributes: {
      command: 'npm.cmd',
      exitCode: 1,
      logPath: '.intent/raw/unit_test-results/RUN-001.log',
    },
    startedAt: '2026-07-06T06:00:00.000Z',
    endedAt: '2026-07-06T06:00:05.000Z',
  })

  assert.equal(span.attributes.command, 'npm.cmd')
  assert.equal(span.attributes.exitCode, 1)
  assert.equal(span.endedAt, '2026-07-06T06:00:05.000Z')
})

test('paths include raw observability trace and span locations', () => {
  const p = paths('C:\\work\\project')

  assert.equal(p.rawObservabilityDir, join('C:\\work\\project', '.intent', 'raw', 'observability'))
  assert.equal(p.traceDir, join('C:\\work\\project', '.intent', 'raw', 'observability', 'traces'))
  assert.equal(p.spanDir, join('C:\\work\\project', '.intent', 'raw', 'observability', 'spans'))
})

test('appendSpanToActiveRun writes span and trace records for the active run', () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'Record spans' })

  const span = appendSpanToActiveRun(root, {
    kind: 'apply_patch',
    name: 'pre-write apply_patch',
    status: 'blocked',
    attributes: { path: 'src/secret/token.ts', reason: 'forbiddenScope' },
  })

  assert.equal(span.spanId, 'SPAN-001')
  assert.equal(span.traceId, 'TRACE-RUN-001')
  assert.equal(span.runId, run.runId)
  assert.equal(span.status, 'blocked')
  assert.equal(span.attributes.path, 'src/secret/token.ts')

  const traceFile = join(root, '.intent', 'raw', 'observability', 'traces', 'TRACE-RUN-001.json')
  const spanFile = join(root, '.intent', 'raw', 'observability', 'spans', 'TRACE-RUN-001-SPAN-001.json')
  assert.equal(existsSync(traceFile), true)
  assert.equal(existsSync(spanFile), true)

  const trace = JSON.parse(readFileSync(traceFile, 'utf8'))
  assert.equal(trace.rootSpanId, 'SPAN-001')
  assert.deepEqual(trace.spanIds, ['SPAN-001'])
})

test('appendSpanToActiveRun appends immutable span ids and listSpans returns run spans', () => {
  const root = tempRoot()
  const first = createRun(root, { objective: 'first' })
  appendSpanToActiveRun(root, { kind: 'hook', name: 'first span' })
  appendSpanToActiveRun(root, { kind: 'run_check', name: 'second span', attributes: { exitCode: 0 } })
  createRun(root, { objective: 'second' })
  appendSpanToActiveRun(root, { kind: 'cli', name: 'third span' })

  const firstRunSpans = listSpans(root, first.runId)

  assert.deepEqual(firstRunSpans.map((span) => span.spanId), ['SPAN-001', 'SPAN-002'])
  assert.equal(firstRunSpans[1].attributes.exitCode, 0)
  assert.deepEqual(listSpans(root).map((span) => `${span.runId}:${span.spanId}`), [
    'RUN-001:SPAN-001',
    'RUN-001:SPAN-002',
    'RUN-002:SPAN-001',
  ])
})

test('tryAppendSpanToActiveRun is failure-safe when no active run exists', () => {
  const root = tempRoot()

  assert.equal(tryAppendSpanToActiveRun(root, { kind: 'hook', name: 'ignored' }), null)
})

test('RUN-1000 and SPAN-1000 observation files remain loadable and numerically sorted', () => {
  const root = tempRoot()
  const seed = createRun(root, { objective: 'seed high ids' })
  const highRun = { ...seed, runId: 'RUN-1000', objective: 'high id run' }
  writeFileSync(join(root, '.intent', 'runs', 'RUN-1000.json'), JSON.stringify(highRun, null, 2) + '\n')

  const spanIds = Array.from({ length: 999 }, (_, index) => `SPAN-${String(index + 1).padStart(3, '0')}`)
  const now = new Date().toISOString()
  mkdirSync(join(root, '.intent', 'raw', 'observability', 'traces'), { recursive: true })
  mkdirSync(join(root, '.intent', 'raw', 'observability', 'spans'), { recursive: true })
  writeFileSync(
    join(root, '.intent', 'raw', 'observability', 'traces', 'TRACE-RUN-1000.json'),
    JSON.stringify({
      traceId: 'TRACE-RUN-1000',
      runId: 'RUN-1000',
      rootSpanId: 'SPAN-001',
      spanIds,
      createdAt: now,
      updatedAt: now,
    }, null, 2) + '\n',
  )
  writeFileSync(
    join(root, '.intent', 'raw', 'observability', 'spans', 'TRACE-RUN-1000-SPAN-999.json'),
    JSON.stringify({
      spanId: 'SPAN-999',
      traceId: 'TRACE-RUN-1000',
      runId: 'RUN-1000',
      kind: 'hook',
      name: 'previous span',
      status: 'ok',
      attributes: {},
      startedAt: now,
      endedAt: now,
    }, null, 2) + '\n',
  )

  const thousandth = appendSpanToRun(root, 'RUN-1000', { kind: 'hook', name: 'thousandth span' })
  const spans = listSpans(root, 'RUN-1000')

  assert.equal(thousandth.spanId, 'SPAN-1000')
  assert.deepEqual(spans.map((span) => span.spanId), ['SPAN-999', 'SPAN-1000'])
})
