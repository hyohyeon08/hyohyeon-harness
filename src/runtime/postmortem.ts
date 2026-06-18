import { newArticle, appendArticle, listArticles } from './wiki.js'
import { draftRule } from './rules.js'
import type { RuleKind } from './schemas.js'

/** kebab-case slug that keeps unicode letters (so Korean titles stay meaningful). */
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'untitled'
}

export interface PostmortemParts {
  cause: string
  prevention: string
  ruleRef?: string
}

/** Pure: the body appended to a failure article (heading comes from the article). */
export function composePostmortem(parts: PostmortemParts): string {
  const lines = [
    `_recorded ${new Date().toISOString().slice(0, 10)}_`,
    '',
    '## 근본 원인',
    parts.cause || '—',
    '',
    '## 재발 방지',
    parts.prevention || '—',
  ]
  if (parts.ruleRef) lines.push('', `_gate rule drafted: ${parts.ruleRef}_`)
  return lines.join('\n')
}

export interface RecordOptions {
  title: string
  cause: string
  prevention: string
  rule?: { kind: RuleKind; pattern: string }
}

/**
 * Record a failure: always to the wiki (the readable ledger), and — when the
 * prevention is expressible deterministically — also draft a gate rule for a
 * human to approve. This is the "분류해서: 게이트 가능한 건 게이트로" branch.
 */
export function recordPostmortem(root: string, opts: RecordOptions): { slug: string; ruleId?: string } {
  const slug = `failure-${slugify(opts.title)}`

  let ruleId: string | undefined
  if (opts.rule) {
    ruleId = draftRule(root, opts.rule.kind, opts.rule.pattern, `재발 방지: ${opts.title}`).id
  }

  const body = composePostmortem({ cause: opts.cause, prevention: opts.prevention, ruleRef: ruleId })
  const exists = listArticles(root).some((a) => a.slug === slug)
  if (!exists) newArticle(root, slug, `Failure: ${opts.title}`, { type: 'failure', summary: opts.title })
  appendArticle(root, slug, body)

  return { slug, ruleId }
}
