import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { listSpans } from '../dist/src/runtime/observability.js'
import { createRun, findRun } from '../dist/src/runtime/runs.js'

const WORKER_COUNT = 16

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-concurrency-'))
}

function startWorker(script, args) {
  const child = spawn(process.execPath, ['--input-type=module', '--eval', script, ...args], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let ready = false
  let markReady
  const readyPromise = new Promise((resolve) => {
    markReady = resolve
  })

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    if (!ready && stdout.includes('ready\n')) {
      ready = true
      markReady()
    }
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })

  const done = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (!ready) markReady()
      if (code === 0) resolve()
      else reject(new Error(`worker exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`))
    })
  })
  void done.catch(() => {})

  return {
    ready: readyPromise,
    release() {
      child.stdin.end('go\n')
    },
    done,
  }
}

async function runTogether(script, argumentLists) {
  const workers = argumentLists.map((args) => startWorker(script, args))
  await Promise.all(workers.map((worker) => worker.ready))
  for (const worker of workers) worker.release()
  await Promise.all(workers.map((worker) => worker.done))
}

test('parallel Node processes append evidence to one Run without lost updates', async () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'append evidence concurrently' })
  const runsUrl = pathToFileURL(join(process.cwd(), 'dist', 'src', 'runtime', 'runs.js')).href
  const workerScript = `
    const [moduleUrl, root, runId, workerId] = process.argv.slice(1)
    const { appendRunEvidence } = await import(moduleUrl)
    process.stdout.write('ready\\n')
    await new Promise((resolve) => process.stdin.once('data', resolve))
    const timestamp = '2026-07-15T00:00:00.000Z'
    appendRunEvidence(root, runId, {
      evidenceId: 'VE-' + workerId,
      type: 'custom',
      status: 'passed',
      command: 'worker-' + workerId,
      args: [],
      exitCode: 0,
      logPath: 'worker-' + workerId + '.log',
      provenance: null,
      startedAt: timestamp,
      finishedAt: timestamp,
    })
  `
  const workerIds = Array.from({ length: WORKER_COUNT }, (_, index) => String(index + 1).padStart(3, '0'))

  await runTogether(
    workerScript,
    workerIds.map((workerId) => [runsUrl, root, run.runId, workerId]),
  )

  const updated = findRun(root, run.runId)
  assert.equal(updated.evidence.length, WORKER_COUNT)
  assert.deepEqual(
    [...updated.evidence.map((evidence) => evidence.evidenceId)].sort(),
    workerIds.map((workerId) => `VE-${workerId}`),
  )
})

test('parallel Node processes append spans to one Trace without lost updates', async () => {
  const root = tempRoot()
  const run = createRun(root, { objective: 'append spans concurrently' })
  const observabilityUrl = pathToFileURL(join(process.cwd(), 'dist', 'src', 'runtime', 'observability.js')).href
  const workerScript = `
    const [moduleUrl, root, runId, workerId] = process.argv.slice(1)
    const { appendSpanToRun } = await import(moduleUrl)
    process.stdout.write('ready\\n')
    await new Promise((resolve) => process.stdin.once('data', resolve))
    appendSpanToRun(root, runId, {
      kind: 'hook',
      name: 'worker span ' + workerId,
      attributes: { workerId },
    })
  `
  const workerIds = Array.from({ length: WORKER_COUNT }, (_, index) => String(index + 1).padStart(3, '0'))

  await runTogether(
    workerScript,
    workerIds.map((workerId) => [observabilityUrl, root, run.runId, workerId]),
  )

  const spans = listSpans(root, run.runId)
  const expectedSpanIds = workerIds.map((workerId) => `SPAN-${workerId}`)
  assert.equal(spans.length, WORKER_COUNT)
  assert.deepEqual(spans.map((span) => span.spanId), expectedSpanIds)
  assert.deepEqual(
    [...spans.map((span) => span.attributes.workerId)].sort(),
    workerIds,
  )

  const trace = JSON.parse(readFileSync(
    join(root, '.intent', 'raw', 'observability', 'traces', `TRACE-${run.runId}.json`),
    'utf8',
  ))
  assert.equal(trace.rootSpanId, 'SPAN-001')
  assert.deepEqual(trace.spanIds, expectedSpanIds)
})
