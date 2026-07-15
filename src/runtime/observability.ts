import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, withFileLock, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import { activeRun, findRun } from './runs.js'
import {
  SpanSchema,
  TraceSchema,
  type Span,
  type SpanKind,
  type SpanStatus,
  type Trace,
} from './schemas.js'

export interface AppendSpanArgs {
  kind: SpanKind
  name: string
  status?: SpanStatus
  attributes?: Record<string, unknown>
  parentSpanId?: string | null
  startedAt?: string
  endedAt?: string | null
}

function traceIdForRun(runId: string): string {
  return `TRACE-${runId}`
}

function traceFile(root: string, traceId: string): string {
  return join(paths(root).traceDir, `${traceId}.json`)
}

function spanFile(root: string, traceId: string, spanId: string): string {
  return join(paths(root).spanDir, `${traceId}-${spanId}.json`)
}

function isSpanFile(name: string): boolean {
  return /^TRACE-RUN-\d{3,}-SPAN-\d{3,}\.json$/.test(name)
}

function loadTrace(root: string, runId: string): Trace {
  const traceId = traceIdForRun(runId)
  const parsed = TraceSchema.safeParse(readJson(traceFile(root, traceId)))
  if (parsed.success) return parsed.data
  const now = new Date().toISOString()
  return TraceSchema.parse({
    traceId,
    runId,
    createdAt: now,
    updatedAt: now,
  })
}

function nextSpanId(trace: Trace): string {
  return nextSequentialId('SPAN', trace.spanIds)
}

export function appendSpanToRun(root: string, runId: string, args: AppendSpanArgs): Span {
  const run = findRun(root, runId)
  if (!run) throw new Error(`no such run: ${runId}`)

  const file = traceFile(root, traceIdForRun(run.runId))
  return withFileLock(file, () => {
    const trace = loadTrace(root, run.runId)
    const now = new Date().toISOString()
    const span = SpanSchema.parse({
      spanId: nextSpanId(trace),
      traceId: trace.traceId,
      runId: run.runId,
      parentSpanId: args.parentSpanId ?? null,
      kind: args.kind,
      name: args.name,
      status: args.status ?? 'ok',
      attributes: args.attributes ?? {},
      startedAt: args.startedAt ?? now,
      endedAt: args.endedAt ?? now,
    })
    const updatedTrace = TraceSchema.parse({
      ...trace,
      rootSpanId: trace.rootSpanId ?? span.spanId,
      spanIds: [...trace.spanIds, span.spanId],
      updatedAt: now,
    })
    if (!writeJsonAtomicNew(spanFile(root, span.traceId, span.spanId), span)) {
      throw new Error(`span already exists: ${span.traceId}/${span.spanId}`)
    }
    writeJsonAtomic(file, updatedTrace)
    return span
  })
}

export function appendSpanToActiveRun(root: string, args: AppendSpanArgs): Span {
  const run = activeRun(root)
  if (!run) throw new Error('no active run')
  return appendSpanToRun(root, run.runId, args)
}

export function tryAppendSpanToRun(root: string, runId: string, args: AppendSpanArgs): Span | null {
  try {
    return appendSpanToRun(root, runId, args)
  } catch {
    return null
  }
}

export function tryAppendSpanToActiveRun(root: string, args: AppendSpanArgs): Span | null {
  try {
    return appendSpanToActiveRun(root, args)
  } catch {
    return null
  }
}

export function listSpans(root: string, runId?: string): Span[] {
  const dir = paths(root).spanDir
  if (!existsSync(dir)) return []
  const out: Span[] = []
  for (const f of readdirSync(dir)) {
    if (!isSpanFile(f)) continue
    const parsed = SpanSchema.safeParse(readJson(join(dir, f)))
    if (parsed.success && (!runId || parsed.data.runId === runId)) out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.runId, b.runId) || compareSequentialIds(a.spanId, b.spanId))
}
