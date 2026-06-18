import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic } from '../utils/json.js'
import { RuleSchema, type Rule, type RuleKind } from './schemas.js'
import { matchesScope } from './scope.js'

function ruleFile(root: string, id: string): string {
  return join(paths(root).rulesDir, `${id}.json`)
}

export function loadRules(root: string): Rule[] {
  const dir = paths(root).rulesDir
  if (!existsSync(dir)) return []
  const out: Rule[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const parsed = RuleSchema.safeParse(readJson(join(dir, f)))
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

function nextRuleId(root: string): string {
  return `RULE-${String(loadRules(root).length + 1).padStart(3, '0')}`
}

/** AI may draft a rule (e.g. from a postmortem); only a human can approve it. */
export function draftRule(root: string, kind: RuleKind, pattern: string, reason: string): Rule {
  const now = new Date().toISOString()
  const rule = RuleSchema.parse({
    id: nextRuleId(root),
    kind,
    pattern,
    reason,
    status: 'draft',
    approvedBy: null,
    createdAt: now,
    updatedAt: now,
  })
  writeJsonAtomic(ruleFile(root, rule.id), rule)
  return rule
}

export function approveRule(root: string, id: string, by = 'human'): Rule {
  const file = ruleFile(root, id)
  const rule = RuleSchema.parse(readJson(file))
  const updated: Rule = { ...rule, status: 'approved', approvedBy: by, updatedAt: new Date().toISOString() }
  writeJsonAtomic(file, updated)
  return updated
}

export interface RuleHit {
  blocked: boolean
  reason: string
}

/**
 * Pure: does any approved rule forbid this write? forbid-path matches the path
 * against a scope glob; forbid-pattern tests the new content against a regex.
 * Invalid regexes are skipped (never throw — Invariant: rules can't break writes).
 */
export function checkRules(path: string, newText: string, rules: Rule[]): RuleHit {
  for (const r of rules) {
    if (r.status !== 'approved') continue
    if (r.kind === 'forbid-path') {
      if (matchesScope(path, [r.pattern])) {
        return { blocked: true, reason: `${r.id} forbids writing ${path}: ${r.reason}` }
      }
    } else {
      let re: RegExp
      try {
        re = new RegExp(r.pattern)
      } catch {
        continue
      }
      if (re.test(newText)) {
        return { blocked: true, reason: `${r.id} forbids pattern /${r.pattern}/: ${r.reason}` }
      }
    }
  }
  return { blocked: false, reason: '' }
}
