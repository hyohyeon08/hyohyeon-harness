import { slugify } from './postmortem.js'
import { newArticle, appendArticle, listArticles } from './wiki.js'

/**
 * A shared-understanding spec — the output of /interview. It lives in the wiki
 * (knowledge that compounds), but unlike ordinary wiki articles it carries an
 * readiness marker: a spec becomes usable once the agent has checked that the
 * captured understanding is sufficient for the governed task.
 */
export function specSlug(title: string): string {
  return `spec-${slugify(title)}`
}

export function composeSpecStatus(status: 'draft' | 'approved', by?: string, date?: string): string {
  return status === 'approved'
    ? `> status: ✅ approved by ${by} on ${date}`
    : `> status: 🚧 draft (activate when ready with \`intent spec approve <slug>\`)`
}

export function specExists(root: string, slug: string): boolean {
  return listArticles(root).some((a) => a.slug === slug)
}

/** Draft the spec into the wiki before its explicit readiness transition. */
export function draftSpec(root: string, title: string): { slug: string } {
  const slug = specSlug(title)
  if (!specExists(root, slug)) newArticle(root, slug, `Spec: ${title}`, { type: 'spec', summary: title })
  appendArticle(root, slug, composeSpecStatus('draft'))
  return { slug }
}

/** Record that the spec is ready and who performed the transition. */
export function approveSpec(root: string, slug: string, by = 'agent:runtime'): void {
  if (!specExists(root, slug)) throw new Error(`no such spec: ${slug}`)
  appendArticle(root, slug, composeSpecStatus('approved', by, new Date().toISOString().slice(0, 10)))
}
