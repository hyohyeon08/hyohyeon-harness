import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  installCodexHooks,
  installCodexSkills,
  mergeCodexHooks,
  mergeHooks,
  renderTemplate,
} from '../dist/src/runtime/install.js'

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

test('mergeCodexHooks preserves unrelated groups on the same event', () => {
  const existing = {
    hooks: {
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'node custom.js' }] },
        { matcher: 'Edit', hooks: [{ type: 'command', command: 'node /old/dist/hooks/pre-write-guard.js' }] },
      ],
    },
  }
  const incoming = {
    PreToolUse: [{ matcher: 'apply_patch', hooks: [{ type: 'command', command: 'node /new/dist/hooks/pre-write-guard.js' }] }],
  }

  const merged = mergeCodexHooks(existing, incoming)

  assert.equal(merged.hooks.PreToolUse.length, 2)
  assert.equal(merged.hooks.PreToolUse[0].matcher, 'Bash')
  assert.equal(merged.hooks.PreToolUse[1].matcher, 'apply_patch')
})

test('installCodexHooks renders .codex/hooks.json', () => {
  const harness = process.cwd()
  const project = mkdtempSync(join(tmpdir(), 'intent-codex-hooks-'))
  mkdirSync(join(project, '.codex'), { recursive: true })
  writeFileSync(join(project, '.codex', 'hooks.json'), JSON.stringify({ hooks: { UserPromptSubmit: ['keep'] } }))

  const hooksPath = installCodexHooks(harness, project)
  const installed = JSON.parse(readFileSync(hooksPath, 'utf8'))

  assert.equal(hooksPath, join(project, '.codex', 'hooks.json'))
  assert.deepEqual(installed.hooks.UserPromptSubmit, ['keep'])
  assert.match(installed.hooks.PreToolUse[0].matcher, /apply_patch/)
  assert.match(installed.hooks.PreToolUse[0].hooks[0].command, /dist\/hooks\/pre-write-guard\.js/)
})

test('installCodexSkills copies skills to .agents/skills', () => {
  const harness = process.cwd()
  const project = mkdtempSync(join(tmpdir(), 'intent-codex-skills-'))

  const count = installCodexSkills(harness, project)

  assert.equal(count, 4)
  assert.match(readFileSync(join(project, '.agents', 'skills', 'intent', 'SKILL.md'), 'utf8'), /name: intent/)
})

test('CLI setup --install-codex installs a complete Codex target', () => {
  const project = mkdtempSync(join(tmpdir(), 'intent-codex-cli-'))
  const cli = join(process.cwd(), 'dist', 'src', 'cli', 'index.js')
  const result = spawnSync(process.execPath, [cli, 'setup', '--install-codex'], {
    cwd: project,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(join(project, '.intent', 'state.json')), true)
  assert.equal(existsSync(join(project, '.intent', 'runs')), true)
  assert.equal(existsSync(join(project, '.intent', 'raw', 'typecheck-results')), true)
  assert.equal(existsSync(join(project, '.intent', 'raw', 'unit_test-results')), true)
  assert.equal(existsSync(join(project, '.intent', 'raw', 'custom-results')), true)
  assert.equal(existsSync(join(project, '.codex', 'hooks.json')), true)
  assert.equal(existsSync(join(project, '.agents', 'skills', 'intent', 'SKILL.md')), true)
  assert.match(result.stdout, /Codex hooks/)
})
