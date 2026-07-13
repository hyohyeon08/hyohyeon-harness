import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, linkSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'

/** Read and JSON.parse a file. Returns null if it does not exist. */
export function readJson<T = unknown>(path: string): T | null {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/** Atomic write: write to a tmp sibling, then rename. Prevents partial corruption. */
export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
    renameSync(tmp, path)
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp)
  }
}

/**
 * Atomically create a new JSON file without replacing an existing record.
 * A hard link publishes the fully-written sibling temp in one filesystem step.
 */
export function writeJsonAtomicNew(path: string, value: unknown): boolean {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
    try {
      linkSync(tmp, path)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
      throw error
    }
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp)
  }
}
