import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compareSequentialIds, nextSequentialId } from '../dist/src/utils/id.js'
import { writeJsonAtomicNew } from '../dist/src/utils/json.js'

test('nextSequentialId allocates after the highest id instead of reusing a hole', () => {
  assert.equal(nextSequentialId('RUN', ['RUN-001', 'RUN-003']), 'RUN-004')
})

test('nextSequentialId keeps ids loadable after 999 records', () => {
  assert.equal(nextSequentialId('DET', ['DET-999']), 'DET-1000')
})

test('compareSequentialIds keeps numeric order after 999', () => {
  assert.deepEqual(['RUN-1000', 'RUN-999', 'RUN-010'].sort(compareSequentialIds), ['RUN-010', 'RUN-999', 'RUN-1000'])
})

test('writeJsonAtomicNew never replaces an existing record', () => {
  const root = mkdtempSync(join(tmpdir(), 'intent-atomic-new-'))
  const file = join(root, 'RUN-001.json')

  assert.equal(writeJsonAtomicNew(file, { owner: 'first' }), true)
  assert.equal(writeJsonAtomicNew(file, { owner: 'second' }), false)
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { owner: 'first' })
})

test('concurrent intent creators retry collisions without losing records', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intent-concurrent-create-'))
  const moduleUrl = pathToFileURL(join(process.cwd(), 'dist', 'src', 'runtime', 'intents.js')).href
  const script = [
    `import { draftIntent } from ${JSON.stringify(moduleUrl)}`,
    `draftIntent(process.argv[1], { what: process.argv[2], why: 'concurrency test' })`,
  ].join('; ')
  const run = (writer) => new Promise((resolve, reject) => {
    execFile(process.execPath, ['--input-type=module', '-e', script, root, writer], (error) => {
      if (error) reject(error)
      else resolve()
    })
  })

  await Promise.all(Array.from({ length: 8 }, (_, index) => run(`writer-${index}`)))

  const dir = join(root, '.intent', 'intents')
  const files = readdirSync(dir).filter((file) => /^INT-\d{3,}\.json$/.test(file)).sort()
  const owners = files.map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')).what).sort()
  assert.deepEqual(files, Array.from({ length: 8 }, (_, index) => `INT-${String(index + 1).padStart(3, '0')}.json`))
  assert.deepEqual(owners, Array.from({ length: 8 }, (_, index) => `writer-${index}`).sort())
})
