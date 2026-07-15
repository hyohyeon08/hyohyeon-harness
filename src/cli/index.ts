#!/usr/bin/env node
import {
  cmdSetup, cmdStatus, cmdDraft, cmdApprove, cmdList, cmdDod, cmdCheck, cmdLearn, cmdComplete,
  cmdStopCheck, cmdReconcile,
} from './commands/core.js'
import { cmdRule, cmdDetection, cmdMonitor, cmdJudge, cmdReviewer, cmdEval } from './commands/feedback.js'
import { cmdHandoff, cmdWiki, cmdPostmortem } from './commands/knowledge.js'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/** Find the harness install root (works for both dist/ and ts-node src/ layouts). */
function findHarnessRoot(start: string): string {
  let d = start
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, '.claude', 'settings.template.json')) && existsSync(join(d, 'skills'))) return d
    const up = dirname(d)
    if (up === d) break
    d = up
  }
  return resolve(start, '../../..')
}
const HARNESS_ROOT = findHarnessRoot(dirname(fileURLToPath(import.meta.url)))
import { loadIntents } from '../runtime/intents.js'
import { draftSpec, approveSpec, specExists } from '../runtime/spec.js'
import {
  archiveInterview,
  approveInterview,
  createInterview,
  findInterview,
  linkInterview,
  loadInterviews,
  reviseInterview,
} from '../runtime/interviews.js'
import {
  activeRun,
  createRun,
  findRun,
  loadRuns,
  recordRunAttempt,
  setRunAttemptBudget,
  transitionRunPhase,
  updateRun,
} from '../runtime/runs.js'
import { runVerification } from '../runtime/verification.js'
import { runCommand } from '../runtime/commands.js'
import { assertRunPhasePrerequisites } from '../runtime/execution-governance.js'
import {
  approveContract,
  archiveContract,
  buildContractReport,
  createContract,
  findContract,
  loadContracts,
  reviseContract,
  updateContract,
} from '../runtime/contracts.js'
import { archivePlan, approvePlan, createPlan, findPlan, linkPlanInterview, loadPlans, revisePlan, updatePlan } from '../runtime/plans.js'
import { approvalActorForCli } from './shared.js'
import {
  defaultTestMatrixForIntentType,
  type Plan,
  type PlanVerificationCommand,
  RunPhaseSchema,
  RunStatusSchema,
  requiredEvidenceTypesForMatrix,
  VerificationEvidenceTypeSchema,
  type SprintContract,
} from '../runtime/schemas.js'

const root = process.cwd()
const [, , command, ...args] = process.argv
const cliContext = { root, args, harnessRoot: HARNESS_ROOT }

function findIntent(id: string) {
  const i = loadIntents(root).find((x) => x.id === id)
  if (!i) {
    console.error(`no such intent: ${id}`)
    process.exit(1)
  }
  return i
}

function runLine(run: { runId: string; status: string; phase: string; objective: string; intentId: string | null }): string {
  const intent = run.intentId ? ` (${run.intentId})` : ''
  return `${run.runId} [${run.status}/${run.phase}] ${run.objective}${intent}`
}

function runByIdOrActive(id?: string) {
  const run = id ? findRun(root, id) : activeRun(root)
  if (!run) {
    console.error(id ? `no such run: ${id}` : 'no active run')
    process.exit(1)
  }
  return run
}

