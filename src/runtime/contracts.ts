import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import { activeRun, findRun, updateRun } from './runs.js'
import { findPlan } from './plans.js'
import { findInterview } from './interviews.js'
import { matchesScope } from './scope.js'
import {
  SprintContractSchema,
  defaultTestMatrixForIntentType,
  requiredEvidenceTypesForMatrix,
  type Intent,
  type SprintContract,
  type TestMatrix,
  type VerificationEvidence,
  type VerificationEvidenceType,
} from './schemas.js'
import { latestEvidenceForType } from './stop-gate.js'

export interface CreateContractArgs {
  runId: string
  intent: Intent
  allowedScope?: string[]
  forbiddenScope?: string[]
  architectureBoundaries?: string[]
  testMatrix?: TestMatrix
  requiredChecks?: VerificationEvidenceType[]
  definitionOfDone?: string[]
  rubric?: Record<string, number>
  stopConditions?: string[]
  requiresUserDecision?: string[]
  revision?: number
  supersedesContractId?: string | null
}

export class ContractStateError extends Error {
  constructor(id: string, detail: string) {
    super(`invalid linked contract state ${id}: ${detail}`)
    this.name = 'ContractStateError'
  }
}

function contractFile(root: string, id: string): string {
  return join(paths(root).contractsDir, `${id}.json`)
}

function isContractFile(name: string): boolean {
  return /^CONTRACT-\d{3,}\.json$/.test(name)
}

export function loadContracts(root: string): SprintContract[] {
  const dir = paths(root).contractsDir
  if (!existsSync(dir)) return []
  const out: SprintContract[] = []
  for (const f of readdirSync(dir)) {
    if (!isContractFile(f)) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, f))
    } catch (error) {
      throw new ContractStateError(f, (error as Error).message)
    }
    const parsed = SprintContractSchema.safeParse(raw)
    if (!parsed.success) throw new ContractStateError(f, parsed.error.issues.map((issue) => issue.message).join('; '))
    out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.contractId, b.contractId))
}

function nextContractId(root: string): string {
  return nextSequentialId('CONTRACT', loadContracts(root).map((contract) => contract.contractId))
}

function refreshedTimestamp(previous: string): string {
  const now = new Date().toISOString()
  if (now !== previous) return now
  return new Date(Date.parse(now) + 1).toISOString()
}

export function createContract(root: string, args: CreateContractArgs): SprintContract {
  for (;;) {
    const now = new Date().toISOString()
    const testMatrix = args.testMatrix ?? defaultTestMatrixForIntentType(args.intent.type)
    const contract = SprintContractSchema.parse({
      contractId: nextContractId(root),
      revision: args.revision ?? 1,
      supersedesContractId: args.supersedesContractId ?? null,
      runId: args.runId,
      intentId: args.intent.id,
      status: 'draft',
      allowedScope: args.allowedScope ?? args.intent.scope,
      forbiddenScope: args.forbiddenScope ?? [],
      architectureBoundaries: args.architectureBoundaries ?? [],
      testMatrix,
      requiredChecks: args.requiredChecks ?? requiredEvidenceTypesForMatrix(testMatrix),
      definitionOfDone: args.definitionOfDone ?? args.intent.dod,
      rubric: args.rubric ?? {},
      stopConditions: args.stopConditions ?? [],
      requiresUserDecision: args.requiresUserDecision ?? [],
      createdAt: now,
      updatedAt: now,
    })
    if (writeJsonAtomicNew(contractFile(root, contract.contractId), contract)) return contract
  }
}

export function findContract(root: string, id: string): SprintContract | null {
  let raw: unknown
  try {
    raw = readJson(contractFile(root, id))
  } catch (error) {
    throw new ContractStateError(id, (error as Error).message)
  }
  if (raw === null) return null
  const parsed = SprintContractSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ContractStateError(id, parsed.error.issues.map((issue) => issue.message).join('; '))
  }
  return parsed.data
}

