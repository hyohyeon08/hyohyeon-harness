import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import { InterviewSummarySchema, type InterviewSummary } from './schemas.js'
import { loadPlans } from './plans.js'
import { loadRuns, updateRun } from './runs.js'

export class InterviewStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid interview state ${file}: ${detail}`)
    this.name = 'InterviewStateError'
  }
}

export interface CreateInterviewArgs {
  title: string
  goal?: string
  why?: string
  context?: string[]
  constraints?: string[]
  allowedScope?: string[]
  forbiddenScope?: string[]
  successCriteria?: string[]
  failureCriteria?: string[]
  verification?: string[]
  consideredOptions?: string[]
  nonGoals?: string[]
  assumptions?: string[]
  openQuestions?: string[]
  intentId?: string | null
  specSlug?: string | null
  planId?: string | null
  runId?: string | null
  revision?: number
  supersedesInterviewId?: string | null
}

export interface InterviewLineage {
  intentId?: string | null
  specSlug?: string | null
  planId?: string | null
  runId?: string | null
}

function isInterviewFile(name: string): boolean {
  return /^INTERVIEW-\d{3,}\.json$/.test(name)
}

function nextInterviewId(root: string): string {
  return nextSequentialId('INTERVIEW', loadInterviews(root).map((summary) => summary.interviewId))
}

function refreshedTimestamp(previous: string): string {
  const now = new Date().toISOString()
  if (now !== previous) return now
  return new Date(Date.parse(now) + 1).toISOString()
}

export function loadInterviews(root: string): InterviewSummary[] {
  const dir = paths(root).interviewsDir
  if (!existsSync(dir)) return []
  const summaries: InterviewSummary[] = []
  for (const file of readdirSync(dir)) {
    if (!isInterviewFile(file)) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, file))
    } catch (error) {
      throw new InterviewStateError(file, (error as Error).message)
    }
    const parsed = InterviewSummarySchema.safeParse(raw)
    if (!parsed.success) {
      throw new InterviewStateError(file, parsed.error.issues.map((issue) => issue.message).join('; '))
    }
    summaries.push(parsed.data)
  }
  return summaries.sort((a, b) => compareSequentialIds(a.interviewId, b.interviewId))
}

export function findInterview(root: string, interviewId: string): InterviewSummary | null {
  let raw: unknown
  try {
    raw = readJson(paths(root).interviewFile(interviewId))
  } catch (error) {
    throw new InterviewStateError(`${interviewId}.json`, (error as Error).message)
  }
  if (raw === null) return null
  const parsed = InterviewSummarySchema.safeParse(raw)
  if (!parsed.success) {
    throw new InterviewStateError(`${interviewId}.json`, parsed.error.issues.map((issue) => issue.message).join('; '))
  }
  return parsed.data
}

export function createInterview(root: string, args: CreateInterviewArgs): InterviewSummary {
  for (;;) {
    const now = new Date().toISOString()
    const summary = InterviewSummarySchema.parse({
      interviewId: nextInterviewId(root),
      revision: args.revision ?? 1,
      supersedesInterviewId: args.supersedesInterviewId ?? null,
      title: args.title,
      goal: args.goal ?? args.title,
      why: args.why ?? '',
      context: args.context ?? [],
      constraints: args.constraints ?? [],
      allowedScope: args.allowedScope ?? ['**'],
      forbiddenScope: args.forbiddenScope ?? [],
      successCriteria: args.successCriteria ?? [],
      failureCriteria: args.failureCriteria ?? [],
      verification: args.verification ?? [],
      consideredOptions: args.consideredOptions ?? [],
      nonGoals: args.nonGoals ?? [],
      assumptions: args.assumptions ?? [],
      openQuestions: args.openQuestions ?? [],
      intentId: args.intentId ?? null,
      specSlug: args.specSlug ?? null,
      planId: args.planId ?? null,
      runId: args.runId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    if (writeJsonAtomicNew(paths(root).interviewFile(summary.interviewId), summary)) return summary
  }
}

export function updateInterview(
  root: string,
  interviewId: string,
  fn: (summary: InterviewSummary) => InterviewSummary,
): InterviewSummary {
  const existing = findInterview(root, interviewId)
  if (!existing) throw new Error(`no such interview: ${interviewId}`)
  if (existing.status === 'approved') {
    throw new Error(`approved interview ${interviewId} content is immutable; create a replacement interview`)
  }
  if (existing.status === 'archived') throw new Error(`archived interview ${interviewId} is immutable`)
  const updated = InterviewSummarySchema.parse({
    ...fn(existing),
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(paths(root).interviewFile(interviewId), updated)
  return updated
}

export function approveInterview(root: string, interviewId: string, approvedBy = 'human'): InterviewSummary {
  const existing = findInterview(root, interviewId)
  if (!existing) throw new Error(`no such interview: ${interviewId}`)
  if (existing.status !== 'draft') {
    throw new Error(`cannot approve interview ${interviewId} from status ${existing.status}`)
  }
  const approvedAt = new Date().toISOString()
  const approved = InterviewSummarySchema.parse({
    ...existing,
    status: 'approved',
    approvedBy,
    approvedAt,
    updatedAt: approvedAt,
  })
  writeJsonAtomic(paths(root).interviewFile(interviewId), approved)
  return approved
}

export function archiveInterview(root: string, interviewId: string): InterviewSummary {
  const existing = findInterview(root, interviewId)
  if (!existing) throw new Error(`no such interview: ${interviewId}`)
  if (existing.status !== 'approved') throw new Error(`cannot archive interview ${interviewId} from status ${existing.status}`)
  if (loadPlans(root).some((plan) => plan.interviewId === interviewId && plan.status !== 'archived')) {
    throw new Error(`cannot archive interview ${interviewId} while a linked Plan is not archived`)
  }
  const archived = InterviewSummarySchema.parse({
    ...existing,
    status: 'archived',
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(paths(root).interviewFile(interviewId), archived)
  for (const run of loadRuns(root).filter((candidate) => candidate.interviewId === interviewId)) {
    updateRun(root, run.runId, (current) => ({ ...current, interviewId: null, phase: 'interview' }))
  }
  return archived
}

export function reviseInterview(root: string, interviewId: string, title?: string): InterviewSummary {
  const existing = findInterview(root, interviewId)
  if (!existing) throw new Error(`no such interview: ${interviewId}`)
  if (existing.status !== 'archived') throw new Error(`interview ${interviewId} must be archived before revision`)
  return createInterview(root, {
    title: title ?? existing.title,
    goal: existing.goal,
    why: existing.why,
    context: existing.context,
    constraints: existing.constraints,
    allowedScope: existing.allowedScope,
    forbiddenScope: existing.forbiddenScope,
    successCriteria: existing.successCriteria,
    failureCriteria: existing.failureCriteria,
    verification: existing.verification,
    consideredOptions: existing.consideredOptions,
    nonGoals: existing.nonGoals,
    assumptions: existing.assumptions,
    openQuestions: existing.openQuestions,
    revision: existing.revision + 1,
    supersedesInterviewId: existing.interviewId,
  })
}

function appendLineageValue(
  interviewId: string,
  key: keyof InterviewLineage,
  current: string | null,
  next: string | null | undefined,
): string | null {
  if (!next) return current
  if (current && current !== next) {
    throw new Error(`interview lineage ${key} is already ${current}; cannot replace it with ${next}`)
  }
  return current ?? next
}

/** Append downstream references without reopening approved interview content. */
export function linkInterview(root: string, interviewId: string, lineage: InterviewLineage): InterviewSummary {
  const existing = findInterview(root, interviewId)
  if (!existing) throw new Error(`no such interview: ${interviewId}`)
  if (existing.status === 'archived') throw new Error(`archived interview ${interviewId} is immutable`)
  const updated = InterviewSummarySchema.parse({
    ...existing,
    intentId: appendLineageValue(interviewId, 'intentId', existing.intentId, lineage.intentId),
    specSlug: appendLineageValue(interviewId, 'specSlug', existing.specSlug, lineage.specSlug),
    planId: appendLineageValue(interviewId, 'planId', existing.planId, lineage.planId),
    runId: appendLineageValue(interviewId, 'runId', existing.runId, lineage.runId),
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(paths(root).interviewFile(interviewId), updated)
  return updated
}
