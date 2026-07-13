import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function hookCommands(config) {
  return Object.values(config.hooks).flat().flatMap((group) => group.hooks ?? []).map((hook) => hook.command)
}

test('repository dogfoods initialized state and portable Claude/Codex hooks', () => {
  assert.equal(existsSync(join(root, '.intent', 'state.json')), true)
  const state = JSON.parse(read('.intent/state.json'))
  assert.deepEqual(state, { version: 1, activeIntentId: null })

  for (const file of ['.claude/settings.json', '.codex/hooks.json']) {
    const commands = hookCommands(JSON.parse(read(file)))
    assert.equal(commands.length, 6, file)
    assert.equal(commands.every((command) => command.startsWith('node "dist/hooks/')), true, file)
    assert.equal(commands.every((command) => !command.includes('{{INTENT_ROOT}}')), true, file)
  }
})

test('package publishes only runtime assets and builds before packing', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts.prepack, 'npm run build')
  assert.deepEqual(pkg.files, [
    'dist/',
    'skills/',
    '.claude/settings.template.json',
    '.codex/hooks.template.json',
    'README.md',
    'LICENSE',
  ])
})

test('repository ships CI and the declared MIT license', () => {
  const workflow = read('.github/workflows/ci.yml')
  assert.match(workflow, /npm ci/)
  assert.match(workflow, /npm run typecheck/)
  assert.match(workflow, /npm test/)
  assert.match(read('LICENSE'), /MIT License/)
})

test('CLI entrypoint is split into domain command modules', () => {
  const entrypointLines = read('src/cli/index.ts').split('\n').length
  assert.ok(entrypointLines < 1000, `CLI entrypoint is still ${entrypointLines} lines`)
  for (const file of ['core.ts', 'feedback.ts', 'knowledge.ts']) {
    assert.equal(existsSync(join(root, 'src', 'cli', 'commands', file)), true, file)
  }
})
