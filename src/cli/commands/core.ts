import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../../state/paths.js'
import { installCodexHooks, installCodexSkills, installHooks, installSkills } from '../../runtime/install.js'
import { readJson, writeJsonAtomic } from '../../utils/json.js'
import { DEFAULT_CONFIG, StateSchema, type State, VerificationEvidenceTypeSchema } from '../../runtime/schemas.js'
import { loadIntents, draftIntent, approveIntent, checkDod, recordLearning } from '../../runtime/intents.js'
import { evaluateCompletionAttempt } from '../../runtime/completion.js'
import { completeIntentTransaction } from '../../runtime/completion-transaction.js'
import { parseDraftArgs } from '../../runtime/draft-args.js'
import { rebuildIndex } from '../../runtime/wiki.js'
import { reconcileState } from '../../runtime/reconcile.js'
import { approvalActorForCli, findIntent, type CliContext } from '../shared.js'

export function cmdSetup(context: CliContext): void {
  const { root, args, harnessRoot } = context
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
  mkdirSync(p.completionTransactionsDir, { recursive: true })
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
    if (root === harnessRoot) {
      console.error('refusing to install hooks into the harness repo itself; run from a target project')
      process.exit(1)
    }
    if (installClaude) {
      const settings = installHooks(harnessRoot, root)
      const n = installSkills(harnessRoot, root)
      console.log(`intent: Claude hooks → ${settings}`)
      console.log(`intent: ${n} Claude skills → ${join(root, '.claude', 'skills')}`)
    }
    if (installCodex) {
      const hooks = installCodexHooks(harnessRoot, root)
      const n = installCodexSkills(harnessRoot, root)
      console.log(`intent: Codex hooks → ${hooks}`)
      console.log(`intent: ${n} Codex skills → ${join(root, '.agents', 'skills')}`)
    }
    console.log('intent: restart Claude Code/Codex (new session) to load hooks/skills.')
  }
}

export function cmdStatus(context: CliContext): void {
  const { root } = context
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

export function cmdDraft(context: CliContext): void {
  const { root, args } = context
  let parsed
  try {
    parsed = parseDraftArgs(args)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
  const intent = draftIntent(root, parsed)
  console.log(`drafted ${intent.id} (status: draft — activate with \`intent approve ${intent.id}\`)`)
}

export function cmdApprove(context: CliContext): void {
  const { root, args } = context
  const id = args[0]
  if (!id) {
    console.error('usage: intent approve <id>')
    process.exit(1)
  }
  const intent = approveIntent(root, id, approvalActorForCli())
  console.log(`approved ${intent.id} by ${intent.approvedBy}`)
}

export function cmdList(context: CliContext): void {
  const { root } = context
  for (const i of loadIntents(root)) {
    console.log(`${i.id}  [${i.status}]  ${i.what}`)
  }
}

export function cmdDod(context: CliContext): void {
  const { root, args } = context
  const i = findIntent(root, args[0])
  if (i.dod.length === 0) {
    console.log(`${i.id}: no DoD items`)
    return
  }
  for (const d of i.dod) {
    console.log(`  [${i.dodChecked.includes(d) ? 'x' : ' '}] ${d}`)
  }
}

export function cmdCheck(context: CliContext): void {
  const { root, args } = context
  const [id, text] = args
  if (!id || !text) {
    console.error('usage: intent check <id> "<dod text>"')
    process.exit(1)
  }
  const i = checkDod(root, id, text)
  console.log(`checked (${i.dodChecked.length}/${i.dod.length}) ${i.id}`)
}

export function cmdLearn(context: CliContext): void {
  const { root, args } = context
  const [id, note] = args
  if (!id || !note) {
    console.error('usage: intent learn <id> "<note>"')
    process.exit(1)
  }
  recordLearning(root, id, note)
  console.log(`learning recorded for ${id}`)
}

export function cmdComplete(context: CliContext): void {
  const { root, args } = context
  const id = args[0]
  if (!id) {
    console.error('usage: intent complete <id>')
    process.exit(1)
  }
  try {
    const intent = findIntent(root, id)
    const attempt = evaluateCompletionAttempt(root, [intent])
    if (attempt.block) throw new Error(`cannot complete ${id}: ${attempt.reasons.join('; ')}`)
    const context = attempt.contexts[0]
    const i = completeIntentTransaction(root, id, context.run, context.contract)
    console.log(`completed ${i.id}`)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

export function cmdStopCheck(context: CliContext): void {
  const { root } = context
  const intents = loadIntents(root)
  const attempt = evaluateCompletionAttempt(root, intents)
  if (attempt.block) {
    console.error('intent: session blocked — unfinished work:')
    for (const reason of attempt.reasons) console.error(`  - ${reason}`)
    process.exit(1)
  }
  console.log('intent: stop gate clear')
}

export function cmdReconcile(context: CliContext): void {
  const { root, args } = context
  const apply = args.includes('--apply')
  const result = reconcileState(root, apply)
  console.log(`reconcile ${apply ? (result.applied ? 'applied' : 'not applied') : 'dry-run'}`)
  console.log('repairs:')
  for (const repair of result.repairs.length > 0 ? result.repairs : ['—']) console.log(`  - ${repair}`)
  console.log('conflicts:')
  for (const conflict of result.conflicts.length > 0 ? result.conflicts : ['—']) console.log(`  - ${conflict}`)
  if (result.conflicts.length > 0) process.exit(1)
}
