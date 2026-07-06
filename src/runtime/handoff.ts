import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { loadIntents } from './intents.js'
import { activeRun } from './runs.js'
import type { Intent, RunState } from './schemas.js'

/**
 * Session handoff — the "퇴근 전 인수인계" document. Triggered deterministically
 * by the PreCompact hook so important context survives compaction.
 *
 * Two kinds of content:
 *   - auto:      current intents + remaining DoD (read from state, deterministic)
 *   - narrative: dead-ends / next steps / open questions (the AI appends these
 *                during the session via `intent handoff note`, since the
 *                PreCompact hook itself cannot author prose)
 */
export type ScratchKind = 'deadend' | 'next' | 'question'

export interface Scratch {
  deadEnds: string[]
  nextSteps: string[]
  openQuestions: string[]
}

const EMPTY_SCRATCH: Scratch = { deadEnds: [], nextSteps: [], openQuestions: [] }

export function readScratch(root: string): Scratch {
  return { ...EMPTY_SCRATCH, ...(readJson<Scratch>(paths(root).handoffScratch) ?? {}) }
}

export function appendScratch(root: string, kind: ScratchKind, text: string): Scratch {
  const s = readScratch(root)
  const next =
    kind === 'deadend'
      ? { ...s, deadEnds: [...s.deadEnds, text] }
      : kind === 'next'
        ? { ...s, nextSteps: [...s.nextSteps, text] }
        : { ...s, openQuestions: [...s.openQuestions, text] }
  writeJsonAtomic(paths(root).handoffScratch, next)
  return next
}

export interface HandoffParts {
  generatedAt: string
  openIntents: Intent[]
  activeRun?: RunState | null
  scratch: Scratch
  recentDecisions: string[]
  recentLearnings: string[]
}

function section(title: string, items: string[]): string {
  if (items.length === 0) return `## ${title}\n\n— 없음\n`
  return `## ${title}\n\n` + items.map((i) => `- ${i}`).join('\n') + '\n'
}

function activeRunSection(run: RunState | null | undefined): string {
  if (!run) return `## Active Run\n\n— 없음\n`
  const intent = run.intentId ? ` (${run.intentId})` : ''
  const lines = [`- ${run.runId} [${run.status}/${run.phase}] ${run.objective}${intent}`]
  if (run.nextAction) lines.push(`- next: ${run.nextAction}`)
  for (const note of run.notes.slice(-3)) lines.push(`- note: ${note}`)
  return `## Active Run\n\n${lines.join('\n')}\n`
}

/** Pure formatter for handoff/latest.md. */
export function composeHandoff(parts: HandoffParts): string {
  const open = parts.openIntents.filter((i) => i.status === 'draft' || i.status === 'approved')
  const stateLines = open.length
    ? open.map((i) => {
        const dod = i.dod.length ? ` — DoD ${i.dodChecked.length}/${i.dod.length}` : ''
        return `- ${i.id} [${i.status}] ${i.what}${dod}`
      })
    : ['— 진행 중인 의도 없음']

  return [
    `# Session Handoff`,
    `_generated ${parts.generatedAt}_`,
    ``,
    `## 현재 작업 상태`,
    ``,
    stateLines.join('\n'),
    ``,
    activeRunSection(parts.activeRun),
    section('막다른 길 (반복 금지)', parts.scratch.deadEnds),
    section('다음 단계', parts.scratch.nextSteps),
    section('열린 질문', parts.scratch.openQuestions),
    section('이번 세션 지식 변경 (decisions/learnings)', [
      ...parts.recentDecisions,
      ...parts.recentLearnings,
    ]),
  ].join('\n')
}

/** fs wrapper: assemble parts and write handoff/latest.md. Returns the path. */
export function writeHandoff(root: string, recent: { decisions: string[]; learnings: string[] }): string {
  const p = paths(root)
  const md = composeHandoff({
    generatedAt: new Date().toISOString(),
    openIntents: loadIntents(root),
    activeRun: activeRun(root),
    scratch: readScratch(root),
    recentDecisions: recent.decisions,
    recentLearnings: recent.learnings,
  })
  mkdirSync(dirname(p.handoffLatest), { recursive: true })
  writeFileSync(p.handoffLatest, md, 'utf8')
  return p.handoffLatest
}
