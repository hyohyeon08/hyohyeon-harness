import {
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
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

export interface FileLockOptions {
  timeoutMs?: number
  staleMs?: number
  retryMs?: number
}

const WAIT_BUFFER = new Int32Array(new SharedArrayBuffer(4))

function waitForRetry(ms: number): void {
  Atomics.wait(WAIT_BUFFER, 0, 0, ms)
}

/**
 * Serialize a short read-transform-write section across Node processes.
 * The lock is a sibling file, so acquisition remains on the same filesystem as
 * the protected JSON. Stale locks are recoverable after a crashed writer.
 */
export function withFileLock<T>(path: string, fn: () => T, options: FileLockOptions = {}): T {
  const lockPath = `${path}.lock`
  const ownerToken = `${process.pid}:${randomUUID()}`
  const timeoutMs = options.timeoutMs ?? 10_000
  const staleMs = options.staleMs ?? 60_000
  const retryMs = options.retryMs ?? 10
  const deadline = Date.now() + timeoutMs
  mkdirSync(dirname(path), { recursive: true })

  let descriptor: number | null = null
  while (descriptor === null) {
    try {
      const candidate = openSync(lockPath, 'wx')
      try {
        writeFileSync(candidate, `${ownerToken}\n`, 'utf8')
        descriptor = candidate
      } catch (error) {
        closeSync(candidate)
        try {
          unlinkSync(lockPath)
        } catch {
          // Preserve the acquisition error; a later attempt can recover a stale lock.
        }
        throw error
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > staleMs) {
          unlinkSync(lockPath)
          continue
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw statError
      }
      if (Date.now() >= deadline) throw new Error(`timed out waiting for state lock: ${path}`)
      waitForRetry(retryMs)
    }
  }

  try {
    return fn()
  } finally {
    closeSync(descriptor)
    try {
      if (readFileSync(lockPath, 'utf8').trim() === ownerToken) unlinkSync(lockPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}
