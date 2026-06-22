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
import { isAiAgent } from '../runtime/env.js'
import type { RuleKind } from '../runtime/schemas.js'

/** Approvals are human-only — refuse when an AI agent runs the CLI. */
function assertHumanShell(): void {
  if (isAiAgent()) {
    console.error('approval is human-only (AI agent environment detected). Run this from your own shell.')
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
  const i = completeIntent(root, id)
  console.log(`completed ${i.id}`)
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
      console.log(`orphans: ${r.orphans.join(', ') || 'none'}`)
      console.log(`dead links: ${r.deadLinks.map((d) => `${d.from}→${d.to}`).join(', ') || 'none'}`)
      console.log(`low confidence: ${r.lowConfidence.join(', ') || 'none'}`)
      console.log(`open problems: ${r.openProblems.join(', ') || 'none'}`)
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
  const decision = evaluateStopGate(loadIntents(root))
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
      'commands: setup | status | draft | approve | list | dod | check | learn | complete | stop-check | handoff | wiki | rule | postmortem | spec',
    )
    process.exit(command ? 1 : 0)
}
