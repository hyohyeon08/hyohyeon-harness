import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, withFileLock, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import {
  RunIndexSchema,
  RunStateSchema,
  type RunIndex,
  type RunBudget,
  type RunPhase,
  type RunState,
  type RunStatus,
  type VerificationEvidence,
  type VerificationEvidenceType,
} from './schemas.js'

export class RunStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid run state ${file}: ${detail}`)
    this.name = 'RunStateError'
  }
}

export interface CreateRunArgs {
  objective: string
  intentId?: string | null
  interviewId?: string | null
  specSlug?: string | null
  planId?: string | null
  contractId?: string | null
  nextAction?: string | null
  phase?: RunPhase
  status?: RunStatus
  budget?: Partial<RunBudget>
  notes?: string[]
  requiredEvidenceTypes?: VerificationEvidenceType[]
}

function runFile(root: string, id: string): string {
  return join(paths(root).runsDir, `${id}.json`)
}

function isRunFile(name: string): boolean {
  return /^RUN-\d{3,}\.json$/.test(name)
}

export function loadRunIndex(root: string): RunIndex {
  let raw: unknown
  try {
    raw = readJson(paths(root).runsLatest)
  } catch (error) {
    throw new RunStateError('latest-runs.json', (error as Error).message)
  }
  if (raw === null) return { version: 1, activeRunId: null, recentRunIds: [] }
  const parsed = RunIndexSchema.safeParse(raw)
  if (!parsed.success) {
    throw new RunStateError('latest-runs.json', parsed.error.issues.map((issue) => issue.message).join('; '))
  }
  return parsed.data
}

function writeRunIndexUnlocked(root: string, index: RunIndex): RunIndex {
  const parsed = RunIndexSchema.parse(index)
  writeJsonAtomic(paths(root).runsLatest, parsed)
  return parsed
}

function updateRunIndex(root: string, fn: (index: RunIndex) => RunIndex): RunIndex {
  return withFileLock(paths(root).runsLatest, () => writeRunIndexUnlocked(root, fn(loadRunIndex(root))))
}

function compareRunRecency(left: RunState, right: RunState): number {
  const leftTime = Date.parse(left.updatedAt)
  const rightTime = Date.parse(right.updatedAt)
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime
  return compareSequentialIds(right.runId, left.runId)
}

/** The run index is a rebuildable cache derived from validated Run records. */
export function deriveRunIndex(runs: RunState[]): RunIndex {
  const recent = [...runs].sort(compareRunRecency)
  return RunIndexSchema.parse({
    version: 1,
    activeRunId: recent.find((run) => run.status === 'active')?.runId ?? null,
    recentRunIds: recent.slice(0, 20).map((run) => run.runId),
  })
}

export function rebuildRunIndex(root: string): RunIndex {
  return withFileLock(
    paths(root).runsLatest,
    () => writeRunIndexUnlocked(root, deriveRunIndex(loadRuns(root))),
  )
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

/** Load all run records. Corrupt governance state is a fail-closed error. */
export function loadRuns(root: string): RunState[] {
  const dir = paths(root).runsDir
  if (!existsSync(dir)) return []
  const out: RunState[] = []
  for (const f of readdirSync(dir)) {
    if (!isRunFile(f)) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, f))
    } catch (error) {
      throw new RunStateError(f, (error as Error).message)
    }
    const parsed = RunStateSchema.safeParse(raw)
    if (!parsed.success) throw new RunStateError(f, parsed.error.issues.map((issue) => issue.message).join('; '))
    out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.runId, b.runId))
}

function nextRunId(root: string): string {
  return nextSequentialId('RUN', loadRuns(root).map((run) => run.runId))
}

/** Create a new run and update the lightweight latest-runs index. */
export function createRun(root: string, args: CreateRunArgs): RunState {
  for (;;) {
    const now = new Date().toISOString()
    const run = RunStateSchema.parse({
      runId: nextRunId(root),
      objective: args.objective,
      phase: args.phase ?? 'act',
      status: args.status ?? 'active',
      intentId: args.intentId ?? null,
      interviewId: args.interviewId ?? null,
      specSlug: args.specSlug ?? null,
      planId: args.planId ?? null,
      contractId: args.contractId ?? null,
      nextAction: args.nextAction ?? null,
      budget: args.budget,
      notes: args.notes ?? [],
      requiredEvidenceTypes: args.requiredEvidenceTypes ?? [],
      createdAt: now,
      updatedAt: now,
    })
    if (!writeJsonAtomicNew(runFile(root, run.runId), run)) continue
    updateRunIndex(root, (index) => withRecentRun(index, run))
    return run
  }
}

export function findRun(root: string, id: string): RunState | null {
  let raw: unknown
  try {
    raw = readJson(runFile(root, id))
  } catch (error) {
    throw new RunStateError(`${id}.json`, (error as Error).message)
  }
  if (raw === null) return null
  const parsed = RunStateSchema.safeParse(raw)
  if (!parsed.success) throw new RunStateError(`${id}.json`, parsed.error.issues.map((issue) => issue.message).join('; '))
  return parsed.data
}

/** Load, validate, transform, and atomically write one run. */
export function updateRun(root: string, id: string, fn: (run: RunState) => RunState): RunState {
  const file = runFile(root, id)
  return withFileLock(file, () => {
    const existing = findRun(root, id)
    if (!existing) throw new Error(`no such run: ${id}`)
    const updated = RunStateSchema.parse({ ...fn(existing), updatedAt: refreshedTimestamp(existing.updatedAt) })
    writeJsonAtomic(file, updated)
    updateRunIndex(root, (index) => withRecentRun(index, updated))
    return updated
  })
}

export function appendRunEvidence(root: string, id: string, evidence: VerificationEvidence): RunState {
  return updateRun(root, id, (run) => ({
    ...run,
    evidence: [...run.evidence, evidence],
  }))
}

export function setRunAttemptBudget(root: string, id: string, maxAttempts: number): RunState {
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error('maxAttempts must be a positive integer')
  }
  return updateRun(root, id, (run) => {
    const budget = { ...run.budget, maxAttempts }
    const exhausted = budget.attemptsUsed >= budget.maxAttempts
    return {
      ...run,
      budget,
      status: exhausted ? 'blocked' : run.status,
      nextAction: exhausted
        ? `Attempt budget exhausted (${budget.attemptsUsed}/${budget.maxAttempts}); revise the plan before continuing.`
        : run.nextAction,
    }
  })
}

export function recordRunAttempt(root: string, id: string, note?: string): RunState {
  return updateRun(root, id, (run) => {
    const attemptsUsed = run.budget.attemptsUsed + 1
    const budget = { ...run.budget, attemptsUsed }
    const exhausted = attemptsUsed >= budget.maxAttempts
    const attemptNote = note ? [`attempt ${attemptsUsed}/${budget.maxAttempts}: ${note}`] : []
    return {
      ...run,
      budget,
      status: exhausted ? 'blocked' : run.status,
      nextAction: exhausted
        ? `Attempt budget exhausted (${attemptsUsed}/${budget.maxAttempts}); revise the plan before continuing.`
        : run.nextAction,
      notes: [...run.notes, ...attemptNote],
    }
  })
}

export function blockRun(root: string, id: string, reason: string, nextAction: string): RunState {
  return updateRun(root, id, (run) => ({
    ...run,
    status: 'blocked',
    nextAction,
    notes: run.notes.includes(reason) ? run.notes : [...run.notes, reason],
  }))
}

const RUN_PHASE_TRANSITIONS: Record<RunPhase, readonly RunPhase[]> = {
  interview: ['plan'],
  plan: ['contract'],
  contract: ['act'],
  act: ['verify'],
  verify: ['act'],
  done: [],
}

/** Move through the execution loop. Terminal `done` is reserved for the completion gate. */
export function transitionRunPhase(root: string, id: string, nextPhase: RunPhase): RunState {
  return updateRun(root, id, (run) => {
    if (nextPhase === 'done') {
      throw new Error('run phase done is completion-gated; use intent complete')
    }
    if (nextPhase === run.phase) return run
    if (!RUN_PHASE_TRANSITIONS[run.phase].includes(nextPhase)) {
      throw new Error(`invalid run phase transition: ${run.phase} -> ${nextPhase}`)
    }
    return { ...run, phase: nextPhase }
  })
}

/** Terminal state change used only after the shared completion evaluator passes. */
export function markRunComplete(root: string, id: string): RunState {
  return updateRun(root, id, (run) => ({
    ...run,
    phase: 'done',
    status: 'passing',
    nextAction: null,
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
    .sort((a, b) => compareSequentialIds(b.runId, a.runId))[0] ?? null
}

/**
 * Return the newest Run governed by an Intent, regardless of execution status.
 * `activeRun` is an interaction focus; completion responsibility survives
 * blocked/paused/passing transitions.
 */
export function latestRunForIntent(root: string, intentId: string): RunState | null {
  return loadRuns(root)
    .filter((run) => run.intentId === intentId)
    .sort((a, b) => compareSequentialIds(b.runId, a.runId))[0] ?? null
}
