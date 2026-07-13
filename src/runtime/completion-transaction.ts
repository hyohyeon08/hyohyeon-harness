import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { completeIntent, loadIntents } from './intents.js'
import { findRun, markRunComplete } from './runs.js'
import {
  CompletionTransactionSchema,
  type CompletionTransaction,
  type Intent,
  type RunState,
  type SprintContract,
} from './schemas.js'

export class CompletionTransactionStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid completion transaction ${file}: ${detail}`)
    this.name = 'CompletionTransactionStateError'
  }
}

export interface CompletionTransactionOptions {
  /** Deterministic fault seam used to prove recovery after the first state write. */
  afterIntentCompleted?: () => void
}

export interface CompletionRepair {
  description: string
  apply: () => void
}

export interface CompletionReconciliation {
  repairs: CompletionRepair[]
  conflicts: string[]
}

function transactionFile(root: string, intentId: string): string {
  return paths(root).completionTransactionFile(intentId)
}

function writeTransaction(root: string, transaction: CompletionTransaction): CompletionTransaction {
  const parsed = CompletionTransactionSchema.parse(transaction)
  writeJsonAtomic(transactionFile(root, transaction.intentId), parsed)
  return parsed
}

function transitionTransaction(
  root: string,
  transaction: CompletionTransaction,
  status: CompletionTransaction['status'],
): CompletionTransaction {
  if (transaction.status === status) return transaction
  return writeTransaction(root, {
    ...transaction,
    status,
    updatedAt: new Date().toISOString(),
  })
}

/** Load and validate every durable completion journal. Corruption fails closed. */
export function loadCompletionTransactions(root: string): CompletionTransaction[] {
  const dir = paths(root).completionTransactionsDir
  if (!existsSync(dir)) return []
  const transactions: CompletionTransaction[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, file))
    } catch (error) {
      throw new CompletionTransactionStateError(file, (error as Error).message)
    }
    const parsed = CompletionTransactionSchema.safeParse(raw)
    if (!parsed.success) {
      throw new CompletionTransactionStateError(file, parsed.error.issues.map((issue) => issue.message).join('; '))
    }
    if (file !== `${parsed.data.intentId}.json`) {
      throw new CompletionTransactionStateError(file, `filename does not match intent ${parsed.data.intentId}`)
    }
    transactions.push(parsed.data)
  }
  return transactions.sort((left, right) => left.intentId.localeCompare(right.intentId))
}

function findTransaction(root: string, intentId: string): CompletionTransaction | null {
  return loadCompletionTransactions(root).find((transaction) => transaction.intentId === intentId) ?? null
}

function findIntent(root: string, intentId: string): Intent {
  const intent = loadIntents(root).find((candidate) => candidate.id === intentId)
  if (!intent) throw new CompletionTransactionStateError(`${intentId}.json`, 'referenced Intent is missing')
  return intent
}

function validateRun(root: string, transaction: CompletionTransaction): RunState | null {
  if (!transaction.runId) return null
  const run = findRun(root, transaction.runId)
  if (!run) {
    throw new CompletionTransactionStateError(`${transaction.intentId}.json`, `referenced Run ${transaction.runId} is missing`)
  }
  if (run.intentId !== transaction.intentId) {
    throw new CompletionTransactionStateError(
      `${transaction.intentId}.json`,
      `${transaction.runId} belongs to ${run.intentId ?? 'no Intent'}`,
    )
  }
  return run
}

function isRunComplete(run: RunState | null): boolean {
  return !run || (run.phase === 'done' && run.status === 'passing')
}

function finishPendingTransaction(root: string, transaction: CompletionTransaction): Intent {
  const intent = findIntent(root, transaction.intentId)
  if (intent.status !== 'done') {
    throw new CompletionTransactionStateError(
      `${transaction.intentId}.json`,
      `cannot finish pending transaction while Intent is ${intent.status}`,
    )
  }
  const run = validateRun(root, transaction)
  if (run && !isRunComplete(run)) markRunComplete(root, run.runId)
  transitionTransaction(root, transaction, 'committed')
  return intent
}

/**
 * Complete the governed Intent and Run through a durable, retry-safe journal.
 * The journal makes the unavoidable cross-file crash window observable and
 * recoverable by `intent reconcile --apply`.
 */
export function completeIntentTransaction(
  root: string,
  intentId: string,
  run?: RunState | null,
  contract?: SprintContract | null,
  options: CompletionTransactionOptions = {},
): Intent {
  const existing = findTransaction(root, intentId)
  const requestedRunId = run?.runId ?? existing?.runId ?? null
  if (existing && run && existing.runId !== run.runId) {
    throw new CompletionTransactionStateError(
      `${intentId}.json`,
      `Run changed from ${existing.runId ?? 'none'} to ${run.runId}`,
    )
  }
  if (existing?.status === 'committed') {
    const intent = findIntent(root, intentId)
    const committedRun = validateRun(root, existing)
    if (intent.status !== 'done' || !isRunComplete(committedRun)) {
      throw new CompletionTransactionStateError(`${intentId}.json`, 'committed journal does not match terminal state')
    }
    return intent
  }
  if (existing?.status === 'pending' && findIntent(root, intentId).status === 'done') {
    return finishPendingTransaction(root, existing)
  }

  const now = new Date().toISOString()
  const transaction = writeTransaction(root, CompletionTransactionSchema.parse({
    version: 1,
    transactionId: `COMPLETE-${intentId}`,
    intentId,
    runId: requestedRunId,
    status: 'pending',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }))
  if (transaction.runId) validateRun(root, transaction)

  const intent = completeIntent(root, intentId, run, contract)
  options.afterIntentCompleted?.()
  if (transaction.runId) markRunComplete(root, transaction.runId)
  transitionTransaction(root, transaction, 'committed')
  return intent
}

/** Derive safe completion-journal repairs without mutating state. */
export function inspectCompletionTransactions(root: string): CompletionReconciliation {
  const repairs: CompletionRepair[] = []
  const conflicts: string[] = []
  for (const transaction of loadCompletionTransactions(root)) {
    let intent: Intent
    let run: RunState | null
    try {
      intent = findIntent(root, transaction.intentId)
      run = validateRun(root, transaction)
    } catch (error) {
      conflicts.push((error as Error).message)
      continue
    }

    if (transaction.status === 'committed') {
      if (intent.status !== 'done' || !isRunComplete(run)) {
        conflicts.push(`${transaction.transactionId} is committed but terminal Intent/Run state is inconsistent`)
      }
      continue
    }
    if (transaction.status === 'aborted') {
      if (intent.status === 'done') conflicts.push(`${transaction.transactionId} is aborted but ${intent.id} is done`)
      continue
    }
    if (intent.status === 'done') {
      repairs.push({
        description: run
          ? `finish completion ${intent.id} with ${run.runId}`
          : `commit completion ${intent.id}`,
        apply: () => { finishPendingTransaction(root, transaction) },
      })
      continue
    }
    repairs.push({
      description: `abort untouched completion ${intent.id}`,
      apply: () => { transitionTransaction(root, transaction, 'aborted') },
    })
  }
  return { repairs, conflicts }
}
