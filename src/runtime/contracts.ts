import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { activeRun } from './runs.js'
import { matchesScope } from './scope.js'
import {
  SprintContractSchema,
  defaultTestMatrixForIntentType,
  requiredEvidenceTypesForMatrix,
  type Intent,
  type SprintContract,
  type TestMatrix,
  type VerificationEvidenceType,
} from './schemas.js'

export interface CreateContractArgs {
  runId: string
  intent: Intent
  allowedScope?: string[]
  forbiddenScope?: string[]
  architectureBoundaries?: string[]
  testMatrix?: TestMatrix
  requiredChecks?: VerificationEvidenceType[]
  definitionOfDone?: string[]
}

function contractFile(root: string, id: string): string {
  return join(paths(root).contractsDir, `${id}.json`)
}

function isContractFile(name: string): boolean {
  return /^CONTRACT-\d{3}\.json$/.test(name)
}

export function loadContracts(root: string): SprintContract[] {
  const dir = paths(root).contractsDir
  if (!existsSync(dir)) return []
  const out: SprintContract[] = []
  for (const f of readdirSync(dir)) {
    if (!isContractFile(f)) continue
    const parsed = SprintContractSchema.safeParse(readJson(join(dir, f)))
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => a.contractId.localeCompare(b.contractId))
}

function nextContractId(root: string): string {
  const n = loadContracts(root).length + 1
  return `CONTRACT-${String(n).padStart(3, '0')}`
}

export function createContract(root: string, args: CreateContractArgs): SprintContract {
  const now = new Date().toISOString()
  const testMatrix = args.testMatrix ?? defaultTestMatrixForIntentType(args.intent.type)
  const contract = SprintContractSchema.parse({
    contractId: nextContractId(root),
    runId: args.runId,
    intentId: args.intent.id,
    status: 'draft',
    allowedScope: args.allowedScope ?? args.intent.scope,
    forbiddenScope: args.forbiddenScope ?? [],
    architectureBoundaries: args.architectureBoundaries ?? [],
    testMatrix,
    requiredChecks: args.requiredChecks ?? requiredEvidenceTypesForMatrix(testMatrix),
    definitionOfDone: args.definitionOfDone ?? args.intent.dod,
    createdAt: now,
    updatedAt: now,
  })
  writeJsonAtomic(contractFile(root, contract.contractId), contract)
  return contract
}

export function findContract(root: string, id: string): SprintContract | null {
  const parsed = SprintContractSchema.safeParse(readJson(contractFile(root, id)))
  return parsed.success ? parsed.data : null
}

export interface ContractPathDecision {
  blocked: boolean
  reason: string
}

export function activeContract(root: string): SprintContract | null {
  const run = activeRun(root)
  if (!run?.contractId) return null
  return findContract(root, run.contractId)
}

export function checkContractForbiddenScope(path: string, contract: SprintContract | null): ContractPathDecision {
  if (!contract || contract.forbiddenScope.length === 0) return { blocked: false, reason: 'no contract forbidden scope' }
  if (!matchesScope(path, contract.forbiddenScope)) return { blocked: false, reason: 'not in contract forbidden scope' }
  return {
    blocked: true,
    reason: `${contract.contractId} forbids changes to ${path} via forbiddenScope (${contract.forbiddenScope.join(', ')})`,
  }
}