function cmdRun(): void {
  const sub = args[0]
  try {
    if (sub === 'start') {
      const [intentId, objective] = [args[1], args[2]]
      if (!intentId || !objective) {
        console.error('usage: intent run start <intentId> "<objective>"')
        process.exit(1)
      }
      const intent = findIntent(intentId)
      const interviewId = flagValue('--interview')
      if (interviewId && !findInterview(root, interviewId)) throw new Error(`no such interview: ${interviewId}`)
      const requiredEvidenceTypes = requiredEvidenceTypesForMatrix(defaultTestMatrixForIntentType(intent.type))
      const phase = intent.type === 'feature' || intent.type === 'fix' ? 'plan' : 'act'
      const run = createRun(root, { intentId, interviewId: interviewId ?? null, objective, phase, requiredEvidenceTypes })
      if (interviewId) linkInterview(root, interviewId, { intentId, runId: run.runId })
      console.log(`started ${run.runId} for ${intentId}: ${run.objective}`)
    } else if (sub === 'status') {
      const run = activeRun(root)
      if (!run) {
        console.log('active run: none')
        return
      }
      console.log('active run')
      console.log(`  ${runLine(run)}`)
      console.log(`  budget: ${run.budget.attemptsUsed}/${run.budget.maxAttempts}`)
      if (run.nextAction) console.log(`  next: ${run.nextAction}`)
      if (run.notes.length > 0) {
        console.log('  notes:')
        for (const note of run.notes) console.log(`    - ${note}`)
      }
    } else if (sub === 'list' || !sub) {
      const runs = loadRuns(root)
      if (runs.length === 0) {
        console.log('no runs')
        return
      }
      for (const run of runs) {
        const intent = run.intentId ? `  ${run.intentId}` : ''
        console.log(`${run.runId}  [${run.status}/${run.phase}]  ${run.objective}${intent}`)
      }
    } else if (sub === 'note') {
      const text = args[1]
      if (!text) {
        console.error('usage: intent run note "<text>"')
        process.exit(1)
      }
      const run = runByIdOrActive()
      const updated = updateRun(root, run.runId, (r) => ({ ...r, notes: [...r.notes, text] }))
      console.log(`noted ${updated.runId}`)
    } else if (sub === 'phase') {
      const phase = RunPhaseSchema.safeParse(args[1])
      if (!phase.success) {
        console.error('usage: intent run phase <interview|plan|contract|act|verify|done> [runId]')
        process.exit(1)
      }
      const run = runByIdOrActive(args[2])
      assertRunPhasePrerequisites(root, run, phase.data)
      const updated = transitionRunPhase(root, run.runId, phase.data)
      console.log(`phase ${updated.runId}: ${updated.phase}`)
    } else if (sub === 'status-set') {
      const status = RunStatusSchema.safeParse(args[1])
      if (!status.success) {
        console.error('usage: intent run status-set <active|blocked|passing|paused> [runId]')
        process.exit(1)
      }
      const run = runByIdOrActive(args[2])
      const updated = updateRun(root, run.runId, (r) => ({ ...r, status: status.data }))
      console.log(`status ${updated.runId}: ${updated.status}`)
    } else if (sub === 'next') {
      const text = args[1]
      if (!text) {
        console.error('usage: intent run next "<text>" [runId]')
        process.exit(1)
      }
      const run = runByIdOrActive(args[2])
      const updated = updateRun(root, run.runId, (r) => ({ ...r, nextAction: text }))
      console.log(`next ${updated.runId}: ${updated.nextAction}`)
    } else if (sub === 'budget') {
      const maxAttempts = Number(args[1])
      if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
        console.error('usage: intent run budget <maxAttempts> [runId]')
        process.exit(1)
      }
      const run = runByIdOrActive(args[2])
      const updated = setRunAttemptBudget(root, run.runId, maxAttempts)
      console.log(`budget ${updated.runId}: ${updated.budget.attemptsUsed}/${updated.budget.maxAttempts} ${updated.status}`)
    } else if (sub === 'attempt') {
      const maybeRunId = args[1]?.startsWith('RUN-') ? args[1] : args[2]
      const note = args[1]?.startsWith('RUN-') ? undefined : args[1]
      const run = runByIdOrActive(maybeRunId)
      const updated = recordRunAttempt(root, run.runId, note)
      console.log(`attempt ${updated.runId}: ${updated.budget.attemptsUsed}/${updated.budget.maxAttempts} ${updated.status}`)
    } else {
      console.error('usage: intent run list | start <intentId> "<objective>" | status | note "<text>" | phase <phase> [runId] | status-set <status> [runId] | next "<text>" [runId] | budget <maxAttempts> [runId] | attempt ["note"] [runId]')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function flagValue(name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

function flagValues(name: string): string[] {
  const values: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1])
  }
  return values
}

function splitList(values: string[]): string[] {
  return values.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean)
}

function optionalList(values: string[]): string[] | undefined {
  const list = splitList(values)
  return list.length > 0 ? list : undefined
}

function parsePlanVerificationCommand(raw: string): PlanVerificationCommand {
  const separator = raw.indexOf(':')
  if (separator === -1) throw new Error(`plan check must be <type>:<command...>: ${raw}`)
  const type = VerificationEvidenceTypeSchema.parse(raw.slice(0, separator))
  const commandLine = raw.slice(separator + 1).trim()
  const [command, ...commandArgs] = commandLine.split(/\s+/).filter(Boolean)
  if (!command) throw new Error(`plan check command is empty: ${raw}`)
  return { type, command, args: commandArgs }
}

