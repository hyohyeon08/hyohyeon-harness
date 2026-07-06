import { existsSync, readFileSync } from 'node:fs'
import { paths } from '../state/paths.js'
import { loadIntents } from './intents.js'
import { activeRun } from './runs.js'
import type { Intent, RunState } from './schemas.js'

/** Last N non-empty lines of a markdown log file (recent decisions/learnings). */
export function recentLogLines(file: string, n: number): string[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.startsWith('#'))
    .slice(-n)
}

export interface SessionContextParts {
  intents: Intent[]
  decisions: string[]
  learnings: string[]
  activeRun?: RunState | null
}

/**
 * Pure formatter for the SessionStart memory injection — the cure for
 * "컨텍스트 단절". Surfaces unfinished work + recent decisions/learnings so a
 * fresh session resumes instead of re-deriving from scratch.
 */
export function formatSessionContext(parts: SessionContextParts): string {
  const open = parts.intents.filter((i) => i.status === 'draft' || i.status === 'approved')
  const lines: string[] = ['[intent] session memory']

  if (open.length === 0) {
    lines.push('  open intents: none')
  } else {
    lines.push('  open intents:')
    for (const i of open) {
      const dod = i.dod.length > 0 ? ` (DoD ${i.dodChecked.length}/${i.dod.length})` : ''
      lines.push(`    ${i.id} [${i.status}] ${i.what}${dod}`)
    }
  }
  if (parts.activeRun) {
    const run = parts.activeRun
    const intent = run.intentId ? ` (${run.intentId})` : ''
    lines.push('  active run:')
    lines.push(`    ${run.runId} [${run.status}/${run.phase}] ${run.objective}${intent}`)
    if (run.nextAction) lines.push(`    next: ${run.nextAction}`)
    const recentNotes = run.notes.slice(-3)
    if (recentNotes.length > 0) {
      lines.push('    recent notes:')
      for (const note of recentNotes) lines.push(`      - ${note}`)
    }
  }
  if (parts.decisions.length > 0) {
    lines.push('  recent decisions:')
    for (const d of parts.decisions) lines.push(`    - ${d}`)
  }
  if (parts.learnings.length > 0) {
    lines.push('  recent learnings:')
    for (const l of parts.learnings) lines.push(`    - ${l}`)
  }
  return lines.join('\n')
}

/** fs wrapper: read state and produce the injection text for a project root. */
export function readSessionContext(root: string): string {
  const p = paths(root)
  const context = formatSessionContext({
    intents: loadIntents(root),
    decisions: recentLogLines(p.decisions, 5),
    learnings: recentLogLines(p.learnings, 5),
    activeRun: activeRun(root),
  })
  const blocks: string[] = []
  // Progressive disclosure: inject the previous handoff + the wiki INDEX only
  // (not the articles — the AI drills into those on demand via `intent wiki show`).
  if (existsSync(p.handoffLatest)) {
    blocks.push(`[intent] previous session handoff:\n${readFileSync(p.handoffLatest, 'utf8')}`)
  }
  if (existsSync(p.wikiIndex)) {
    blocks.push(`[intent] wiki index (drill in with \`intent wiki show <slug>\`):\n${readFileSync(p.wikiIndex, 'utf8')}`)
  }
  blocks.push(context)
  return blocks.join('\n\n')
}
