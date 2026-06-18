import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDraftArgs } from '../dist/src/runtime/draft-args.js'

test('parses what and why positionals', () => {
  const a = parseDraftArgs(['restore stock', 'cancel bug'])
  assert.equal(a.what, 'restore stock')
  assert.equal(a.why, 'cancel bug')
})

test('parses --type', () => {
  assert.equal(parseDraftArgs(['w', 'y', '--type', 'fix']).type, 'fix')
})

test('rejects an invalid --type', () => {
  assert.throws(() => parseDraftArgs(['w', 'y', '--type', 'nope']), /invalid --type/)
})

test('parses comma-separated --scope', () => {
  const a = parseDraftArgs(['w', 'y', '--scope', 'src/order/**, src/stock/**'])
  assert.deepEqual(a.scope, ['src/order/**', 'src/stock/**'])
})

test('parses repeatable --dod', () => {
  const a = parseDraftArgs(['w', 'y', '--dod', 'a passes', '--dod', 'b passes'])
  assert.deepEqual(a.dod, ['a passes', 'b passes'])
})

test('throws when why is missing', () => {
  assert.throws(() => parseDraftArgs(['only what']), /usage/)
})

test('flags do not get consumed as positionals', () => {
  const a = parseDraftArgs(['what', 'why', '--type', 'tidy', '--dod', 'x'])
  assert.equal(a.what, 'what')
  assert.equal(a.why, 'why')
  assert.equal(a.type, 'tidy')
})