function interviewSummaryLine(summary: { interviewId: string; status: string; title: string }): string {
  return `${summary.interviewId} [${summary.status}] ${summary.title}`
}

function printInterviewList(title: string, values: string[]): void {
  console.log(`${title}:`)
  for (const value of values.length > 0 ? values : ['—']) console.log(`  - ${value}`)
}

function printInterview(interviewId: string): void {
  const summary = findInterview(root, interviewId)
  if (!summary) throw new Error(`no such interview: ${interviewId}`)
  console.log(interviewSummaryLine(summary))
  console.log(`goal: ${summary.goal}`)
  if (summary.why) console.log(`why: ${summary.why}`)
  printInterviewList('context', summary.context)
  printInterviewList('constraints', summary.constraints)
  printInterviewList('allowed scope', summary.allowedScope)
  printInterviewList('forbidden scope', summary.forbiddenScope)
  printInterviewList('success criteria', summary.successCriteria)
  printInterviewList('failure criteria', summary.failureCriteria)
  printInterviewList('verification', summary.verification)
  printInterviewList('considered options', summary.consideredOptions)
  printInterviewList('non-goals', summary.nonGoals)
  printInterviewList('assumptions', summary.assumptions)
  printInterviewList('open questions', summary.openQuestions)
  console.log(`lineage: intent=${summary.intentId ?? '—'} spec=${summary.specSlug ?? '—'} plan=${summary.planId ?? '—'} run=${summary.runId ?? '—'}`)
}

