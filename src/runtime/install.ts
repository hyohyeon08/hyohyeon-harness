import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'

/** Replace the {{INTENT_ROOT}} placeholder with the harness path (slash-normalized for JSON). */
export function renderTemplate(template: string, harnessRoot: string): string {
  return template.split('{{INTENT_ROOT}}').join(harnessRoot.replace(/\\/g, '/'))
}

/**
 * Merge rendered hook config into an existing settings object. Other top-level
 * keys are preserved; hook events are overwritten per-event (idempotent — a
 * re-run replaces the intent events without duplicating them).
 */
export function mergeHooks(existing: Record<string, any>, incomingHooks: Record<string, unknown>): Record<string, any> {
  return { ...existing, hooks: { ...(existing.hooks ?? {}), ...incomingHooks } }
}

function isIntentHookGroup(value: unknown): boolean {
  return JSON.stringify(value).includes('/dist/hooks/')
}

/**
 * Merge Codex hooks without deleting unrelated groups on the same event.
 * Reinstalling replaces only previously installed intent groups.
 */
export function mergeCodexHooks(
  existing: Record<string, any>,
  incomingHooks: Record<string, unknown>,
): Record<string, any> {
  const hooks = { ...(existing.hooks ?? {}) }
  for (const [event, incoming] of Object.entries(incomingHooks)) {
    const current = Array.isArray(hooks[event]) ? hooks[event].filter((group: unknown) => !isIntentHookGroup(group)) : []
    hooks[event] = [...current, ...(Array.isArray(incoming) ? incoming : [incoming])]
  }
  return { ...existing, hooks }
}

/** Render settings.template.json and merge it into <project>/.claude/settings.json. */
export function installHooks(harnessRoot: string, projectRoot: string): string {
  const tpl = readFileSync(join(harnessRoot, '.claude', 'settings.template.json'), 'utf8')
  const rendered = JSON.parse(renderTemplate(tpl, harnessRoot)) as { hooks: Record<string, unknown> }
  const settingsPath = join(projectRoot, '.claude', 'settings.json')
  const existing = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {}
  mkdirSync(dirname(settingsPath), { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(mergeHooks(existing, rendered.hooks), null, 2) + '\n', 'utf8')
  return settingsPath
}

/** Render hooks.template.json and merge it into <project>/.codex/hooks.json. */
export function installCodexHooks(harnessRoot: string, projectRoot: string): string {
  const tpl = readFileSync(join(harnessRoot, '.codex', 'hooks.template.json'), 'utf8')
  const rendered = JSON.parse(renderTemplate(tpl, harnessRoot)) as { hooks: Record<string, unknown> }
  const hooksPath = join(projectRoot, '.codex', 'hooks.json')
  const existing = existsSync(hooksPath) ? JSON.parse(readFileSync(hooksPath, 'utf8')) : {}
  mkdirSync(dirname(hooksPath), { recursive: true })
  writeFileSync(hooksPath, JSON.stringify(mergeCodexHooks(existing, rendered.hooks), null, 2) + '\n', 'utf8')
  return hooksPath
}

function copySkills(harnessRoot: string, dst: string): number {
  const src = join(harnessRoot, 'skills')
  if (!existsSync(src)) return 0
  mkdirSync(dst, { recursive: true })
  let n = 0
  for (const name of readdirSync(src)) {
    const from = join(src, name)
    if (!statSync(from).isDirectory()) continue
    cpSync(from, join(dst, name), { recursive: true })
    n++
  }
  return n
}

/** Copy each skill folder into <project>/.claude/skills/. Returns the count. */
export function installSkills(harnessRoot: string, projectRoot: string): number {
  return copySkills(harnessRoot, join(projectRoot, '.claude', 'skills'))
}

/** Copy each skill folder into <project>/.agents/skills/. Returns the count. */
export function installCodexSkills(harnessRoot: string, projectRoot: string): number {
  return copySkills(harnessRoot, join(projectRoot, '.agents', 'skills'))
}
