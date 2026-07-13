import type { Intent, RunState, SprintContract } from './schemas.js'
import { findPlan } from './plans.js'
import { findContract } from './contracts.js'
import { findInterview } from './interviews.js'

export interface ExecutionGovernanceDecision {
  allow: boolean
  reason: string
}

type IntentIdentity = Pick<Intent, 'id' | 'type'>
type RunIdentity = Pick<RunState, 'runId' | 'intentId' | 'phase'>
type ContractIdentity = Pick<SprintContract, 'contractId' | 'status' | 'runId' | 'intentId'>

/** Pure execution precondition for behavior-changing non-trivial writes. */
export function checkExecutionGovernance(
  intent: IntentIdentity,
  run?: RunIdentity | null,
  contract?: ContractIdentity | null,
): ExecutionGovernanceDecision {
  if (intent.type !== 'feature' && intent.type !== 'fix') {
    return { allow: true, reason: `${intent.type} execution is contract-optional` }
  }
  if (!run || run.intentId !== intent.id) {
    return { allow: false, reason: `${intent.id} needs an active Run linked to the same Intent` }
  }
  if (run.phase !== 'act' && run.phase !== 'verify') {
    return { allow: false, reason: `${run.runId} is in phase ${run.phase}; feature/fix writes require act or verify` }
  }
  if (
    !contract ||
    contract.status !== 'approved' ||
    contract.runId !== run.runId ||
    contract.intentId !== intent.id
  ) {
    return { allow: false, reason: `${run.runId} needs an approved Contract linked to ${intent.id}` }
  }
  return { allow: true, reason: `${run.runId} execution is governed by ${contract.contractId}` }
}

/** Validate artifact approval prerequisites before a CLI phase transition. */
export function assertRunPhasePrerequisites(root: string, run: RunState, nextPhase: RunState['phase']): void {
  if (run.phase === 'interview' && nextPhase === 'plan' && run.interviewId) {
    const interview = findInterview(root, run.interviewId)
    if (!interview || interview.status !== 'approved') {
      throw new Error(`${run.runId} needs approved Interview ${run.interviewId} before plan phase`)
    }
  }
  if (run.phase === 'plan' && nextPhase === 'contract') {
    const plan = run.planId ? findPlan(root, run.planId) : null
    if (!plan || plan.status !== 'approved' || plan.runId !== run.runId || plan.intentId !== run.intentId) {
      throw new Error(`${run.runId} needs an approved linked Plan before contract phase`)
    }
  }
  if (run.phase === 'contract' && nextPhase === 'act') {
    const contract = run.contractId ? findContract(root, run.contractId) : null
    if (!contract || contract.status !== 'approved' || contract.runId !== run.runId || contract.intentId !== run.intentId) {
      throw new Error(`${run.runId} needs an approved linked Contract before act phase`)
    }
  }
}