function cmdInterview(): void {
  const sub = args[0]
  try {
    if (sub === 'draft') {
      const title = args[1]
      if (!title) {
        console.error('usage: intent interview draft "<title>" [--goal ... --why ... --context ... --constraint ... --allow ... --forbid ... --success ... --failure ... --verify ... --option ... --non-goal ... --assumption ... --question ...]')
        process.exit(1)
      }
      const summary = createInterview(root, {
        title,
        goal: flagValue('--goal') ?? title,
        why: flagValue('--why') ?? '',
        context: flagValues('--context'),
        constraints: flagValues('--constraint'),
        allowedScope: optionalList(flagValues('--allow')),
        forbiddenScope: splitList(flagValues('--forbid')),
        successCriteria: flagValues('--success'),
        failureCriteria: flagValues('--failure'),
        verification: flagValues('--verify'),
        consideredOptions: flagValues('--option'),
        nonGoals: flagValues('--non-goal'),
        assumptions: flagValues('--assumption'),
        openQuestions: flagValues('--question'),
      })
      console.log(`interview drafted ${summary.interviewId}: ${summary.title}`)
    } else if (sub === 'show') {
      const interviewId = args[1]
      if (!interviewId) {
        console.error('usage: intent interview show <interviewId>')
        process.exit(1)
      }
      printInterview(interviewId)
    } else if (sub === 'list' || !sub) {
      const summaries = loadInterviews(root)
      if (summaries.length === 0) {
        console.log('no interviews')
        return
      }
      for (const summary of summaries) console.log(interviewSummaryLine(summary))
    } else if (sub === 'approve') {
      const interviewId = args[1]
      if (!interviewId) {
        console.error('usage: intent interview approve <interviewId>')
        process.exit(1)
      }
      const approved = approveInterview(root, interviewId, approvalActorForCli())
      console.log(`approved ${approved.interviewId} by ${approved.approvedBy}`)
    } else if (sub === 'archive') {
      const interviewId = args[1]
      if (!interviewId) throw new Error('usage: intent interview archive <interviewId>')
      const archived = archiveInterview(root, interviewId)
      console.log(`archived ${archived.interviewId}`)
    } else if (sub === 'revise') {
      const interviewId = args[1]
      if (!interviewId) throw new Error('usage: intent interview revise <interviewId> [title]')
      const revision = reviseInterview(root, interviewId, args[2])
      console.log(`interview revised ${revision.interviewId} r${revision.revision} supersedes ${interviewId}`)
    } else if (sub === 'link') {
      const interviewId = args[1]
      if (!interviewId) {
        console.error('usage: intent interview link <interviewId> [--intent id --spec slug --plan id --run id]')
        process.exit(1)
      }
      const summary = findInterview(root, interviewId)
      if (!summary) throw new Error(`no such interview: ${interviewId}`)
      const intentId = flagValue('--intent')
      const specSlug = flagValue('--spec')
      const planId = flagValue('--plan')
      const runId = flagValue('--run')
      if (!intentId && !specSlug && !planId && !runId) throw new Error('interview link needs at least one lineage flag')
      if (intentId) findIntent(intentId)
      if (specSlug && !specExists(root, specSlug)) throw new Error(`no such spec: ${specSlug}`)
      const plan = planId ? findPlan(root, planId) : null
      if (planId && !plan) throw new Error(`no such plan: ${planId}`)
      const run = runId ? findRun(root, runId) : null
      if (runId && !run) throw new Error(`no such run: ${runId}`)
      if (plan?.interviewId && plan.interviewId !== interviewId) throw new Error(`plan ${plan.planId} is already linked to ${plan.interviewId}`)
      if (run?.interviewId && run.interviewId !== interviewId) throw new Error(`run ${run.runId} is already linked to ${run.interviewId}`)

      const linked = linkInterview(root, interviewId, { intentId, specSlug, planId, runId })
      if (plan) linkPlanInterview(root, plan.planId, interviewId)
      if (run) updateRun(root, run.runId, (current) => ({ ...current, interviewId }))
      console.log(`linked ${linked.interviewId}: intent=${linked.intentId ?? '—'} spec=${linked.specSlug ?? '—'} plan=${linked.planId ?? '—'} run=${linked.runId ?? '—'}`)
    } else {
      console.error('usage: intent interview list | draft "<title>" [flags] | show <interviewId> | approve <interviewId> | archive <interviewId> | revise <interviewId> [title] | link <interviewId> [lineage flags]')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function planSummary(plan: Plan): string {
  const run = plan.runId ? ` ${plan.runId}` : ''
  return `${plan.planId} [${plan.status}] ${plan.title}${run}`
}

function printPlan(plan: Plan): void {
  console.log(planSummary(plan))
  console.log(`objective: ${plan.objective}`)
  if (plan.problem) console.log(`problem: ${plan.problem}`)
  if (plan.intentId) console.log(`intent: ${plan.intentId}`)
  if (plan.interviewId) console.log(`interview: ${plan.interviewId}`)
  if (plan.specSlug) console.log(`spec: ${plan.specSlug}`)
  if (plan.runId) console.log(`run: ${plan.runId}`)
  console.log('allowed scope:')
  for (const item of plan.allowedScope.length > 0 ? plan.allowedScope : ['—']) console.log(`  - ${item}`)
  console.log('forbidden scope:')
  for (const item of plan.forbiddenScope.length > 0 ? plan.forbiddenScope : ['—']) console.log(`  - ${item}`)
  console.log('steps:')
  for (const item of plan.implementationSteps.length > 0 ? plan.implementationSteps : ['—']) console.log(`  - ${item}`)
  console.log('verification commands:')
  for (const item of plan.verificationCommands.length > 0 ? plan.verificationCommands : []) {
    console.log(`  - ${item.type}: ${[item.command, ...item.args].join(' ')}`)
  }
  if (plan.verificationCommands.length === 0) console.log('  - —')
  console.log('definition of done:')
  for (const item of plan.definitionOfDone.length > 0 ? plan.definitionOfDone : ['—']) console.log(`  - ${item}`)
  console.log('risks:')
  for (const item of plan.risks.length > 0 ? plan.risks : ['—']) console.log(`  - ${item}`)
}

function cmdPlan(): void {
  const sub = args[0]
  try {
    if (sub === 'draft') {
      const title = args[1]
      if (!title) {
        console.error('usage: intent plan draft "<title>" [--objective ... --problem ... --scope ... --forbid ... --check type:cmd...]')
        process.exit(1)
      }
      const explicitRunId = flagValue('--run')
      const run = explicitRunId ? findRun(root, explicitRunId) : activeRun(root)
      if (explicitRunId && !run) throw new Error(`no such run: ${explicitRunId}`)
      const checks = flagValues('--check').map(parsePlanVerificationCommand)
      const interviewId = flagValue('--interview') ?? run?.interviewId ?? null
      if (interviewId && !findInterview(root, interviewId)) throw new Error(`no such interview: ${interviewId}`)
      const plan = createPlan(root, {
        title,
        objective: flagValue('--objective') ?? run?.objective ?? title,
        problem: flagValue('--problem') ?? '',
        intentId: flagValue('--intent') ?? run?.intentId ?? null,
        interviewId,
        specSlug: flagValue('--spec') ?? run?.specSlug ?? null,
        runId: explicitRunId ?? run?.runId ?? null,
        allowedScope: optionalList(flagValues('--scope')),
        forbiddenScope: optionalList(flagValues('--forbid')),
        expectedChanges: flagValues('--change'),
        researchRefs: flagValues('--research'),
        implementationSteps: flagValues('--step'),
        testStrategy: flagValue('--test-strategy') ?? '',
        verificationCommands: checks,
        definitionOfDone: flagValues('--dod'),
        risks: flagValues('--risk'),
      })
      if (run && plan.runId === run.runId) updateRun(root, run.runId, (current) => ({ ...current, planId: plan.planId }))
      if (interviewId) {
        linkInterview(root, interviewId, {
          intentId: plan.intentId,
          specSlug: plan.specSlug,
          planId: plan.planId,
          runId: plan.runId,
        })
      }
      console.log(`plan drafted ${plan.planId}: ${plan.title}`)
    } else if (sub === 'show') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent plan show <planId>')
        process.exit(1)
      }
      const plan = findPlan(root, id)
      if (!plan) throw new Error(`no such plan: ${id}`)
      printPlan(plan)
    } else if (sub === 'list' || !sub) {
      const plans = loadPlans(root)
      if (plans.length === 0) {
        console.log('no plans')
        return
      }
      for (const plan of plans) console.log(planSummary(plan))
    } else if (sub === 'link') {
      const planId = args[1]
      const runId = args[2] ?? activeRun(root)?.runId
      if (!planId || !runId) {
        console.error('usage: intent plan link <planId> [runId]')
        process.exit(1)
      }
      const plan = findPlan(root, planId)
      if (!plan) throw new Error(`no such plan: ${planId}`)
      const run = findRun(root, runId)
      if (!run) throw new Error(`no such run: ${runId}`)
      updateRun(root, run.runId, (current) => ({ ...current, planId: plan.planId }))
      const linked = updatePlan(root, plan.planId, (current) => ({
        ...current,
        runId: run.runId,
        intentId: current.intentId ?? run.intentId,
        specSlug: current.specSlug ?? run.specSlug,
      }))
      console.log(`linked ${linked.planId} to ${run.runId}`)
    } else if (sub === 'approve') {
      const planId = args[1]
      if (!planId) {
        console.error('usage: intent plan approve <planId>')
        process.exit(1)
      }
      const plan = approvePlan(root, planId, approvalActorForCli())
      console.log(`approved ${plan.planId} by ${plan.approvedBy}`)
    } else if (sub === 'archive') {
      const planId = args[1]
      if (!planId) throw new Error('usage: intent plan archive <planId>')
      const plan = archivePlan(root, planId)
      console.log(`archived ${plan.planId}`)
    } else if (sub === 'revise') {
      const planId = args[1]
      if (!planId) throw new Error('usage: intent plan revise <planId> [title]')
      const plan = revisePlan(root, planId, args[2])
      console.log(`plan revised ${plan.planId} r${plan.revision} supersedes ${planId}`)
    } else {
      console.error('usage: intent plan list | draft "<title>" [flags] | show <planId> | link <planId> [runId] | approve <planId> | archive <planId> | revise <planId> [title]')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdVerify(): void {
  const sub = args[0]
  try {
    if (sub === 'list') {
      const run = activeRun(root)
      if (!run) {
        console.error('no active run')
        process.exit(1)
      }
      if (run.evidence.length === 0) {
        console.log(`no evidence for ${run.runId}`)
        return
      }
      for (const evidence of run.evidence) {
        const exit = evidence.exitCode === null ? 'null' : String(evidence.exitCode)
        const command = [evidence.command, ...evidence.args].join(' ')
        console.log(`${evidence.evidenceId}  [${evidence.status}]  ${evidence.type}  exit=${exit}  ${command}`)
        console.log(`  log: ${evidence.logPath}`)
      }
      return
    }

    const type = VerificationEvidenceTypeSchema.safeParse(sub)
    const separator = args.indexOf('--')
    if (!type.success || separator !== 1 || separator === args.length - 1) {
      console.error('usage: intent verify <type> -- <command...> | intent verify list')
      process.exit(1)
    }
    const commandAndArgs = args.slice(separator + 1)
    const [verifyCommand, ...verifyArgs] = commandAndArgs
    const run = activeRun(root)
    if (!run) {
      console.error('no active run')
      process.exit(1)
    }

    const evidence = runVerification(root, {
      runId: run.runId,
      type: type.data,
      command: verifyCommand,
      args: verifyArgs,
    })
    const exit = evidence.exitCode === null ? 'null' : String(evidence.exitCode)
    console.log(`verify ${evidence.status}: ${run.runId} ${evidence.type} exit=${exit}`)
    console.log(`log: ${evidence.logPath}`)
    if (evidence.exitCode !== 0) process.exit(evidence.exitCode ?? 1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdCommand(): void {
  try {
    const separator = args.indexOf('--')
    if (separator !== 0 || args.length < 2) {
      console.error('usage: intent command -- <command...>')
      process.exit(1)
    }
    const run = activeRun(root)
    if (!run) throw new Error('no active run')
    const [commandName, ...commandArgs] = args.slice(1)
    const result = runCommand(root, { runId: run.runId, command: commandName, args: commandArgs })
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    process.stderr.write(`command exit=${result.exitCode === null ? 'null' : result.exitCode} log=${result.logPath}\n`)
    if (result.exitCode !== 0) process.exit(result.exitCode ?? 1)
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
}

function contractSummary(contract: SprintContract): string {
  return `${contract.contractId} [${contract.status}] ${contract.runId} ${contract.intentId}`
}

function printContractMachinePolicy(contract: SprintContract): void {
  console.log('machine-enforced policy (active only when approved and linked):')
  console.log(`  status: ${contract.status}`)
  console.log(
    `  lineage: run=${contract.runId} intent=${contract.intentId} revision=${contract.revision} supersedes=${contract.supersedesContractId ?? '—'}`,
  )
  console.log('  allowed scope:')
  for (const item of contract.allowedScope) console.log(`  - ${item}`)
  console.log('  forbidden scope:')
  for (const item of contract.forbiddenScope.length > 0 ? contract.forbiddenScope : ['—']) console.log(`  - ${item}`)
}

function printContractReviewerMetadata(contract: SprintContract): void {
  console.log('reviewer metadata (not automatic completion gates):')
  console.log('  architecture boundaries:')
  for (const item of contract.architectureBoundaries.length > 0 ? contract.architectureBoundaries : ['—']) {
    console.log(`  - ${item}`)
  }
  console.log('  definition of done:')
  for (const item of contract.definitionOfDone.length > 0 ? contract.definitionOfDone : ['—']) console.log(`  - ${item}`)
  console.log('  rubric:')
  const rubricEntries = Object.entries(contract.rubric)
  for (const [key, value] of rubricEntries.length > 0 ? rubricEntries : [['—', '—']]) console.log(`  - ${key}: ${value}`)
  console.log('  stop conditions:')
  for (const item of contract.stopConditions.length > 0 ? contract.stopConditions : ['—']) console.log(`  - ${item}`)
  console.log('  requires user decision:')
  for (const item of contract.requiresUserDecision.length > 0 ? contract.requiresUserDecision : ['—']) console.log(`  - ${item}`)
}

function printContract(contract: SprintContract): void {
  console.log(contractSummary(contract))
  printContractMachinePolicy(contract)
  console.log('  required checks:')
  for (const item of contract.requiredChecks.length > 0 ? contract.requiredChecks : ['—']) console.log(`  - ${item}`)
  printContractReviewerMetadata(contract)
}

function appendUnique<T>(current: T[], added: T[]): T[] {
  return [...current, ...added.filter((item) => !current.includes(item))]
}

function parseRequiredCheckList(raw: string[]): SprintContract['requiredChecks'] {
  return splitList(raw).map((value) => VerificationEvidenceTypeSchema.parse(value))
}

function parseRubric(raw: string[]): Record<string, number> {
  const rubric: Record<string, number> = {}
  for (const item of raw) {
    const separator = item.indexOf('=')
    const key = item.slice(0, separator).trim()
    const value = Number(item.slice(separator + 1))
    if (separator <= 0 || !Number.isFinite(value)) throw new Error(`rubric item must be key=number: ${item}`)
    rubric[key] = value
  }
  return rubric
}

function printContractReport(contractId: string): void {
  const report = buildContractReport(root, contractId)
  console.log(`contract report ${report.contract.contractId} [${report.contract.status}]`)
  printContractMachinePolicy(report.contract)
  console.log('  required checks:')
  for (const check of report.checks.length > 0 ? report.checks : []) {
    const evidence = check.evidence ? ` (${check.evidence.evidenceId})` : ''
    console.log(`  - ${check.type}: ${check.status}${evidence}`)
  }
  if (report.checks.length === 0) console.log('  - —')
  printContractReviewerMetadata(report.contract)
}

function printReviewerContractSemantics(): void {
  console.log('')
  console.log('## Contract Field Semantics')
  console.log('- Machine-enforced policy: status/lineage, allowedScope, forbiddenScope, requiredChecks.')
  console.log(
    '- Reviewer metadata only (not automatic completion gates): architectureBoundaries, definitionOfDone, rubric, stopConditions, requiresUserDecision.',
  )
}

function cmdContract(): void {
  const sub = args[0]
  try {
    if (sub === 'draft') {
      const runId = args[1] ?? activeRun(root)?.runId
      if (!runId) {
        console.error('usage: intent contract draft [runId]')
        process.exit(1)
      }
      const run = findRun(root, runId)
      if (!run) throw new Error(`no such run: ${runId}`)
      if (!run.intentId) throw new Error(`run ${run.runId} has no linked intent`)
      const intent = findIntent(run.intentId)
      const contract = createContract(root, { runId: run.runId, intent })
      updateRun(root, run.runId, (r) => ({ ...r, contractId: contract.contractId }))
      console.log(`contract drafted ${contract.contractId} for ${run.runId} (${intent.id})`)
      console.log(`required: ${contract.requiredChecks.join(', ') || 'none'}`)
    } else if (sub === 'show') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent contract show <contractId>')
        process.exit(1)
      }
      const contract = findContract(root, id)
      if (!contract) throw new Error(`no such contract: ${id}`)
      printContract(contract)
    } else if (sub === 'approve') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent contract approve <contractId>')
        process.exit(1)
      }
      const contract = approveContract(root, id, approvalActorForCli())
      console.log(`approved ${contract.contractId} by ${contract.approvedBy}`)
    } else if (sub === 'archive') {
      const id = args[1]
      if (!id) throw new Error('usage: intent contract archive <contractId>')
      const contract = archiveContract(root, id)
      console.log(`archived ${contract.contractId}`)
    } else if (sub === 'revise') {
      const id = args[1]
      if (!id) throw new Error('usage: intent contract revise <contractId>')
      const contract = reviseContract(root, id)
      updateRun(root, contract.runId, (run) => ({ ...run, contractId: contract.contractId, phase: 'contract' }))
      console.log(`contract revised ${contract.contractId} r${contract.revision} supersedes ${id}`)
    } else if (sub === 'edit') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent contract edit <contractId> [--require type] [--allow scope] [--forbid scope] [--boundary text] [--dod text] [--stop text] [--decision text] [--rubric key=value]')
        process.exit(1)
      }
      const requiredChecks = parseRequiredCheckList(flagValues('--require'))
      const rubric = parseRubric(flagValues('--rubric'))
      const contract = updateContract(root, id, (current) => ({
        ...current,
        requiredChecks: appendUnique(current.requiredChecks, requiredChecks),
        allowedScope: appendUnique(current.allowedScope, splitList(flagValues('--allow'))),
        forbiddenScope: appendUnique(current.forbiddenScope, splitList(flagValues('--forbid'))),
        architectureBoundaries: appendUnique(current.architectureBoundaries, flagValues('--boundary')),
        definitionOfDone: appendUnique(current.definitionOfDone, flagValues('--dod')),
        stopConditions: appendUnique(current.stopConditions, flagValues('--stop')),
        requiresUserDecision: appendUnique(current.requiresUserDecision, flagValues('--decision')),
        rubric: { ...current.rubric, ...rubric },
      }))
      console.log(`edited ${contract.contractId}`)
    } else if (sub === 'report') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent contract report <contractId>')
        process.exit(1)
      }
      printContractReport(id)
    } else if (sub === 'list' || !sub) {
      const contracts = loadContracts(root)
      if (contracts.length === 0) {
        console.log('no contracts')
        return
      }
      for (const contract of contracts) console.log(contractSummary(contract))
    } else {
      console.error('usage: intent contract list | draft [runId] | show <contractId> | approve <contractId> | archive <contractId> | revise <contractId> | edit <contractId> [flags] | report <contractId>')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdSpec(): void {
  const sub = args[0]
  try {
    if (sub === 'draft') {
      if (!args[1]) {
        console.error('usage: intent spec draft "<title>" [--interview <interviewId>]')
        process.exit(1)
      }
      const run = activeRun(root)
      const interviewId = flagValue('--interview') ?? run?.interviewId ?? null
      if (interviewId && !findInterview(root, interviewId)) throw new Error(`no such interview: ${interviewId}`)
      const { slug } = draftSpec(root, args[1])
      if (run) updateRun(root, run.runId, (current) => ({ ...current, specSlug: slug, interviewId }))
      if (interviewId) {
        linkInterview(root, interviewId, {
          intentId: run?.intentId,
          specSlug: slug,
          runId: run?.runId,
        })
      }
      console.log(`spec drafted: wiki/${slug} — fill with \`intent wiki append ${slug} "..."\`, then activate with \`intent spec approve ${slug}\``)
      if (run) console.log(`linked ${slug} to ${run.runId}`)
    } else if (sub === 'approve') {
      const actor = approvalActorForCli()
      approveSpec(root, args[1], actor)
      console.log(`spec approved: ${args[1]} by ${actor}`)
    } else if (sub === 'link') {
      const slug = args[1]
      const runId = args[2] ?? activeRun(root)?.runId
      if (!slug || !runId) {
        console.error('usage: intent spec link <slug> [runId]')
        process.exit(1)
      }
      if (!specExists(root, slug)) throw new Error(`no such spec: ${slug}`)
      const run = findRun(root, runId)
      if (!run) throw new Error(`no such run: ${runId}`)
      const updated = updateRun(root, run.runId, (current) => ({ ...current, specSlug: slug }))
      console.log(`linked ${slug} to ${updated.runId}`)
    } else {
      console.error('usage: intent spec draft "<title>" [--interview <interviewId>] | approve <slug> | link <slug> [runId]')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

switch (command) {
  case 'setup':
    cmdSetup(cliContext)
    break
  case 'status':
    cmdStatus(cliContext)
    break
  case 'draft':
    cmdDraft(cliContext)
    break
  case 'approve':
    cmdApprove(cliContext)
    break
  case 'list':
    cmdList(cliContext)
    break
  case 'dod':
    cmdDod(cliContext)
    break
  case 'check':
    cmdCheck(cliContext)
    break
  case 'learn':
    cmdLearn(cliContext)
    break
  case 'complete':
    cmdComplete(cliContext)
    break
  case 'run':
    cmdRun()
    break
  case 'interview':
    cmdInterview()
    break
  case 'plan':
    cmdPlan()
    break
  case 'verify':
    cmdVerify()
    break
  case 'command':
    cmdCommand()
    break
  case 'contract':
    cmdContract()
    break
  case 'detection':
    cmdDetection(cliContext)
    break
  case 'monitor':
    cmdMonitor(cliContext)
    break
  case 'judge':
    cmdJudge(cliContext)
    break
  case 'reviewer':
    cmdReviewer(cliContext)
    if (args[0] === 'checklist') printReviewerContractSemantics()
    break
  case 'eval':
    cmdEval(cliContext)
    break
  case 'stop-check':
    cmdStopCheck(cliContext)
    break
  case 'reconcile':
    cmdReconcile(cliContext)
    break
  case 'handoff':
    cmdHandoff(cliContext)
    break
  case 'wiki':
    cmdWiki(cliContext)
    break
  case 'rule':
    cmdRule(cliContext)
    break
  case 'postmortem':
    cmdPostmortem(cliContext)
    break
  case 'spec':
    cmdSpec()
    break
  default:
    console.error(
      'commands: setup | status | draft | approve | list | dod | check | learn | complete | run | interview | plan | verify | command | contract | detection | monitor | judge | reviewer | eval | stop-check | reconcile | handoff | wiki | rule | postmortem | spec',
    )
    process.exit(command ? 1 : 0)
}
