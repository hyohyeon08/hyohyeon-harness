import type { RawEdit } from './change-extract.js'

type PatchMode = 'add' | 'update' | 'delete'

interface PendingEdit {
  mode: PatchMode
  path: string
  moveTo: string | null
  added: string[]
  removed: string[]
}

function finish(current: PendingEdit | null, out: RawEdit[]): void {
  if (!current) return
  if (current.mode === 'add') {
    out.push({
      path: current.path,
      newText: current.added.join('\n'),
      oldText: '',
      isNewFile: true,
    })
    return
  }
  if (current.mode === 'delete') {
    out.push({
      path: current.path,
      newText: '',
      oldText: current.removed.join('\n'),
      isNewFile: false,
      deletesFile: true,
    })
    return
  }
  if (current.moveTo) {
    out.push({
      path: current.path,
      newText: '',
      oldText: current.removed.join('\n'),
      isNewFile: false,
      deletesFile: true,
    })
    out.push({
      path: current.moveTo,
      newText: current.added.join('\n') || 'move',
      oldText: '',
      isNewFile: true,
    })
    return
  }
  out.push({
    path: current.path,
    newText: current.added.join('\n'),
    oldText: current.removed.join('\n'),
    isNewFile: false,
  })
}

/**
 * Parse the subset of apply_patch format needed for intent gating.
 *
 * The hook does not need to reconstruct the full post-patch file. It only needs
 * path, added text, removed text, and whether the patch creates/deletes/moves a
 * file so the existing triviality/scope/rule gates can decide deterministically.
 */
export function extractApplyPatchEdits(patch: string): RawEdit[] {
  const out: RawEdit[] = []
  let current: PendingEdit | null = null

  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith('*** Add File: ')) {
      finish(current, out)
      current = { mode: 'add', path: line.slice('*** Add File: '.length).trim(), moveTo: null, added: [], removed: [] }
      continue
    }
    if (line.startsWith('*** Update File: ')) {
      finish(current, out)
      current = { mode: 'update', path: line.slice('*** Update File: '.length).trim(), moveTo: null, added: [], removed: [] }
      continue
    }
    if (line.startsWith('*** Delete File: ')) {
      finish(current, out)
      current = { mode: 'delete', path: line.slice('*** Delete File: '.length).trim(), moveTo: null, added: [], removed: [] }
      continue
    }
    if (!current) continue
    if (line.startsWith('*** Move to: ')) {
      current.moveTo = line.slice('*** Move to: '.length).trim()
      continue
    }
    if (line.startsWith('*** End Patch')) {
      finish(current, out)
      current = null
      continue
    }
    if (line.startsWith('***')) continue
    if (line.startsWith('@@')) continue
    if (line.startsWith('+')) {
      current.added.push(line.slice(1))
      continue
    }
    if (line.startsWith('-')) current.removed.push(line.slice(1))
  }

  finish(current, out)
  return out.filter((edit) => edit.path.length > 0)
}
