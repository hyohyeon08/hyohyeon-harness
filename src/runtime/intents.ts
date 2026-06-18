import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { IntentSchema, type Intent, type IntentType } from './schemas.js'
import { canComplete } from './stop-gate.js'

function intentFile(root: string, id: string): string {
  return join(paths(root).intentsDir, `${id}.json`)
}

/** Load all intent records, skipping anything that fails schema validation. */
export function loadIntents(root: string): Intent[] {
  const dir = paths(root).intentsDir
  if (!existsSync(dir)) return []
  const out: Intent[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const raw = readJson(join(dir, f))
    const parsed = IntentSchema.safeParse(raw)
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/** Next sequential id: INT-001, INT-002, ... */
function nextId(root: string): string {
  const n = loadIntents(root).length + 1
  return `INT-${String(n).padStart(3, '0')}`
}

/**
 * AI creates a draft. It can NEVER set status to 'approved' through this path —
 * only `approveIntent` (run from the human's shell) can. (decision: 승인 주체 = 사람만)
 */
export function draftIntent(
  root: string,
  args: { what: string; why: string; type?: IntentType; scope?: string[]; dod?: string[] },
): Intent {
  const now = new Date().toISOString()
  const intent = IntentSchema.parse({
    id: nextId(root),
    what: args.what,
    why: args.why,
    type: args.type ?? 'feature',
    scope: args.scope ?? ['**'],
    dod: args.dod ?? [],
    dodChecked: [],
    status: 'draft',
    approvedBy: null,
    learnings: null,
    createdAt: now,
    updatedAt: now,
  })
  writeJsonAtomic(intentFile(root, intent.id), intent)
  return intent
}

/** Load, validate, transform, and atomically write one intent. */
function updateIntent(root: string, id: string, fn: (i: Intent) => Intent): Intent {
  const file = intentFile(root, id)
  const intent = IntentSchema.parse(readJson(file))
  const updated = IntentSchema.parse({ ...fn(intent), updatedAt: new Date().toISOString() })
  writeJsonAtomic(file, updated)
  return updated
}

/** Human-only approval. */
export function approveIntent(root: string, id: string, by = 'human'): Intent {
  return updateIntent(root, id, (i) => ({ ...i, status: 'approved', approvedBy: by }))
}

/** Mark one DoD item as checked. Throws if the text is not a DoD item. */
export function checkDod(root: string, id: string, dodText: string): Intent {
  return updateIntent(root, id, (i) => {
    if (!i.dod.includes(dodText)) {
      throw new Error(`"${dodText}" is not a DoD item of ${id}`)
    }
    if (i.dodChecked.includes(dodText)) return i
    return { ...i, dodChecked: [...i.dodChecked, dodText] }
  })
}

/** Record the learning note (the back side of the comprehension gate). */
export function recordLearning(root: string, id: string, note: string): Intent {
  return updateIntent(root, id, (i) => ({ ...i, learnings: note }))
}

/** Transition approved -> done. Throws unless canComplete passes. */
export function completeIntent(root: string, id: string): Intent {
  return updateIntent(root, id, (i) => {
    const c = canComplete(i)
    if (!c.ok) throw new Error(`cannot complete ${id}: ${c.reason}`)
    return { ...i, status: 'done' }
  })
}
