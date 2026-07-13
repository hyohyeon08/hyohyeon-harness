import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContentFingerprint } from '../dist/src/runtime/provenance.js'
import { approveIntent, draftIntent } from '../dist/src/runtime/intents.js'
import { createRun } from '../dist/src/runtime/runs.js'
import { runVerification } from '../dist/src/runtime/verification.js'
import { loadCompletionContexts } from '../dist/src/runtime/completion.js'

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'intent-provenance-'))
}

test('content fingerprint is deterministic and excludes harness/environment state', () => {
  const root = tempRoot()
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, '.intent'), { recursive: true })
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true })
  writeFileSync(join(root, 'src', 'app.ts'), 'export const value = 1\n', 'utf8')
  writeFileSync(join(root, '.intent', 'state.json'), '{}', 'utf8')
  writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'ignored', 'utf8')

  const first = createContentFingerprint(root, { allowedScope: ['**'], forbiddenScope: [] })
  const second = createContentFingerprint(root, { allowedScope: ['**'], forbiddenScope: [] })

  assert.equal(first.digest, second.digest)
  assert.deepEqual(first.files.map((file) => file.path), ['src/app.ts'])

  writeFileSync(join(root, 'src', 'app.ts'), 'export const value = 2\n', 'utf8')
  const changed = createContentFingerprint(root, { allowedScope: ['**'], forbiddenScope: [] })
  assert.notEqual(changed.digest, first.digest)
})

test('content fingerprint applies allowed and forbidden scope', () => {
  const root = tempRoot()
  mkdirSync(join(root, 'src', 'secret'), { recursive: true })
  writeFileSync(join(root, 'src', 'app.ts'), 'safe', 'utf8')
  writeFileSync(join(root, 'src', 'secret', 'token.ts'), 'secret', 'utf8')

  const fingerprint = createContentFingerprint(root, {
    allowedScope: ['src/**'],
    forbiddenScope: ['src/secret/**'],
  })

  assert.deepEqual(fingerprint.files.map((file) => file.path), ['src/app.ts'])
})

test('completion context invalidates passed evidence after an unobserved scoped write', () => {
  const root = tempRoot()
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'app.ts'), 'before\n', 'utf8')
  const drafted = draftIntent(root, {
    what: 'Guard direct writes',
    why: 'evidence must match content',
    type: 'feature',
    scope: ['src/**'],
  })
  const intent = approveIntent(root, drafted.id)
  const run = createRun(root, {
    objective: 'Capture provenance',
    intentId: intent.id,
    requiredEvidenceTypes: ['unit_test'],
  })
  runVerification(root, {
    runId: run.runId,
    type: 'unit_test',
    command: process.execPath,
    args: ['-e', 'process.exit(0)'],
  })

  assert.deepEqual(loadCompletionContexts(root, [intent])[0].staleEvidenceTypes, [])
  writeFileSync(join(root, 'src', 'app.ts'), 'after\n', 'utf8')
  assert.deepEqual(loadCompletionContexts(root, [intent])[0].staleEvidenceTypes, ['unit_test'])
})
