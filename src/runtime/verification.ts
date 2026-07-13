import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { paths } from '../state/paths.js'
import { tryAppendSpanToRun } from './observability.js'
import { appendRunEvidence, findRun } from './runs.js'
import {
  VerificationEvidenceSchema,
  type RunState,
  type VerificationEvidence,
  type VerificationEvidenceType,
} from './schemas.js'
import { createRunContentFingerprint } from './provenance.js'

export interface RunVerificationArgs {
  runId: string
  type: VerificationEvidenceType
  command: string
  args?: string[]
  cwd?: string
}

function evidenceIdFor(run: RunState): string {
  return `VE-${String(run.evidence.length + 1).padStart(3, '0')}`
}

function fileTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function relativeLogPath(type: VerificationEvidenceType, fileName: string): string {
  return `.intent/raw/${type}-results/${fileName}`
}

function normalizedLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ')
}

function sectionBetween(text: string, startMarker: string, endMarker?: string): string {
  const start = text.indexOf(startMarker)
  if (start === -1) return ''
  const afterStart = text.slice(start + startMarker.length)
  if (!endMarker) return afterStart
  const end = afterStart.indexOf(endMarker)
  return end === -1 ? afterStart : afterStart.slice(0, end)
}

function lastNonEmptyLine(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map(normalizedLine)
    .filter((line) => line.length > 0 && line !== '[spawn error]')
  return lines.length === 0 ? null : lines[lines.length - 1]
}

export function extractErrorSignature(log: string): string | null {
  const stderrLine = lastNonEmptyLine(sectionBetween(log, '[stderr]'))
  if (stderrLine) return stderrLine

  const stdout = sectionBetween(log, '[stdout]', '[stderr]') || log
  for (const line of stdout.split(/\r?\n/)) {
    const match = normalizedLine(line).match(/^not ok\s+\d+\s+-\s+(.+)$/)
    if (match) return `tap:not ok - ${match[1]}`
  }
  return null
}

function logText(
  args: RunVerificationArgs,
  result: ReturnType<typeof spawnSync>,
  cwd: string,
  startedAt: string,
  finishedAt: string,
): string {
  const stdout = typeof result.stdout === 'string' ? result.stdout : String(result.stdout ?? '')
  const stderr = typeof result.stderr === 'string' ? result.stderr : String(result.stderr ?? '')
  const error = result.error ? `\n[spawn error]\n${result.error.message}\n` : ''
  return [
    `[verification] ${args.type}`,
    `runId: ${args.runId}`,
    `command: ${args.command}`,
    `args: ${JSON.stringify(args.args ?? [])}`,
    `cwd: ${cwd}`,
    `startedAt: ${startedAt}`,
    `finishedAt: ${finishedAt}`,
    `exitCode: ${typeof result.status === 'number' ? result.status : 'null'}`,
    '',
    '[stdout]',
    stdout,
    '',
    '[stderr]',
    stderr,
    error,
  ].join('\n')
}

export function runVerification(root: string, args: RunVerificationArgs): VerificationEvidence {
  const run = findRun(root, args.runId)
  if (!run) throw new Error(`no such run: ${args.runId}`)

  const cwd = args.cwd ?? root
  const started = new Date()
  const startedAt = started.toISOString()
  const result = spawnSync(args.command, args.args ?? [], {
    cwd,
    encoding: 'utf8',
  })
  const finished = new Date()
  const finishedAt = finished.toISOString()
  const logFile = `${args.runId}-${fileTimestamp(finished)}.log`
  const logDir = paths(root).verificationResultsDir(args.type)
  const outputLog = logText(args, result, cwd, startedAt, finishedAt)
  mkdirSync(logDir, { recursive: true })
  writeFileSync(join(logDir, logFile), outputLog, 'utf8')

  const provenance = createRunContentFingerprint(root, run)

  const evidence = VerificationEvidenceSchema.parse({
    evidenceId: evidenceIdFor(run),
    type: args.type,
    status: result.status === 0 ? 'passed' : 'failed',
    command: args.command,
    args: args.args ?? [],
    exitCode: typeof result.status === 'number' ? result.status : null,
    logPath: relativeLogPath(args.type, logFile),
    provenance,
    startedAt,
    finishedAt,
  })
  appendRunEvidence(root, args.runId, evidence)
  const errorSignature = evidence.status === 'failed' ? extractErrorSignature(outputLog) : null
  tryAppendSpanToRun(root, args.runId, {
    kind: 'run_check',
    name: `verify ${args.type}`,
    status: evidence.status === 'passed' ? 'ok' : 'error',
    attributes: {
      type: args.type,
      evidenceId: evidence.evidenceId,
      evidenceStatus: evidence.status,
      command: args.command,
      args: args.args ?? [],
      cwd,
      exitCode: evidence.exitCode,
      logPath: evidence.logPath,
      ...(errorSignature ? { errorSignature } : {}),
    },
    startedAt,
    endedAt: finishedAt,
  })
  return evidence
}
