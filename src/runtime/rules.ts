import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJsonAtomic, writeJsonAtomicNew } from '../utils/json.js'
import { compareSequentialIds, nextSequentialId } from '../utils/id.js'
import {
  RuleSchema,
  type Rule,
  type RuleKind,
  type RuleReflectionKind,
  type RuleReflectionStatus,
} from './schemas.js'
import { matchesScope } from './scope.js'

export class RuleStateError extends Error {
  constructor(file: string, detail: string) {
    super(`invalid rule state ${file}: ${detail}`)
    this.name = 'RuleStateError'
  }
}

function ruleFile(root: string, id: string): string {
  return join(paths(root).rulesDir, `${id}.json`)
}

export function loadRules(root: string): Rule[] {
  const dir = paths(root).rulesDir
  if (!existsSync(dir)) return []
  const out: Rule[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    let raw: unknown
    try {
      raw = readJson(join(dir, f))
    } catch (error) {
      throw new RuleStateError(f, (error as Error).message)
    }
    const parsed = RuleSchema.safeParse(raw)
    if (!parsed.success) throw new RuleStateError(f, parsed.error.issues.map((issue) => issue.message).join('; '))
    out.push(parsed.data)
  }
  return out.sort((a, b) => compareSequentialIds(a.id, b.id))
}

export function findRule(root: string, id: string): Rule | null {
  let raw: unknown
  try {
    raw = readJson(ruleFile(root, id))
  } catch (error) {
    throw new RuleStateError(`${id}.json`, (error as Error).message)
  }
  if (raw === null) return null
  const parsed = RuleSchema.safeParse(raw)
  if (!parsed.success) throw new RuleStateError(`${id}.json`, parsed.error.issues.map((issue) => issue.message).join('; '))
  return parsed.data
}

function nextRuleId(root: string): string {
  return nextSequentialId('RULE', loadRules(root).map((rule) => rule.id))
}

function refreshedTimestamp(previous: string): string {
  const now = new Date().toISOString()
  if (now !== previous) return now
  return new Date(Date.parse(now) + 1).toISOString()
}

export interface DraftRuleOptions {
  sourceDetectionId?: string | null
}

/** Draft a rule; activation remains a separate, auditable transition. */
export function draftRule(
  root: string,
  kind: RuleKind,
  pattern: string,
  reason: string,
  opts: DraftRuleOptions = {},
): Rule {
  for (;;) {
    const now = new Date().toISOString()
    const rule = RuleSchema.parse({
      id: nextRuleId(root),
      kind,
      pattern,
      reason,
      status: 'draft',
      approvedBy: null,
      sourceDetectionId: opts.sourceDetectionId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    if (writeJsonAtomicNew(ruleFile(root, rule.id), rule)) return rule
  }
}

export function approveRule(root: string, id: string, by = 'agent:runtime'): Rule {
  return updateRule(root, id, (rule) => {
    if (rule.kind === 'forbid-pattern') {
      try {
        new RegExp(rule.pattern)
      } catch (error) {
        throw new Error(`cannot approve ${id}: invalid regex ${rule.pattern}: ${(error as Error).message}`)
      }
    }
    return { ...rule, status: 'approved', approvedBy: by }
  })
}

export function updateRule(root: string, id: string, fn: (rule: Rule) => Rule): Rule {
  const existing = findRule(root, id)
  if (!existing) throw new Error(`no such rule: ${id}`)
  const updated = RuleSchema.parse({
    ...fn(existing),
    updatedAt: refreshedTimestamp(existing.updatedAt),
  })
  writeJsonAtomic(ruleFile(root, id), updated)
  return updated
}

export function composeAgentsRuleCandidate(rule: Rule): string {
  const source = rule.sourceDetectionId ? `\nSource detection: ${rule.sourceDetectionId}` : ''
  const matcher = rule.kind === 'forbid-path'
    ? `Do not edit paths matching \`${rule.pattern}\` for this rule.`
    : `Do not introduce content matching \`/${rule.pattern}/\`.`
  return [
    `## AGENTS.md Candidate: ${rule.id}`,
    source.trim(),
    '',
    matcher,
    `Reason: ${rule.reason || 'No reason recorded.'}`,
    '',
    `Gate: ${rule.kind} ${rule.pattern}`,
  ].filter((line) => line !== '').join('\n')
}

export function composeCiRuleCandidate(rule: Rule): string {
  const source = rule.sourceDetectionId ? `# Source detection: ${rule.sourceDetectionId}` : '# Source detection: none'
  const command = rule.kind === 'forbid-pattern'
    ? `if rg -n '${rule.pattern.replace(/'/g, "'\\''")}' .; then echo '${rule.id} violated: ${rule.reason}'; exit 1; fi`
    : `echo '${rule.id}: check changed paths against ${rule.pattern} before merge'`
  return [
    `# CI Candidate: ${rule.id}`,
    source,
    '# Add this as a reviewed CI step; keep the approved rule JSON as the SSOT.',
    `- name: intent rule ${rule.id}`,
    '  run: |',
    `    ${command}`,
  ].join('\n')
}

export function recordRuleReflection(
  root: string,
  id: string,
  args: { kind: RuleReflectionKind; status: RuleReflectionStatus; target: string; evidence?: string },
): Rule {
  const now = new Date().toISOString()
  return updateRule(root, id, (rule) => {
    const withoutSameTarget = rule.reflections.filter((reflection) => (
      reflection.kind !== args.kind || reflection.target !== args.target
    ))
    return {
      ...rule,
      reflections: [
        ...withoutSameTarget,
        {
          kind: args.kind,
          status: args.status,
          target: args.target,
          evidence: args.evidence ?? '',
          updatedAt: now,
        },
      ],
    }
  })
}

export function composeRuleImpactReport(rule: Rule): string {
  const reflections = rule.reflections ?? []
  const hook = rule.status === 'approved'
    ? 'active: approved rules are enforced by pre-write guard'
    : 'inactive: draft rules are not enforced'
  const lines = [
    `rule impact ${rule.id} [${rule.status}]`,
    `kind: ${rule.kind}`,
    `pattern: ${rule.pattern}`,
    `reason: ${rule.reason || '—'}`,
    `source detection: ${rule.sourceDetectionId ?? '—'}`,
    `hook enforcement: ${hook}`,
    'reflections:',
  ]
  if (reflections.length === 0) {
    lines.push('  - —')
  } else {
    for (const reflection of reflections) {
      const evidence = reflection.evidence ? ` — ${reflection.evidence}` : ''
      lines.push(`  - ${reflection.kind}/${reflection.status}: ${reflection.target}${evidence}`)
    }
  }
  return lines.join('\n')
}

export interface RuleHit {
  blocked: boolean
  reason: string
}

/**
 * Pure: does any approved rule forbid this write? forbid-path matches the path
 * against a scope glob; forbid-pattern tests the new content against a regex.
 * A persisted approved invalid regex blocks writes so corrupt policy cannot fail open.
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
      } catch (error) {
        return { blocked: true, reason: `${r.id} has invalid regex /${r.pattern}/: ${(error as Error).message}` }
      }
      if (re.test(newText)) {
        return { blocked: true, reason: `${r.id} forbids pattern /${r.pattern}/: ${r.reason}` }
      }
    }
  }
  return { blocked: false, reason: '' }
}
