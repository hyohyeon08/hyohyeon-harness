#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { paths } from '../state/paths.js'
import { installCodexHooks, installCodexSkills, installHooks, installSkills } from '../runtime/install.js'

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
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { DEFAULT_CONFIG, StateSchema, type State } from '../runtime/schemas.js'
import {
  loadIntents,
  draftIntent,
  approveIntent,
  checkDod,
  recordLearning,
  completeIntent,
} from '../runtime/intents.js'
import { evaluateCompletionAttempt } from '../runtime/completion.js'
import { parseDraftArgs } from '../runtime/draft-args.js'
import { appendScratch, writeHandoff, type ScratchKind } from '../runtime/handoff.js'
import { recentLogLines } from '../runtime/memory.js'
import {
  newArticle,
  appendArticle,
  readArticle,
  listArticles,
  rebuildIndex,
  lintWiki,
  setStatus,
  type WikiType,
  type Status,
} from '../runtime/wiki.js'
import {
  loadRules,
  findRule,
  draftRule,
  approveRule,
  composeAgentsRuleCandidate,
  composeCiRuleCandidate,
  composeRuleImpactReport,
  recordRuleReflection,
} from '../runtime/rules.js'
import { recordPostmortem } from '../runtime/postmortem.js'
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
  markRunComplete,
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
import {
  blockRunForDetections,
  detectRunMonitorIssues,
} from '../runtime/monitor.js'
import { buildJudgeInputBundle } from '../runtime/judge.js'
import { runJudgeAdapter } from '../runtime/judge-adapter.js'
import {
  loadJudgePolicy,
  runEmbeddingAdapter,
  runJudgeBatch,
  selectJudgeCandidates,
} from '../runtime/judge-policy.js'
import { buildReviewerChecklist } from '../runtime/reviewer.js'
import { draftEvalCaseFromDetection, runEvalCases } from '../runtime/evals.js'
import {
  findDetection,
  loadDetections,
  recordJudgeResult,
  recordDetectionWikiPage,
  resolveDetection,
  unIngestedDetections,
} from '../runtime/detections.js'
import { isAiAgent } from '../runtime/env.js'
import { reconcileState } from '../runtime/reconcile.js'
import {
  DetectionResultSchema,
  defaultTestMatrixForIntentType,
  JudgeStatusSchema,
  RuleReflectionKindSchema,
  RuleReflectionStatusSchema,
  type Plan,
  type PlanVerificationCommand,
  RunPhaseSchema,
  RunStatusSchema,
  requiredEvidenceTypesForMatrix,
  VerificationEvidenceTypeSchema,
  type DetectionRecord,
  type RuleKind,
  type SprintContract,
} from '../runtime/schemas.js'

/** Human decisions are human-only — refuse when an AI agent runs the CLI. */
function assertHumanShell(action = 'approval'): void {
  if (isAiAgent()) {
    console.error(`${action} is human-only (AI agent environment detected). Run this from your own shell.`)
    process.exit(1)
  }
}

const root = process.cwd()
const [, , command, ...args] = process.argv

