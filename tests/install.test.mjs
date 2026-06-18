import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderTemplate, mergeHooks } from '../dist/src/runtime/install.js'

test('renderTemplate replaces every {{INTENT_ROOT}} and normalizes backslashes', () => {
  const tpl = 'node {{INTENT_ROOT}}/dist/a.js and {{INTENT_ROOT}}/dist/b.js'
  const out = renderTemplate(tpl, 'C:\\Users\\me\\harness')
  assert.equal(out, 'node C:/Users/me/harness/dist/a.js and C:/Users/me/harness/dist/b.js')
})

test('mergeHooks preserves other top-level keys', () => {
  const merged = mergeHooks({ model: 'opus', permissions: {} }, { Stop: [1] })
  assert.equal(merged.model, 'opus')
  assert.deepEqual(merged.permissions, {})
  assert.deepEqual(merged.hooks.Stop, [1])
})

test('mergeHooks keeps existing non-intent hook events and overwrites same event', () => {
  const existing = { hooks: { Notification: ['keep'], Stop: ['old'] } }
  const merged = mergeHooks(existing, { Stop: ['new'], PreToolUse: ['x'] })
  assert.deepEqual(merged.hooks.Notification, ['keep']) // untouched
  assert.deepEqual(merged.hooks.Stop, ['new']) // overwritten (idempotent re-run)
  assert.deepEqual(merged.hooks.PreToolUse, ['x'])
})

test('mergeHooks works from an empty settings object', () => {
  const merged = mergeHooks({}, { SessionStart: [1] })
  assert.deepEqual(merged.hooks.SessionStart, [1])
})
