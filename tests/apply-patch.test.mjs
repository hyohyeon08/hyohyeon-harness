import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractApplyPatchEdits } from '../dist/src/runtime/apply-patch.js'
import { classifyChange } from '../dist/src/runtime/triviality.js'

test('apply_patch add file becomes a new-file edit', () => {
  const edits = extractApplyPatchEdits(`*** Begin Patch
*** Add File: src/new.ts
+export function run() {}
*** End Patch`)

  assert.equal(edits.length, 1)
  assert.deepEqual(edits[0], {
    path: 'src/new.ts',
    newText: 'export function run() {}',
    oldText: '',
    isNewFile: true,
  })
  assert.equal(classifyChange({ ...edits[0], addedLines: 1, removedLines: 0, newSymbols: true, addsControlFlow: false, onlyCommentsOrFormat: false }).triviality, 'non-trivial')
})

test('apply_patch update collects added and removed lines', () => {
  const edits = extractApplyPatchEdits(`*** Begin Patch
*** Update File: src/a.ts
@@
-const port = 3000
+const port = 4000
 context
*** End Patch`)

  assert.equal(edits.length, 1)
  assert.equal(edits[0].path, 'src/a.ts')
  assert.equal(edits[0].oldText, 'const port = 3000')
  assert.equal(edits[0].newText, 'const port = 4000')
  assert.equal(edits[0].isNewFile, false)
})

test('apply_patch delete file is non-trivial', () => {
  const edits = extractApplyPatchEdits(`*** Begin Patch
*** Delete File: src/old.ts
*** End Patch`)

  assert.equal(edits.length, 1)
  assert.equal(edits[0].path, 'src/old.ts')
  assert.equal(edits[0].deletesFile, true)
  assert.equal(classifyChange({ ...edits[0], addedLines: 0, removedLines: 0, newSymbols: false, addsControlFlow: false, onlyCommentsOrFormat: false }).reason, 'deletes file')
})

test('apply_patch move checks both source and destination paths', () => {
  const edits = extractApplyPatchEdits(`*** Begin Patch
*** Update File: src/old.ts
*** Move to: src/new.ts
@@
-old()
+new()
*** End Patch`)

  assert.equal(edits.length, 2)
  assert.equal(edits[0].path, 'src/old.ts')
  assert.equal(edits[0].deletesFile, true)
  assert.equal(edits[1].path, 'src/new.ts')
  assert.equal(edits[1].isNewFile, true)
})
