import { slugify } from './postmortem.js'
import { newArticle, appendArticle, listArticles } from './wiki.js'

/**
 * A shared-understanding spec — the output of /interview. It lives in the wiki
 * (knowledge that compounds), but unlike ordinary wiki articles it carries an
 * approval marker: a spec is only trustworthy once the human has signed off that
 * the AI's understanding matches theirs (closing the "백그라운드 GAP").
 */
export function specSlug(title: string): string {
  return `spec-${slugify(title)}`
}

export function composeSpecStatus(status: 'draft' | 'approved', by?: string, date?: string): string {
  return status === 'approved'
    ? `> status: ✅ approved by ${by} on ${date}`
    : `> status: 🚧 draft (awaiting human approval — review then \`intent spec approve <slug>\`)`
}

function specExists(root: string, slug: string): boolean {
  return listArticles(root).some((a) => a.slug === slug)
}

/** AI drafts the spec into the wiki (autonomous); a human approves it later. */
export function draftSpec(root: string, title: string): { slug: string } {
  const slug = specSlug(title)
  if (!specExists(root, slug)) newArticle(root, slug, `Spec: ${title}`, { type: 'spec', summary: title })
  appendArticle(root, slug, composeSpecStatus('draft'))
  return { slug }
}

/** Human-only sign-off (gated on CLAUDECODE in the CLI). */
export function approveSpec(root: string, slug: string, by = 'human'): void {
  if (!specExists(root, slug)) throw new Error(`no such spec: ${slug}`)
  appendArticle(root, slug, composeSpecStatus('approved', by, new Date().toISOString().slice(0, 10)))
}
