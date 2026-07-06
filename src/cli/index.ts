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
import { evaluateStopGate } from '../runtime/stop-gate.js'
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
import { loadRules, draftRule, approveRule } from '../runtime/rules.js'
import { recordPostmortem } from '../runtime/postmortem.js'
import { draftSpec, approveSpec } from '../runtime/spec.js'
import { activeRun, createRun, findRun, loadRuns, updateRun } from '../runtime/runs.js'
import { runVerification } from '../runtime/verification.js'
import { createContract, findContract, loadContracts } from '../runtime/contracts.js'
import { findDetection, loadDetections, resolveDetection, unIngestedDetections } from '../runtime/detections.js'
import { isAiAgent } from '../runtime/env.js'
import {
  DetectionResultSchema,
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
  mkdirSync(p.rawDir, { recursive: true })
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
    } else if (sub === 'approve') {
      assertHumanShell()
      const r = approveRule(root, args[1])
      console.log(`approved ${r.id} by ${r.approvedBy}`)
    } else if (sub === 'list' || !sub) {
      for (const r of loadRules(root)) console.log(`${r.id}  [${r.status}]  ${r.kind}  /${r.pattern}/  ${r.reason}`)
    } else {
      console.error('usage: intent rule list | draft <kind> <pattern> "<reason>" | approve <id>')
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
  const i = completeIntent(root, id, activeRun(root))
  console.log(`completed ${i.id}`)
}

function runLine(run: { runId: string; status: string; phase: string; objective: string; intentId: string | null }): string {
  const intent = run.intentId ? ` (${run.intentId})` : ''
  return `${run.runId} [${run.status}/${run.phase}] ${run.objective}${intent}`
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
      findIntent(intentId)
      const run = createRun(root, { intentId, objective })
      console.log(`started ${run.runId} for ${intentId}: ${run.objective}`)
    } else if (sub === 'status') {
      const run = activeRun(root)
      if (!run) {
        console.log('active run: none')
        return
      }
      console.log('active run')
      console.log(`  ${runLine(run)}`)
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
      const run = activeRun(root)
      if (!run) {
        console.error('no active run')
        process.exit(1)
      }
      const updated = updateRun(root, run.runId, (r) => ({ ...r, notes: [...r.notes, text] }))
      console.log(`noted ${updated.runId}`)
    } else {
      console.error('usage: intent run list | start <intentId> "<objective>" | status | note "<text>"')
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
    } else if (sub === 'list' || !sub) {
      const contracts = loadContracts(root)
      if (contracts.length === 0) {
        console.log('no contracts')
        return
      }
      for (const contract of contracts) console.log(contractSummary(contract))
    } else {
      console.error('usage: intent contract list | draft [runId] | show <contractId>')
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
      return
    }
    console.error('usage: intent detection list | show <id> | resolve <id> <confirmed|dismissed> "<resolution>"')
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
      console.error('usage: intent wiki list | new <slug> "<title>" [--type T --status open|resolved --summary "..."] | resolve <slug> | append <slug> "<text>" | show <slug> | index | log | lint')
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
        console.error('usage: intent spec draft "<title>"')
        process.exit(1)
      }
      const { slug } = draftSpec(root, args[1])
      console.log(`spec drafted: wiki/${slug} — fill with \`intent wiki append ${slug} "..."\`, then human runs \`intent spec approve ${slug}\``)
    } else if (sub === 'approve') {
      assertHumanShell()
      approveSpec(root, args[1])
      console.log(`spec approved: ${args[1]}`)
    } else {
      console.error('usage: intent spec draft "<title>" | approve <slug>')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

/** Consulted by the Stop hook (Phase 4). Exit 1 + reasons when the gate blocks. */
function cmdStopCheck(): void {
  const decision = evaluateStopGate(loadIntents(root), activeRun(root))
  if (decision.block) {
    console.error('intent: session blocked — unfinished work:')
    for (const r of decision.reasons) console.error(`  - ${r}`)
    process.exit(1)
  }
  console.log('intent: stop gate clear')
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
  case 'verify':
    cmdVerify()
    break
  case 'contract':
    cmdContract()
    break
  case 'detection':
    cmdDetection()
    break
  case 'stop-check':
    cmdStopCheck()
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
      'commands: setup | status | draft | approve | list | dod | check | learn | complete | run | verify | contract | detection | stop-check | handoff | wiki | rule | postmortem | spec',
    )
    process.exit(command ? 1 : 0)
}
