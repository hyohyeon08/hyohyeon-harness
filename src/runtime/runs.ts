import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import {
  RunIndexSchema,
  RunStateSchema,
  type RunIndex,
  type RunPhase,
  type RunState,
  type RunStatus,
  type VerificationEvidence,
} from './schemas.js'

export interface CreateRunArgs {
  objective: string
  intentId?: string | null
  specSlug?: string | null
  planId?: string | null
  contractId?: string | null
  nextAction?: string | null
  phase?: RunPhase
  status?: RunStatus
  notes?: string[]
}

function runFile(root: string, id: string): string {
  return join(paths(root).runsDir, `${id}.json`)
}

function isRunFile(name: string): boolean {
  return /^RUN-\d{3}\.json$/.test(name)
}

export function loadRunIndex(root: string): RunIndex {
  const parsed = RunIndexSchema.safeParse(readJson(paths(root).runsLatest))
  return parsed.success ? parsed.data : { version: 1, activeRunId: null, recentRunIds: [] }
}

function writeRunIndex(root: string, index: RunIndex): RunIndex {
  const parsed = RunIndexSchema.parse(index)
  writeJsonAtomic(paths(root).runsLatest, parsed)
  return parsed
}

function withRecentRun(index: RunIndex, run: RunState): RunIndex {
  const recentRunIds = [run.runId, ...index.recentRunIds.filter((id) => id !== run.runId)].slice(0, 20)
  return {
    ...index,
    activeRunId: run.status === 'active' ? run.runId : index.activeRunId === run.runId ? null : index.activeRunId,
    recentRunIds,
  }
}

function refreshedTimestamp(previous: string): string {
  const now = new Date().toISOString()
  if (now !== previous) return now
  return new Date(Date.parse(now) + 1).toISOString()
}

/** Load all valid run records, skipping invalid JSON records and the index file. */
export function loadRuns(root: string): RunState[] {
  const dir = paths(root).runsDir
  if (!existsSync(dir)) return []
  const out: RunState[] = []
  for (const f of readdirSync(dir)) {
    if (!isRunFile(f)) continue
    const parsed = RunStateSchema.safeParse(readJson(join(dir, f)))
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => a.runId.localeCompare(b.runId))
}

function nextRunId(root: string): string {
  const n = loadRuns(root).length + 1
  return `RUN-${String(n).padStart(3, '0')}`
}

/** Create a new run and update the lightweight latest-runs index. */
export function createRun(root: string, args: CreateRunArgs): RunState {
  const now = new Date().toISOString()
  const run = RunStateSchema.parse({
    runId: nextRunId(root),
    objective: args.objective,
    phase: args.phase ?? 'act',
    status: args.status ?? 'active',
    intentId: args.intentId ?? null,
    specSlug: args.specSlug ?? null,
    planId: args.planId ?? null,
    contractId: args.contractId ?? null,
    nextAction: args.nextAction ?? null,
    notes: args.notes ?? [],
    createdAt: now,
    updatedAt: now,
  })
  writeJsonAtomic(runFile(root, run.runId), run)
  writeRunIndex(root, withRecentRun(loadRunIndex(root), run))
  return run
}

export function findRun(root: string, id: string): RunState | null {
  const parsed = RunStateSchema.safeParse(readJson(runFile(root, id)))
  return parsed.success ? parsed.data : null
}

/** Load, validate, transform, and atomically write one run. */
export function updateRun(root: string, id: string, fn: (run: RunState) => RunState): RunState {
  const existing = findRun(root, id)
  if (!existing) throw new Error(`no such run: ${id}`)
  const updated = RunStateSchema.parse({ ...fn(existing), updatedAt: refreshedTimestamp(existing.updatedAt) })
  writeJsonAtomic(runFile(root, id), updated)
  writeRunIndex(root, withRecentRun(loadRunIndex(root), updated))
  return updated
}

export function appendRunEvidence(root: string, id: string, evidence: VerificationEvidence): RunState {
  return updateRun(root, id, (run) => ({
    ...run,
    evidence: [...run.evidence, evidence],
  }))
}

/** Return the indexed active run when valid, otherwise the newest active run. */
export function activeRun(root: string): RunState | null {
  const index = loadRunIndex(root)
  if (index.activeRunId) {
    const indexed = findRun(root, index.activeRunId)
    if (indexed?.status === 'active') return indexed
  }
  return loadRuns(root)
    .filter((run) => run.status === 'active')
    .sort((a, b) => b.runId.localeCompare(a.runId))[0] ?? null
}
