import { loadContracts } from './contracts.js'
import { linkInterview, loadInterviews } from './interviews.js'
import { linkPlanInterview, loadPlans, updatePlan } from './plans.js'
import {
  deriveRunIndex,
  loadRunIndex,
  loadRuns,
  rebuildRunIndex,
  RunStateError,
  updateRun,
} from './runs.js'

export interface ReconciliationResult {
  applied: boolean
  repairs: string[]
  conflicts: string[]
}

interface RepairAction {
  description: string
  apply: () => void
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Reconcile only missing derived/backlink state. Existing conflicting lineage
 * is never replaced automatically; callers receive conflicts and no writes.
 */
export function reconcileState(root: string, apply = false): ReconciliationResult {
  const runs = loadRuns(root)
  const plans = loadPlans(root)
  const interviews = loadInterviews(root)
  const contracts = loadContracts(root)
  const runById = new Map(runs.map((run) => [run.runId, run]))
  const planById = new Map(plans.map((plan) => [plan.planId, plan]))
  const interviewById = new Map(interviews.map((interview) => [interview.interviewId, interview]))
  const contractById = new Map(contracts.map((contract) => [contract.contractId, contract]))
  const actions: RepairAction[] = []
  const actionKeys = new Set<string>()
  const conflicts: string[] = []
  const conflictKeys = new Set<string>()
  const addAction = (description: string, action: () => void) => {
    if (actionKeys.has(description)) return
    actionKeys.add(description)
    actions.push({ description, apply: action })
  }
  const addConflict = (description: string) => {
    if (conflictKeys.has(description)) return
    conflictKeys.add(description)
    conflicts.push(description)
  }

  for (const run of runs) {
    if (run.interviewId) {
      const interview = interviewById.get(run.interviewId)
      if (!interview) {
        addConflict(`${run.runId} references missing Interview ${run.interviewId}`)
      } else if (interview.status === 'archived') {
        addAction(`clear archived Interview ${run.interviewId} from ${run.runId}`, () => {
          updateRun(root, run.runId, (current) => ({ ...current, interviewId: null, phase: 'interview' }))
        })
      } else {
        const mismatches = [
          interview.runId && interview.runId !== run.runId ? `run=${interview.runId}` : null,
          interview.intentId && run.intentId && interview.intentId !== run.intentId ? `intent=${interview.intentId}` : null,
          interview.planId && run.planId && interview.planId !== run.planId ? `plan=${interview.planId}` : null,
          interview.specSlug && run.specSlug && interview.specSlug !== run.specSlug ? `spec=${interview.specSlug}` : null,
        ].filter((value): value is string => value !== null)
        if (mismatches.length > 0) {
          addConflict(`${run.runId} conflicts with ${interview.interviewId}: ${mismatches.join(', ')}`)
        } else if (!interview.runId || (!interview.intentId && run.intentId) || (!interview.planId && run.planId) || (!interview.specSlug && run.specSlug)) {
          addAction(`link ${interview.interviewId} lineage from ${run.runId}`, () => {
            linkInterview(root, interview.interviewId, {
              runId: run.runId,
              intentId: run.intentId,
              planId: run.planId,
              specSlug: run.specSlug,
            })
          })
        }
      }
    }

    if (run.planId) {
      const plan = planById.get(run.planId)
      if (!plan) {
        addConflict(`${run.runId} references missing Plan ${run.planId}`)
      } else if (plan.status === 'archived') {
        addAction(`clear archived Plan ${run.planId} from ${run.runId}`, () => {
          updateRun(root, run.runId, (current) => ({ ...current, planId: null, phase: 'plan' }))
        })
      } else if (plan.runId && plan.runId !== run.runId) {
        addConflict(`${run.runId} conflicts with ${plan.planId} linked to ${plan.runId}`)
      } else if (!plan.runId) {
        if (plan.status !== 'draft') {
          addConflict(`${plan.planId} is ${plan.status} and missing run backlink ${run.runId}`)
        } else {
          addAction(`link ${plan.planId} back to ${run.runId}`, () => {
            updatePlan(root, plan.planId, (current) => ({
              ...current,
              runId: run.runId,
              intentId: current.intentId ?? run.intentId,
              interviewId: current.interviewId ?? run.interviewId,
              specSlug: current.specSlug ?? run.specSlug,
            }))
          })
        }
      }
    }

    if (run.contractId) {
      const contract = contractById.get(run.contractId)
      if (!contract) addConflict(`${run.runId} references missing Contract ${run.contractId}`)
      else if (contract.status === 'archived') {
        addAction(`clear archived Contract ${run.contractId} from ${run.runId}`, () => {
          updateRun(root, run.runId, (current) => ({ ...current, contractId: null, phase: 'contract' }))
        })
      }
      else if (contract.runId !== run.runId || contract.intentId !== run.intentId) {
        addConflict(`${run.runId} conflicts with ${contract.contractId} lineage`)
      }
    }
  }

  for (const plan of plans) {
    if (plan.status === 'archived') continue
    if (plan.interviewId) {
      const interview = interviewById.get(plan.interviewId)
      if (!interview) {
        addConflict(`${plan.planId} references missing Interview ${plan.interviewId}`)
      } else if (interview.planId && interview.planId !== plan.planId) {
        addConflict(`${plan.planId} conflicts with ${interview.interviewId} plan=${interview.planId}`)
      } else if (!interview.planId) {
        addAction(`link ${interview.interviewId} to ${plan.planId}`, () => {
          linkInterview(root, interview.interviewId, {
            planId: plan.planId,
            runId: plan.runId,
            intentId: plan.intentId,
            specSlug: plan.specSlug,
          })
        })
      }
    }
    if (!plan.runId) continue
    const run = runById.get(plan.runId)
    if (!run) {
      addConflict(`${plan.planId} references missing Run ${plan.runId}`)
      continue
    }
    if (run.planId && run.planId !== plan.planId) {
      addConflict(`${plan.planId} conflicts with ${run.runId} plan=${run.planId}`)
    } else if (!run.planId) {
      addAction(`link ${run.runId} to ${plan.planId}`, () => {
        updateRun(root, run.runId, (current) => ({ ...current, planId: plan.planId }))
      })
    }
    if (plan.interviewId && !run.interviewId) {
      addAction(`link ${run.runId} to ${plan.interviewId}`, () => {
        updateRun(root, run.runId, (current) => ({ ...current, interviewId: plan.interviewId }))
      })
    } else if (plan.interviewId && run.interviewId !== plan.interviewId) {
      addConflict(`${plan.planId} conflicts with ${run.runId} interview=${run.interviewId}`)
    }
  }

  for (const contract of contracts) {
    if (contract.status === 'archived') continue
    const run = runById.get(contract.runId)
    if (!run) {
      addConflict(`${contract.contractId} references missing Run ${contract.runId}`)
      continue
    }
    if (run.intentId !== contract.intentId) addConflict(`${contract.contractId} conflicts with ${run.runId} intent=${run.intentId ?? 'null'}`)
    if (run.contractId && run.contractId !== contract.contractId) {
      addConflict(`${contract.contractId} conflicts with ${run.runId} contract=${run.contractId}`)
    } else if (!run.contractId) {
      addAction(`link ${run.runId} to ${contract.contractId}`, () => {
        updateRun(root, run.runId, (current) => ({ ...current, contractId: contract.contractId }))
      })
    }
  }

  for (const interview of interviews) {
    if (interview.status === 'archived') continue
    if (interview.planId) {
      const plan = planById.get(interview.planId)
      if (!plan) addConflict(`${interview.interviewId} references missing Plan ${interview.planId}`)
      else if (plan.interviewId && plan.interviewId !== interview.interviewId) {
        addConflict(`${interview.interviewId} conflicts with ${plan.planId} interview=${plan.interviewId}`)
      } else if (!plan.interviewId) {
        addAction(`link ${plan.planId} to ${interview.interviewId}`, () => {
          linkPlanInterview(root, plan.planId, interview.interviewId)
        })
      }
    }
    if (interview.runId) {
      const run = runById.get(interview.runId)
      if (!run) {
        addConflict(`${interview.interviewId} references missing Run ${interview.runId}`)
      } else if (run.interviewId && run.interviewId !== interview.interviewId) {
        addConflict(`${interview.interviewId} conflicts with ${run.runId} interview=${run.interviewId}`)
      } else if (!run.interviewId) {
        addAction(`link ${run.runId} to ${interview.interviewId}`, () => {
          updateRun(root, run.runId, (current) => ({ ...current, interviewId: interview.interviewId }))
        })
      }
    }
  }

  const expectedIndex = deriveRunIndex(runs)
  let indexInvalid = false
  let indexNeedsRebuild = false
  try {
    indexNeedsRebuild = !sameJson(loadRunIndex(root), expectedIndex)
  } catch (error) {
    if (!(error instanceof RunStateError)) throw error
    indexInvalid = true
    indexNeedsRebuild = true
  }
  if (indexNeedsRebuild || actions.length > 0) {
    addAction('rebuild derived Run index', () => rebuildRunIndex(root))
  }

  if (apply && conflicts.length === 0) {
    if (indexInvalid) rebuildRunIndex(root)
    for (const action of actions.filter((candidate) => candidate.description !== 'rebuild derived Run index')) action.apply()
    rebuildRunIndex(root)
  }

  return {
    applied: apply && conflicts.length === 0,
    repairs: actions.map((action) => action.description),
    conflicts,
  }
}