function cmdSetup(): void {
  const p = paths(root)
  mkdirSync(p.intentsDir, { recursive: true })
  if (!existsSync(p.state)) {
    const state: State = { version: 1, activeIntentId: null }
    writeJsonAtomic(p.state, state)
  }
  if (!existsSync(p.config)) writeJsonAtomic(p.config, DEFAULT_CONFIG)
  if (!existsSync(p.decisions)) writeFileSync(p.decisions, '# Decisions\n\n', 'utf8')
  if (!existsSync(p.learnings)) writeFileSync(p.learnings, '# Learnings\n\n', 'utf8')
  mkdirSync(p.runsDir, { recursive: true })
  mkdirSync(p.interviewsDir, { recursive: true })
  mkdirSync(p.plansDir, { recursive: true })
  mkdirSync(p.rawDir, { recursive: true })
  mkdirSync(p.commandResultsDir, { recursive: true })
  for (const type of VerificationEvidenceTypeSchema.options) {
    mkdirSync(p.verificationResultsDir(type), { recursive: true })
  }
  mkdirSync(p.wikiKnowledgeDir, { recursive: true })
  mkdirSync(p.wikiProblemsDir, { recursive: true })
  if (!existsSync(p.wikiIndex)) rebuildIndex(root)
  mkdirSync(p.rulesDir, { recursive: true })
  console.log(`intent: initialized .intent/ at ${p.base}`)

  const installAll = args.includes('--install-hooks')
  const installClaude = installAll || args.includes('--install-claude')
  const installCodex = installAll || args.includes('--install-codex')
  if (installClaude || installCodex) {
    if (root === HARNESS_ROOT) {
      console.error('refusing to install hooks into the harness repo itself; run from a target project')
      process.exit(1)
    }
    if (installClaude) {
      const settings = installHooks(HARNESS_ROOT, root)
      const n = installSkills(HARNESS_ROOT, root)
      console.log(`intent: Claude hooks → ${settings}`)
      console.log(`intent: ${n} Claude skills → ${join(root, '.claude', 'skills')}`)
    }
    if (installCodex) {
      const hooks = installCodexHooks(HARNESS_ROOT, root)
      const n = installCodexSkills(HARNESS_ROOT, root)
      console.log(`intent: Codex hooks → ${hooks}`)
      console.log(`intent: ${n} Codex skills → ${join(root, '.agents', 'skills')}`)
    }
    console.log('intent: restart Claude Code/Codex (new session) to load hooks/skills.')
  }
}

function cmdStatus(): void {
  const p = paths(root)
  if (!existsSync(p.base)) {
    console.log('intent: not initialized. Run `intent setup`.')
    return
  }
  const intents = loadIntents(root)
  const by = (s: string) => intents.filter((i) => i.status === s).length
  console.log('intent status')
  console.log(`  intents: ${intents.length} (draft=${by('draft')} approved=${by('approved')} done=${by('done')})`)
  const state = StateSchema.safeParse(readJson(p.state))
  console.log(`  active: ${state.success ? state.data.activeIntentId ?? '—' : '—'}`)
}

