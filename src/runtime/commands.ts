import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { tryAppendSpanToRun } from './observability.js'
import { findRun } from './runs.js'
import { extractErrorSignature } from './verification.js'

export interface CommandRecordArgs {
  runId: string
  command: string
  args?: string[]
  cwd?: string
  exitCode: number | null
  stdout?: string
  stderr?: string
  source?: string
  startedAt?: string
  finishedAt?: string
}

export interface RunCommandArgs {
  runId: string
  command: string
  args?: string[]
  cwd?: string
}

export interface CommandRecord {
  runId: string
  command: string
  args: string[]
  cwd: string
  exitCode: number | null
  stdout: string
  stderr: string
  logPath: string
  startedAt: string
  finishedAt: string
}

function fileTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function commandLog(record: Omit<CommandRecord, 'logPath'>, source: string): string {
  return [
    `[command] ${source}`,
    `runId: ${record.runId}`,
    `command: ${record.command}`,
    `args: ${JSON.stringify(record.args)}`,
    `cwd: ${record.cwd}`,
    `startedAt: ${record.startedAt}`,
    `finishedAt: ${record.finishedAt}`,
    `exitCode: ${record.exitCode === null ? 'null' : record.exitCode}`,
    '',
    '[stdout]',
    record.stdout,
    '',
    '[stderr]',
    record.stderr,
    '',
  ].join('\n')
}

export function recordObservedCommand(root: string, args: CommandRecordArgs): CommandRecord {
  const run = findRun(root, args.runId)
  if (!run) throw new Error(`no such run: ${args.runId}`)
  const now = new Date()
  const startedAt = args.startedAt ?? now.toISOString()
  const finishedAt = args.finishedAt ?? now.toISOString()
  const cwd = args.cwd ?? root
  const stdout = args.stdout ?? ''
  const stderr = args.stderr ?? ''
  const commandArgs = args.args ?? []
  const source = args.source ?? 'wrapper'
  const fileName = `${args.runId}-${fileTimestamp(new Date(finishedAt))}-${process.pid}.log`
  const logPath = `.intent/raw/command-results/${fileName}`
  const record: CommandRecord = {
    runId: args.runId,
    command: args.command,
    args: commandArgs,
    cwd,
    exitCode: args.exitCode,
    stdout,
    stderr,
    logPath,
    startedAt,
    finishedAt,
  }
  const log = commandLog(record, source)
  mkdirSync(paths(root).commandResultsDir, { recursive: true })
  writeFileSync(join(root, logPath), log, 'utf8')
  const failed = typeof args.exitCode === 'number' && args.exitCode !== 0
  const errorSignature = failed ? extractErrorSignature(log) : null
  tryAppendSpanToRun(root, args.runId, {
    kind: 'run_command',
    name: `command ${args.command}`,
    status: failed ? 'error' : 'ok',
    attributes: {
      command: args.command,
      args: commandArgs,
      cwd,
      exitCode: args.exitCode,
      logPath,
      source,
      ...(errorSignature ? { errorSignature } : {}),
    },
    startedAt,
    endedAt: finishedAt,
  })
  return record
}

export function runCommand(root: string, args: RunCommandArgs): CommandRecord {
  const startedAt = new Date().toISOString()
  const cwd = args.cwd ?? root
  const result = spawnSync(args.command, args.args ?? [], { cwd, encoding: 'utf8' })
  const finishedAt = new Date().toISOString()
  const spawnError = result.error ? `[spawn error]\n${result.error.message}\n` : ''
  return recordObservedCommand(root, {
    ...args,
    cwd,
    exitCode: typeof result.status === 'number' ? result.status : null,
    stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout ?? ''),
    stderr: `${typeof result.stderr === 'string' ? result.stderr : String(result.stderr ?? '')}${spawnError}`,
    source: 'intent-command-wrapper',
    startedAt,
    finishedAt,
  })
}
