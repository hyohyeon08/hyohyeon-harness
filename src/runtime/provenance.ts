import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { findContract } from './contracts.js'
import { loadIntents } from './intents.js'
import { matchesScope } from './scope.js'
import { ContentFingerprintSchema, type ContentFingerprint, type ContentFingerprintFile, type RunState } from './schemas.js'

const PRUNED_DIRECTORIES = new Set(['.git', '.intent', 'node_modules'])

export class ProvenanceError extends Error {
  constructor(detail: string) {
    super(`cannot capture content provenance: ${detail}`)
    this.name = 'ProvenanceError'
  }
}

export interface FingerprintPolicy {
  allowedScope: string[]
  forbiddenScope: string[]
}

function relativeFiles(root: string, directory = '', out: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(join(root, directory), { withFileTypes: true })
  } catch (error) {
    throw new ProvenanceError((error as Error).message)
  }
  for (const entry of entries) {
    const relativePath = directory ? `${directory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!PRUNED_DIRECTORIES.has(entry.name)) relativeFiles(root, relativePath, out)
    } else if (entry.isFile()) {
      out.push(relativePath)
    }
  }
  return out
}

function hashFile(root: string, path: string): ContentFingerprintFile {
  try {
    const content = readFileSync(join(root, ...path.split('/')))
    return {
      path,
      size: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
    }
  } catch (error) {
    throw new ProvenanceError(`${path}: ${(error as Error).message}`)
  }
}

export function createContentFingerprint(root: string, policy: FingerprintPolicy): ContentFingerprint {
  const allowedScope = [...policy.allowedScope]
  const forbiddenScope = [...policy.forbiddenScope]
  const files = relativeFiles(root)
    .filter((path) => matchesScope(path, allowedScope))
    .filter((path) => forbiddenScope.length === 0 || !matchesScope(path, forbiddenScope))
    .sort((a, b) => a.localeCompare(b))
    .map((path) => hashFile(root, path))
  const digestInput = JSON.stringify({ version: 1, algorithm: 'sha256', allowedScope, forbiddenScope, files })
  return ContentFingerprintSchema.parse({
    version: 1,
    algorithm: 'sha256',
    allowedScope,
    forbiddenScope,
    digest: createHash('sha256').update(digestInput).digest('hex'),
    files,
  })
}

export function fingerprintPolicyForRun(root: string, run: RunState): FingerprintPolicy {
  const intent = run.intentId ? loadIntents(root).find((candidate) => candidate.id === run.intentId) : null
  const contract = run.contractId ? findContract(root, run.contractId) : null
  if (
    contract?.status === 'approved' &&
    contract.runId === run.runId &&
    contract.intentId === run.intentId
  ) {
    return { allowedScope: contract.allowedScope, forbiddenScope: contract.forbiddenScope }
  }
  return { allowedScope: intent?.scope ?? ['**'], forbiddenScope: [] }
}

export function createRunContentFingerprint(root: string, run: RunState): ContentFingerprint {
  return createContentFingerprint(root, fingerprintPolicyForRun(root, run))
}