export function updateContract(
  root: string,
  id: string,
  fn: (contract: SprintContract) => SprintContract,
): SprintContract {
  const existing = findContract(root, id)
  if (!existing) throw new Error(`no such contract: ${id}`)
  if (existing.status === 'approved') throw new Error(`approved contract ${id} is immutable; draft a replacement contract`)
  if (existing.status === 'archived') throw new Error(`archived contract ${id} is immutable`)
  const updated = SprintContractSchema.parse({
    ...fn(existing),
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(contractFile(root, id), updated)
  return updated
}

export function approveContract(root: string, id: string, approvedBy = 'human'): SprintContract {
  const existing = findContract(root, id)
  if (!existing) throw new Error(`no such contract: ${id}`)
  if (existing.status !== 'draft') throw new Error(`cannot approve contract ${id} from status ${existing.status}`)
  const run = findRun(root, existing.runId)
  const plan = run?.planId ? findPlan(root, run.planId) : null
  if (
    !run ||
    run.intentId !== existing.intentId ||
    !plan ||
    plan.status !== 'approved' ||
    plan.runId !== run.runId ||
    plan.intentId !== existing.intentId
  ) {
    throw new Error(`contract ${id} needs an approved linked plan for run ${existing.runId} and intent ${existing.intentId}`)
  }
  if (run.interviewId) {
    const interview = findInterview(root, run.interviewId)
    if (!interview || interview.status !== 'approved' || plan.interviewId !== run.interviewId) {
      throw new Error(`contract ${id} has inconsistent approved Interview lineage: ${run.interviewId}`)
    }
  }
  const approvedAt = new Date().toISOString()
  const approved = SprintContractSchema.parse({
    ...existing,
    status: 'approved',
    approvedBy,
    approvedAt,
    updatedAt: approvedAt,
  })
  writeJsonAtomic(contractFile(root, id), approved)
  return approved
}

export function archiveContract(root: string, id: string): SprintContract {
  const existing = findContract(root, id)
  if (!existing) throw new Error(`no such contract: ${id}`)
  if (existing.status !== 'approved') throw new Error(`cannot archive contract ${id} from status ${existing.status}`)
  const archived = SprintContractSchema.parse({
    ...existing,
    status: 'archived',
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(contractFile(root, id), archived)
  const run = findRun(root, archived.runId)
  if (run?.contractId === archived.contractId) {
    updateRun(root, run.runId, (current) => ({ ...current, contractId: null, phase: 'contract' }))
  }
  return archived
}

export function reviseContract(root: string, id: string): SprintContract {
  const existing = findContract(root, id)
  if (!existing) throw new Error(`no such contract: ${id}`)
  if (existing.status !== 'archived') throw new Error(`contract ${id} must be archived before revision`)
  const run = findRun(root, existing.runId)
  if (!run || run.intentId !== existing.intentId) throw new Error(`contract ${id} has no matching Run lineage`)
  const intent: Intent = {
    id: existing.intentId,
    what: run.objective,
    why: 'contract revision',
    type: 'feature',
    scope: existing.allowedScope,
    dod: existing.definitionOfDone,
    dodChecked: [],
    status: 'approved',
    approvedBy: 'human',
    learnings: null,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  }
  return createContract(root, {
    runId: existing.runId,
    intent,
    allowedScope: existing.allowedScope,
    forbiddenScope: existing.forbiddenScope,
    architectureBoundaries: existing.architectureBoundaries,
    testMatrix: existing.testMatrix,
    requiredChecks: existing.requiredChecks,
    definitionOfDone: existing.definitionOfDone,
    rubric: existing.rubric,
    stopConditions: existing.stopConditions,
    requiresUserDecision: existing.requiresUserDecision,
    revision: existing.revision + 1,
    supersedesContractId: existing.contractId,
  })
}

export interface ContractPathDecision {
  blocked: boolean
  reason: string
}

export function activeContract(root: string): SprintContract | null {
  const run = activeRun(root)
  if (!run?.contractId) return null
  const contract = findContract(root, run.contractId)
  if (!contract) throw new ContractStateError(run.contractId, `referenced by ${run.runId} but file is missing`)
  return contract?.status === 'approved' ? contract : null
}

export function checkContractScope(path: string, contract: SprintContract | null): ContractPathDecision {
  if (!contract || contract.status !== 'approved') return { blocked: false, reason: 'no approved contract scope' }
  if (contract.forbiddenScope.length > 0 && matchesScope(path, contract.forbiddenScope)) {
    return {
      blocked: true,
      reason: `${contract.contractId} forbids changes to ${path} via forbiddenScope (${contract.forbiddenScope.join(', ')})`,
    }
  }
  if (contract.allowedScope.length > 0 && !matchesScope(path, contract.allowedScope)) {
    return {
      blocked: true,
      reason: `${contract.contractId} blocks ${path}: outside allowedScope (${contract.allowedScope.join(', ')})`,
    }
  }
  return { blocked: false, reason: 'inside approved contract scope' }
}

/** Backward-compatible name for callers that only consumed forbidden-scope decisions. */
export function checkContractForbiddenScope(path: string, contract: SprintContract | null): ContractPathDecision {
  return checkContractScope(path, contract)
}

export type ContractCheckStatus = 'passed' | 'failed' | 'missing'

export interface ContractCheckReport {
  type: VerificationEvidenceType
  status: ContractCheckStatus
  evidence: VerificationEvidence | null
}

export interface ContractReport {
  contract: SprintContract
  checks: ContractCheckReport[]
}

export function buildContractReport(root: string, id: string): ContractReport {
  const contract = findContract(root, id)
  if (!contract) throw new Error(`no such contract: ${id}`)
  const run = findRun(root, contract.runId)
  const checks = contract.requiredChecks.map((type) => {
    const latest = run ? latestEvidenceForType(run, type) : null
    if (!latest) return { type, status: 'missing' as const, evidence: null }
    return {
      type,
      status: latest.status === 'passed' ? 'passed' as const : 'failed' as const,
      evidence: latest,
    }
  })
  return { contract, checks }
}