function cmdDraft(): void {
  let parsed
  try {
    parsed = parseDraftArgs(args)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
  const intent = draftIntent(root, parsed)
  console.log(`drafted ${intent.id} (status: draft — awaiting human approval via \`intent approve ${intent.id}\`)`)
}

function cmdApprove(): void {
  assertHumanShell()
  const id = args[0]
  if (!id) {
    console.error('usage: intent approve <id>')
    process.exit(1)
  }
  const intent = approveIntent(root, id)
  console.log(`approved ${intent.id} by ${intent.approvedBy}`)
}

function cmdRule(): void {
  const sub = args[0]
  try {
    if (sub === 'draft') {
      const kind = args[1] as RuleKind
      if (kind !== 'forbid-path' && kind !== 'forbid-pattern') {
        console.error('usage: intent rule draft <forbid-path|forbid-pattern> <pattern> "<reason>"')
        process.exit(1)
      }
      const r = draftRule(root, kind, args[2], args[3] ?? '')
      console.log(`drafted ${r.id} (${r.kind}) — awaiting human approval via \`intent rule approve ${r.id}\``)
    } else if (sub === 'draft-from-detection') {
      const detectionId = args[1]
      const kind = args[2] as RuleKind
      const pattern = args[3]
      if (!detectionId || (kind !== 'forbid-path' && kind !== 'forbid-pattern') || !pattern) {
        console.error('usage: intent rule draft-from-detection <detectionId> <forbid-path|forbid-pattern> <pattern> ["reason"]')
        process.exit(1)
      }
      const detection = findDetection(root, detectionId)
      if (!detection) throw new Error(`no such detection: ${detectionId}`)
      const reason = args[4] ?? `${detection.type}: ${detection.summary}`
      const r = draftRule(root, kind, pattern, reason, { sourceDetectionId: detection.detectionId })
      console.log(`drafted ${r.id} from ${detection.detectionId} (${r.kind}) — awaiting human approval via \`intent rule approve ${r.id}\``)
    } else if (sub === 'agents-candidate') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent rule agents-candidate <ruleId>')
        process.exit(1)
      }
      const rule = findRule(root, id)
      if (!rule) throw new Error(`no such rule: ${id}`)
      process.stdout.write(composeAgentsRuleCandidate(rule) + '\n')
    } else if (sub === 'ci-candidate') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent rule ci-candidate <ruleId>')
        process.exit(1)
      }
      const rule = findRule(root, id)
      if (!rule) throw new Error(`no such rule: ${id}`)
      process.stdout.write(composeCiRuleCandidate(rule) + '\n')
    } else if (sub === 'reflect') {
      const id = args[1]
      const kind = RuleReflectionKindSchema.safeParse(args[2])
      const status = RuleReflectionStatusSchema.safeParse(args[3])
      const target = args[4]
      if (!id || !kind.success || !status.success || !target) {
        console.error('usage: intent rule reflect <ruleId> <agents|ci> <candidate|applied> <target> ["evidence"]')
        process.exit(1)
      }
      const rule = recordRuleReflection(root, id, {
        kind: kind.data,
        status: status.data,
        target,
        evidence: args[5] ?? '',
      })
      console.log(`reflected ${rule.id}: ${kind.data}/${status.data} ${target}`)
    } else if (sub === 'impact') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent rule impact <ruleId>')
        process.exit(1)
      }
      const rule = findRule(root, id)
      if (!rule) throw new Error(`no such rule: ${id}`)
      process.stdout.write(composeRuleImpactReport(rule) + '\n')
    } else if (sub === 'approve') {
      assertHumanShell()
      const r = approveRule(root, args[1])
      console.log(`approved ${r.id} by ${r.approvedBy}`)
    } else if (sub === 'list' || !sub) {
      for (const r of loadRules(root)) console.log(`${r.id}  [${r.status}]  ${r.kind}  /${r.pattern}/  ${r.reason}`)
    } else {
      console.error('usage: intent rule list | draft <kind> <pattern> "<reason>" | draft-from-detection <detectionId> <kind> <pattern> ["reason"] | agents-candidate <ruleId> | ci-candidate <ruleId> | reflect <ruleId> <agents|ci> <candidate|applied> <target> ["evidence"] | impact <ruleId> | approve <id>')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdList(): void {
  for (const i of loadIntents(root)) {
    console.log(`${i.id}  [${i.status}]  ${i.what}`)
  }
}

function findIntent(id: string) {
  const i = loadIntents(root).find((x) => x.id === id)
  if (!i) {
    console.error(`no such intent: ${id}`)
    process.exit(1)
  }
  return i
}

function cmdDod(): void {
  const i = findIntent(args[0])
  if (i.dod.length === 0) {
    console.log(`${i.id}: no DoD items`)
    return
  }
  for (const d of i.dod) {
    console.log(`  [${i.dodChecked.includes(d) ? 'x' : ' '}] ${d}`)
  }
}

function cmdCheck(): void {
  const [id, text] = args
  if (!id || !text) {
    console.error('usage: intent check <id> "<dod text>"')
    process.exit(1)
  }
  const i = checkDod(root, id, text)
  console.log(`checked (${i.dodChecked.length}/${i.dod.length}) ${i.id}`)
}

function cmdLearn(): void {
  const [id, note] = args
  if (!id || !note) {
    console.error('usage: intent learn <id> "<note>"')
    process.exit(1)
  }
  recordLearning(root, id, note)
  console.log(`learning recorded for ${id}`)
}

function cmdComplete(): void {
  const id = args[0]
  if (!id) {
    console.error('usage: intent complete <id>')
    process.exit(1)
  }
  try {
    const intent = findIntent(id)
    const attempt = evaluateCompletionAttempt(root, [intent])
    if (attempt.block) throw new Error(`cannot complete ${id}: ${attempt.reasons.join('; ')}`)
    const context = attempt.contexts[0]
    const i = completeIntent(root, id, context.run, context.contract)
    if (context.run) markRunComplete(root, context.run.runId)
    console.log(`completed ${i.id}`)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
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
      assertHumanShell('interview approval')
      const interviewId = args[1]
      if (!interviewId) {
        console.error('usage: intent interview approve <interviewId>')
        process.exit(1)
      }
      const approved = approveInterview(root, interviewId, 'human')
      console.log(`approved ${approved.interviewId}`)
    } else if (sub === 'archive') {
      assertHumanShell('interview archive')
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
      assertHumanShell('plan approval')
      const planId = args[1]
      if (!planId) {
        console.error('usage: intent plan approve <planId>')
        process.exit(1)
      }
      const plan = approvePlan(root, planId, 'human')
      console.log(`approved ${plan.planId}`)
    } else if (sub === 'archive') {
      assertHumanShell('plan archive')
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

function printContract(contract: SprintContract): void {
  console.log(contractSummary(contract))
  console.log('allowed scope:')
  for (const item of contract.allowedScope) console.log(`  - ${item}`)
  console.log('forbidden scope:')
  for (const item of contract.forbiddenScope.length > 0 ? contract.forbiddenScope : ['—']) console.log(`  - ${item}`)
  console.log('required checks:')
  for (const item of contract.requiredChecks.length > 0 ? contract.requiredChecks : ['—']) console.log(`  - ${item}`)
  console.log('definition of done:')
  for (const item of contract.definitionOfDone.length > 0 ? contract.definitionOfDone : ['—']) console.log(`  - ${item}`)
  console.log('rubric:')
  const rubricEntries = Object.entries(contract.rubric)
  for (const [key, value] of rubricEntries.length > 0 ? rubricEntries : [['—', '—']]) console.log(`  - ${key}: ${value}`)
  console.log('stop conditions:')
  for (const item of contract.stopConditions.length > 0 ? contract.stopConditions : ['—']) console.log(`  - ${item}`)
  console.log('requires user decision:')
  for (const item of contract.requiresUserDecision.length > 0 ? contract.requiresUserDecision : ['—']) console.log(`  - ${item}`)
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
  console.log(`run: ${report.contract.runId}`)
  console.log('required checks:')
  for (const check of report.checks.length > 0 ? report.checks : []) {
    const evidence = check.evidence ? ` (${check.evidence.evidenceId})` : ''
    console.log(`  - ${check.type}: ${check.status}${evidence}`)
  }
  if (report.checks.length === 0) console.log('  - —')
  console.log('rubric:')
  const rubricEntries = Object.entries(report.contract.rubric)
  for (const [key, value] of rubricEntries.length > 0 ? rubricEntries : [['—', '—']]) console.log(`  - ${key}: ${value}`)
  console.log('stop conditions:')
  for (const item of report.contract.stopConditions.length > 0 ? report.contract.stopConditions : ['—']) console.log(`  - ${item}`)
  console.log('requires user decision:')
  for (const item of report.contract.requiresUserDecision.length > 0 ? report.contract.requiresUserDecision : ['—']) console.log(`  - ${item}`)
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
      assertHumanShell('contract approval')
      const id = args[1]
      if (!id) {
        console.error('usage: intent contract approve <contractId>')
        process.exit(1)
      }
      const contract = approveContract(root, id, 'human')
      console.log(`approved ${contract.contractId}`)
    } else if (sub === 'archive') {
      assertHumanShell('contract archive')
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

function detectionLine(detection: DetectionRecord): string {
  const run = detection.runId ? ` (${detection.runId})` : ''
  return `${detection.detectionId} [${detection.result}] ${detection.type} ${detection.title}${run}`
}

function printDetection(detection: DetectionRecord): void {
  console.log(detectionLine(detection))
  console.log(`summary: ${detection.summary}`)
  if (detection.intentId) console.log(`intent: ${detection.intentId}`)
  if (detection.runId) console.log(`run: ${detection.runId}`)
  console.log('evidence:')
  for (const ref of detection.evidenceRefs.length > 0 ? detection.evidenceRefs : ['—']) console.log(`  - ${ref}`)
  console.log('attributes:')
  console.log(JSON.stringify(detection.attributes, null, 2))
  if (detection.resolution) console.log(`resolution: ${detection.resolution}`)
  if (detection.resolvedAt) console.log(`resolvedAt: ${detection.resolvedAt}`)
}

function cmdDetection(): void {
  const sub = args[0]
  try {
    if (sub === 'list') {
      const detections = loadDetections(root)
      if (detections.length === 0) {
        console.log('no detections')
        return
      }
      for (const detection of detections) console.log(detectionLine(detection))
      return
    }
    if (sub === 'show') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent detection show <id>')
        process.exit(1)
      }
      const detection = findDetection(root, id)
      if (!detection) throw new Error(`no such detection: ${id}`)
      printDetection(detection)
      return
    }
    if (sub === 'resolve') {
      assertHumanShell('detection resolve')
      const [id, resultText, resolution] = [args[1], args[2], args[3]]
      const result = DetectionResultSchema.safeParse(resultText)
      if (!id || !result.success || result.data === 'candidate' || !resolution) {
        console.error('usage: intent detection resolve <id> <confirmed|dismissed> "<resolution>"')
        process.exit(1)
      }
      const detection = resolveDetection(root, id, result.data, resolution)
      console.log(`resolved ${detection.detectionId} as ${detection.result}`)
      const wiki = recordDetectionWikiPage(root, detection.detectionId)
      console.log(`wiki: ${wiki.slug} (${wiki.file})`)
      return
    }
    console.error('usage: intent detection list | show <id> | resolve <id> <confirmed|dismissed> "<resolution>"')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdMonitor(): void {
  const sub = args[0]
  try {
    const runId = sub === 'active' ? activeRun(root)?.runId : sub === 'run' ? args[1] : null
    if (!runId) {
      console.error('usage: intent monitor active | run <runId>')
      process.exit(1)
    }
    const run = findRun(root, runId)
    if (!run) throw new Error(`no such run: ${runId}`)
    const unique = detectRunMonitorIssues(root, run.runId)
    console.log(`monitor ${run.runId}: ${unique.length} detection(s)`)
    for (const detection of unique) console.log(`  ${detectionLine(detection)}`)
    if (unique.length > 0) {
      const updated = blockRunForDetections(root, run.runId, unique)
      if (updated) console.log(`blocked ${updated.runId}: ${updated.nextAction}`)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdJudge(): void {
  const sub = args[0]
  try {
    if (sub === 'policy') {
      console.log(JSON.stringify(loadJudgePolicy(root), null, 2))
      return
    }
    if (sub === 'semantic') {
      const separator = args.indexOf('--')
      if (separator < 1 || separator === args.length - 1) {
        console.error('usage: intent judge semantic [--model key] -- <embedding-command...>')
        process.exit(1)
      }
      const policy = loadJudgePolicy(root)
      const modelKey = flagValue('--model') ?? policy.embeddingModelKey
      const [embeddingCommand, ...embeddingArgs] = args.slice(separator + 1)
      const result = runEmbeddingAdapter(root, modelKey, embeddingCommand, embeddingArgs, policy)
      console.log(`embedding adapter ${result.adapterInvoked ? 'ran' : 'cache hit'}: model=${modelKey}`)
      console.log(`embedded: ${result.embeddedDetectionIds.join(', ') || '—'}`)
      console.log(`cached: ${result.cachedDetectionIds.join(', ') || '—'}`)
      return
    }
    if (sub === 'queue') {
      const policy = loadJudgePolicy(root)
      const modelKey = flagValue('--model') ?? policy.embeddingModelKey
      const candidates = selectJudgeCandidates(root, modelKey, policy)
      console.log(`judge queue: ${candidates.length} candidate(s), model=${modelKey}`)
      for (const candidate of candidates) {
        console.log(`  ${candidate.detectionId} similarity=${candidate.similarity.toFixed(4)} chars=${candidate.estimatedInputChars} peers=${candidate.similarDetectionIds.join(',')}`)
      }
      return
    }
    if (sub === 'batch') {
      const separator = args.indexOf('--')
      if (separator < 1 || separator === args.length - 1) {
        console.error('usage: intent judge batch [--model key] -- <judge-command...>')
        process.exit(1)
      }
      const policy = loadJudgePolicy(root)
      const modelKey = flagValue('--model') ?? policy.embeddingModelKey
      const [judgeCommand, ...judgeArgs] = args.slice(separator + 1)
      const results = runJudgeBatch(root, modelKey, judgeCommand, judgeArgs, policy)
      console.log(`judge batch: ${results.length} candidate(s), model=${modelKey}`)
      for (const result of results) {
        console.log(`  ${result.detection.detectionId}: ${result.detection.judge.status}${result.cached ? ' (cached)' : ''}`)
      }
      return
    }
    if (sub === 'bundle') {
      const id = args[1]
      if (!id) {
        console.error('usage: intent judge bundle <detectionId>')
        process.exit(1)
      }
      console.log(JSON.stringify(buildJudgeInputBundle(root, id), null, 2))
      return
    }
    if (sub === 'record') {
      const id = args[1]
      const status = JudgeStatusSchema.safeParse(args[2])
      const judgement = args[3]
      const confidenceRaw = flagValue('--confidence')
      const confidence = confidenceRaw === undefined ? null : Number(confidenceRaw)
      if (!id || !status.success || status.data === 'not_run' || !judgement || (confidenceRaw !== undefined && !Number.isFinite(confidence))) {
        console.error('usage: intent judge record <detectionId> <pass|fail|uncertain> "<judgement>" [--confidence 0..1]')
        process.exit(1)
      }
      const detection = recordJudgeResult(root, id, {
        status: status.data,
        judgement,
        confidence,
      })
      console.log(`judge recorded ${detection.detectionId}: ${detection.judge.status}`)
      return
    }
    if (sub === 'run') {
      const id = args[1]
      const separator = args.indexOf('--')
      if (!id || separator !== 2 || separator === args.length - 1) {
        console.error('usage: intent judge run <detectionId> -- <command...>')
        process.exit(1)
      }
      const [judgeCommand, ...judgeArgs] = args.slice(separator + 1)
      const result = runJudgeAdapter(root, id, judgeCommand, judgeArgs)
      console.log(`judge adapter ${result.cached ? 'cached' : 'recorded'} ${result.detection.detectionId}: ${result.detection.judge.status}`)
      return
    }
    console.error('usage: intent judge policy | semantic [--model key] -- <command...> | queue [--model key] | batch [--model key] -- <command...> | bundle <detectionId> | record <detectionId> <pass|fail|uncertain> "<judgement>" [--confidence 0..1] | run <detectionId> -- <command...>')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdReviewer(): void {
  const sub = args[0]
  try {
    if (sub === 'checklist') {
      const runId = args[1] ?? activeRun(root)?.runId
      if (!runId) {
        console.error('usage: intent reviewer checklist [runId]')
        process.exit(1)
      }
      process.stdout.write(buildReviewerChecklist(root, runId) + '\n')
      return
    }
    console.error('usage: intent reviewer checklist [runId]')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdEval(): void {
  const sub = args[0]
  try {
    if (sub === 'draft-from-detection') {
      const detectionId = args[1]
      if (!detectionId) {
        console.error('usage: intent eval draft-from-detection <detectionId>')
        process.exit(1)
      }
      const evalCase = draftEvalCaseFromDetection(root, detectionId)
      console.log(`eval drafted ${evalCase.evalId} from ${detectionId}: ${evalCase.title}`)
      return
    }
    if (sub === 'run') {
      const results = runEvalCases(root, args[1])
      if (results.length === 0) {
        console.log('no evals')
        return
      }
      for (const result of results) console.log(`${result.evalId}: ${result.status} — ${result.reason}`)
      if (results.some((result) => result.status === 'failed')) process.exit(1)
      return
    }
    console.error('usage: intent eval draft-from-detection <detectionId> | run [evalId]')
    process.exit(1)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdHandoff(): void {
  const p = paths(root)
  if (args[0] === 'note') {
    const kind = args[1] as ScratchKind
    const text = args[2]
    if (!['deadend', 'next', 'question'].includes(kind) || !text) {
      console.error('usage: intent handoff note <deadend|next|question> "<text>"')
      process.exit(1)
    }
    appendScratch(root, kind, text)
    console.log(`handoff: noted (${kind})`)
    return
  }
  const file = writeHandoff(root, {
    decisions: recentLogLines(p.decisions, 10),
    learnings: recentLogLines(p.learnings, 10),
  })
  console.log(`handoff written: ${file}`)
}

function cmdWiki(): void {
  const sub = args[0]
  const flag = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  try {
    if (sub === 'new') {
      const file = newArticle(root, args[1], args[2] ?? args[1], {
        type: flag('--type') as WikiType | undefined,
        summary: flag('--summary'),
        status: flag('--status') as Status | undefined,
      })
      console.log(`wiki: created ${file}`)
    } else if (sub === 'resolve') {
      const file = setStatus(root, args[1], 'resolved')
      console.log(`wiki: resolved ${args[1]} (${file})`)
    } else if (sub === 'append') {
      const file = appendArticle(root, args[1], args[2])
      console.log(`wiki: appended to ${file}`)
    } else if (sub === 'ingest' && args[1] === 'detection') {
      const detectionId = args[2]
      if (!detectionId) {
        console.error('usage: intent wiki ingest detection <detectionId>')
        process.exit(1)
      }
      const { slug, file } = recordDetectionWikiPage(root, detectionId)
      console.log(`wiki: ingested detection ${detectionId} -> ${slug} (${file})`)
    } else if (sub === 'show') {
      process.stdout.write(readArticle(root, args[1]))
    } else if (sub === 'index') {
      console.log(`wiki: index rebuilt at ${rebuildIndex(root)}`)
    } else if (sub === 'log') {
      const p = paths(root)
      process.stdout.write(existsSync(p.wikiLog) ? readFileSync(p.wikiLog, 'utf8') : '(no wiki log yet)\n')
    } else if (sub === 'lint') {
      const r = lintWiki(listArticles(root))
      const unIngested = unIngestedDetections(root).map((detection) => detection.detectionId)
      console.log(`orphans: ${r.orphans.join(', ') || 'none'}`)
      console.log(`dead links: ${r.deadLinks.map((d) => `${d.from}→${d.to}`).join(', ') || 'none'}`)
      console.log(`low confidence: ${r.lowConfidence.join(', ') || 'none'}`)
      console.log(`open problems: ${r.openProblems.join(', ') || 'none'}`)
      console.log(`un-ingested detections: ${unIngested.join(', ') || 'none'}`)
    } else if (sub === 'list' || !sub) {
      for (const a of listArticles(root)) {
        const st = a.status ? ` (${a.status})` : ''
        console.log(`${a.slug}  [${a.area}/${a.type}${st}]  ${a.title}`)
      }
    } else {
      console.error('usage: intent wiki list | new <slug> "<title>" [--type T --status open|resolved --summary "..."] | resolve <slug> | append <slug> "<text>" | ingest detection <detectionId> | show <slug> | index | log | lint')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

function cmdPostmortem(): void {
  const title = args.find((a) => !a.startsWith('--'))
  if (!title) {
    console.error('usage: intent postmortem "<title>" --cause "..." --prevent "..." [--rule <forbid-path|forbid-pattern> <pattern>]')
    process.exit(1)
  }
  const flag = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const ruleIdx = args.indexOf('--rule')
  const rule =
    ruleIdx >= 0
      ? { kind: args[ruleIdx + 1] as RuleKind, pattern: args[ruleIdx + 2] }
      : undefined
  if (rule && rule.kind !== 'forbid-path' && rule.kind !== 'forbid-pattern') {
    console.error('--rule kind must be forbid-path or forbid-pattern')
    process.exit(1)
  }
  const res = recordPostmortem(root, {
    title,
    cause: flag('--cause') ?? '',
    prevention: flag('--prevent') ?? '',
    rule,
  })
  console.log(`postmortem recorded: wiki/${res.slug}` + (res.ruleId ? ` + drafted ${res.ruleId} (needs human approval)` : ''))
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
      console.log(`spec drafted: wiki/${slug} — fill with \`intent wiki append ${slug} "..."\`, then human runs \`intent spec approve ${slug}\``)
      if (run) console.log(`linked ${slug} to ${run.runId}`)
    } else if (sub === 'approve') {
      assertHumanShell()
      approveSpec(root, args[1])
      console.log(`spec approved: ${args[1]}`)
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

/** Consulted by the Stop hook (Phase 4). Exit 1 + reasons when the gate blocks. */
function cmdStopCheck(): void {
  const intents = loadIntents(root)
  const attempt = evaluateCompletionAttempt(root, intents)
  if (attempt.block) {
    console.error('intent: session blocked — unfinished work:')
    for (const reason of attempt.reasons) console.error(`  - ${reason}`)
    process.exit(1)
  }
  console.log('intent: stop gate clear')
}

function cmdReconcile(): void {
  const apply = args.includes('--apply')
  const result = reconcileState(root, apply)
  console.log(`reconcile ${apply ? (result.applied ? 'applied' : 'not applied') : 'dry-run'}`)
  console.log('repairs:')
  for (const repair of result.repairs.length > 0 ? result.repairs : ['—']) console.log(`  - ${repair}`)
  console.log('conflicts:')
  for (const conflict of result.conflicts.length > 0 ? result.conflicts : ['—']) console.log(`  - ${conflict}`)
  if (result.conflicts.length > 0) process.exit(1)
}

switch (command) {
  case 'setup':
    cmdSetup()
    break
  case 'status':
    cmdStatus()
    break
  case 'draft':
    cmdDraft()
    break
  case 'approve':
    cmdApprove()
    break
  case 'list':
    cmdList()
    break
  case 'dod':
    cmdDod()
    break
  case 'check':
    cmdCheck()
    break
  case 'learn':
    cmdLearn()
    break
  case 'complete':
    cmdComplete()
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
    cmdDetection()
    break
  case 'monitor':
    cmdMonitor()
    break
  case 'judge':
    cmdJudge()
    break
  case 'reviewer':
    cmdReviewer()
    break
  case 'eval':
    cmdEval()
    break
  case 'stop-check':
    cmdStopCheck()
    break
  case 'reconcile':
    cmdReconcile()
    break
  case 'handoff':
    cmdHandoff()
    break
  case 'wiki':
    cmdWiki()
    break
  case 'rule':
    cmdRule()
    break
  case 'postmortem':
    cmdPostmortem()
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
