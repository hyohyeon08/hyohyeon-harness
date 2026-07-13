import { test } from 'node:test'
import assert from 'node:assert/strict'
import { locateEditRegion } from '../dist/src/runtime/edit-region.js'

test('locateEditRegion maps removed text to a stable line bucket', () => {
  const content = Array.from({ length: 45 }, (_, index) => `line ${index + 1}`).join('\n')

  const region = locateEditRegion(content, {
    path: 'src/app.ts',
    oldText: 'line 23\nline 24',
    newText: 'changed 23\nchanged 24',
    isNewFile: false,
  })

  assert.deepEqual(region, {
    regionStartLine: 23,
    regionEndLine: 24,
    regionBucket: 1,
    regionKey: 'src/app.ts:1',
  })
})

test('locateEditRegion returns null when no deterministic anchor exists', () => {
  assert.equal(
    locateEditRegion('const current = true', {
      path: 'src/app.ts',
      oldText: 'missing anchor',
      newText: 'replacement',
      isNewFile: false,
    }),
    null,
  )
})
