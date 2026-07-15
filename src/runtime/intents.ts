import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import { IntentSchema, type Intent, type IntentType, type RunState, type SprintContract } from './schemas.js'
import { canComplete } from './stop-gate.js'

export class IntentStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid intent state ${file}: ${detail}`)
    this.name = 'IntentStateError'
  }
}

function intentFile(root: string, id: string): string {
  return join(paths(root).intentsDir, `${id}.json`)
}

/** Load all intent records. Corrupt governance state is a fail-closed error. */
export function loadIntents(root: string): Intent[] {
  const dir = paths(root).intentsDir
  if (!existsSync(dir)) return []
  const out: Intent[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, f))
    } catch (error) {
      throw new IntentStateError(f, (error as Error).message)
    }
    const parsed = IntentSchema.safeParse(raw)
    if (!parsed.success) throw new IntentStateError(f, parsed.error.issues.map((issue) => issue.message).join('; '))
    out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.id, b.id))
}

/** Next sequential id: INT-001, INT-002, ... */
function nextId(root: string): string {
  return nextSequentialId('INT', loadIntents(root).map((intent) => intent.id))
}

/** Create a draft; activation remains an explicit, auditable CLI transition. */
export function draftIntent(
  root: string,
  args: { what: string; why: string; type?: IntentType; scope?: string[]; dod?: string[] },
): Intent {
  for (;;) {
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
    if (writeJsonAtomicNew(intentFile(root, intent.id), intent)) return intent
  }
}

/** Load, validate, transform, and atomically write one intent. */
function updateIntent(root: string, id: string, fn: (i: Intent) => Intent): Intent {
  const file = intentFile(root, id)
  const intent = IntentSchema.parse(readJson(file))
  const updated = IntentSchema.parse({ ...fn(intent), updatedAt: new Date().toISOString() })
  writeJsonAtomic(file, updated)
  return updated
}

/** Mark the intent ready for governed execution and record the transition actor. */
export function approveIntent(root: string, id: string, by = 'agent:runtime'): Intent {
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
export function completeIntent(root: string, id: string, run?: RunState | null, contract?: SprintContract | null): Intent {
  return updateIntent(root, id, (i) => {
    const c = canComplete(i, run, contract)
    if (!c.ok) throw new Error(`cannot complete ${id}: ${c.reason}`)
    return { ...i, status: 'done' }
  })
}
