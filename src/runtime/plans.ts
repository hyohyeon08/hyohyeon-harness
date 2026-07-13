import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import {
  PlanSchema,
  type Plan,
  type PlanStatus,
  type PlanVerificationCommand,
} from './schemas.js'
import { loadRuns, updateRun } from './runs.js'

export class PlanStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid plan state ${file}: ${detail}`)
    this.name = 'PlanStateError'
  }
}

export interface CreatePlanArgs {
  title: string
  objective?: string
  problem?: string
  intentId?: string | null
  interviewId?: string | null
  specSlug?: string | null
  runId?: string | null
  allowedScope?: string[]
  forbiddenScope?: string[]
  expectedChanges?: string[]
  researchRefs?: string[]
  implementationSteps?: string[]
  testStrategy?: string
  verificationCommands?: PlanVerificationCommand[]
  definitionOfDone?: string[]
  risks?: string[]
  revision?: number
  supersedesPlanId?: string | null
}

function isPlanFile(name: string): boolean {
  return /^PLAN-\d{3,}\.json$/.test(name)
}

function nextPlanId(root: string): string {
  return nextSequentialId('PLAN', loadPlans(root).map((plan) => plan.planId))
}

function planFile(root: string, planId: string): string {
  return paths(root).planFile(planId)
}

function refreshedTimestamp(previous: string): string {
  const now = new Date().toISOString()
  if (now !== previous) return now
  return new Date(Date.parse(now) + 1).toISOString()
}

export function loadPlans(root: string): Plan[] {
  const dir = paths(root).plansDir
  if (!existsSync(dir)) return []
  const out: Plan[] = []
  for (const file of readdirSync(dir)) {
    if (!isPlanFile(file)) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, file))
    } catch (error) {
      throw new PlanStateError(file, (error as Error).message)
    }
    const parsed = PlanSchema.safeParse(raw)
    if (!parsed.success) throw new PlanStateError(file, parsed.error.issues.map((issue) => issue.message).join('; '))
    out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.planId, b.planId))
}

export function findPlan(root: string, planId: string): Plan | null {
  let raw: unknown
  try {
    raw = readJson(planFile(root, planId))
  } catch (error) {
    throw new PlanStateError(`${planId}.json`, (error as Error).message)
  }
  if (raw === null) return null
  const parsed = PlanSchema.safeParse(raw)
  if (!parsed.success) throw new PlanStateError(`${planId}.json`, parsed.error.issues.map((issue) => issue.message).join('; '))
  return parsed.data
}

export function createPlan(root: string, args: CreatePlanArgs): Plan {
  for (;;) {
    const now = new Date().toISOString()
    const plan = PlanSchema.parse({
      planId: nextPlanId(root),
      revision: args.revision ?? 1,
      supersedesPlanId: args.supersedesPlanId ?? null,
      title: args.title,
      objective: args.objective ?? args.title,
      problem: args.problem ?? '',
      intentId: args.intentId ?? null,
      interviewId: args.interviewId ?? null,
      specSlug: args.specSlug ?? null,
      runId: args.runId ?? null,
      allowedScope: args.allowedScope ?? ['**'],
      forbiddenScope: args.forbiddenScope ?? [],
      expectedChanges: args.expectedChanges ?? [],
      researchRefs: args.researchRefs ?? [],
      implementationSteps: args.implementationSteps ?? [],
      testStrategy: args.testStrategy ?? '',
      verificationCommands: args.verificationCommands ?? [],
      definitionOfDone: args.definitionOfDone ?? [],
      risks: args.risks ?? [],
      createdAt: now,
      updatedAt: now,
    })
    if (writeJsonAtomicNew(planFile(root, plan.planId), plan)) return plan
  }
}

export function updatePlan(root: string, planId: string, fn: (plan: Plan) => Plan): Plan {
  const existing = findPlan(root, planId)
  if (!existing) throw new Error(`no such plan: ${planId}`)
  if (existing.status === 'approved') throw new Error(`approved plan ${planId} is immutable; draft a replacement plan`)
  if (existing.status === 'archived') throw new Error(`archived plan ${planId} is immutable`)
  const updated = PlanSchema.parse({
    ...fn(existing),
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(planFile(root, planId), updated)
  return updated
}

export function approvePlan(root: string, planId: string, approvedBy: string): Plan {
  const existing = findPlan(root, planId)
  if (!existing) throw new Error(`no such plan: ${planId}`)
  if (existing.status !== 'draft') throw new Error(`cannot approve plan ${planId} from status ${existing.status}`)
  const approvedAt = new Date().toISOString()
  const approved = PlanSchema.parse({
    ...existing,
    status: 'approved',
    approvedBy,
    approvedAt,
    updatedAt: approvedAt,
  })
  writeJsonAtomic(planFile(root, planId), approved)
  return approved
}

export function archivePlan(root: string, planId: string): Plan {
  const existing = findPlan(root, planId)
  if (!existing) throw new Error(`no such plan: ${planId}`)
  if (existing.status !== 'approved') throw new Error(`cannot archive plan ${planId} from status ${existing.status}`)
  const linkedRuns = loadRuns(root).filter((run) => run.planId === planId)
  if (linkedRuns.some((run) => run.contractId)) {
    throw new Error(`cannot archive plan ${planId} while a linked Run has a Contract; archive the Contract first`)
  }
  const archived = PlanSchema.parse({
    ...existing,
    status: 'archived',
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(planFile(root, planId), archived)
  for (const run of linkedRuns) {
    updateRun(root, run.runId, (current) => ({ ...current, planId: null, phase: 'plan' }))
  }
  return archived
}

export function revisePlan(root: string, planId: string, title?: string): Plan {
  const existing = findPlan(root, planId)
  if (!existing) throw new Error(`no such plan: ${planId}`)
  if (existing.status !== 'archived') throw new Error(`plan ${planId} must be archived before revision`)
  return createPlan(root, {
    title: title ?? existing.title,
    objective: existing.objective,
    problem: existing.problem,
    intentId: existing.intentId,
    interviewId: existing.interviewId,
    specSlug: existing.specSlug,
    allowedScope: existing.allowedScope,
    forbiddenScope: existing.forbiddenScope,
    expectedChanges: existing.expectedChanges,
    researchRefs: existing.researchRefs,
    implementationSteps: existing.implementationSteps,
    testStrategy: existing.testStrategy,
    verificationCommands: existing.verificationCommands,
    definitionOfDone: existing.definitionOfDone,
    risks: existing.risks,
    revision: existing.revision + 1,
    supersedesPlanId: existing.planId,
  })
}

/** Append the upstream Interview reference without reopening approved Plan content. */
export function linkPlanInterview(root: string, planId: string, interviewId: string): Plan {
  const existing = findPlan(root, planId)
  if (!existing) throw new Error(`no such plan: ${planId}`)
  if (existing.status === 'archived') throw new Error(`archived plan ${planId} is immutable`)
  if (existing.interviewId && existing.interviewId !== interviewId) {
    throw new Error(`plan ${planId} is already linked to ${existing.interviewId}`)
  }
  const updated = PlanSchema.parse({
    ...existing,
    interviewId: existing.interviewId ?? interviewId,
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(planFile(root, planId), updated)
  return updated
}

export function setPlanStatus(root: string, planId: string, status: PlanStatus): Plan {
  if (status === 'approved') return approvePlan(root, planId, 'human')
  return updatePlan(root, planId, (plan) => ({ ...plan, status }))
}
