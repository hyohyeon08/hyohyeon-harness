import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../state/paths.js'

/**
 * LLM Wiki (Karpathy pattern) — a project knowledge store, split into two
 * physical areas:
 *   knowledge/  — 정보: concept · decision · spec · guide · source · overview
 *   problems/   — 문제: failure(해결됨) · issue(미해결).  status: open | resolved
 *
 * Problems cross-link to the knowledge they relate to via [[slug]]. The index
 * is auto-generated with the two areas clearly separated. No raw/ layer — the
 * codebase + git is the immutable source of truth. CLI-only writes (the guard
 * blocks direct Edit/Write to .intent/). See skills/wiki/SKILL.md.
 */
export const KNOWLEDGE_TYPES = ['concept', 'decision', 'spec', 'guide', 'source', 'overview'] as const
export const PROBLEM_TYPES = ['failure', 'issue'] as const
export const WIKI_TYPES = [...KNOWLEDGE_TYPES, ...PROBLEM_TYPES] as const
export type WikiType = (typeof WIKI_TYPES)[number]
export type Area = 'knowledge' | 'problem'
export type Status = 'open' | 'resolved'

export function areaOf(type: WikiType): Area {
  return (PROBLEM_TYPES as readonly string[]).includes(type) ? 'problem' : 'knowledge'
}

/** Default lifecycle status for problem pages when frontmatter omits it. */
function defaultStatus(type: WikiType): Status | undefined {
  if (type === 'issue') return 'open'
  if (type === 'failure') return 'resolved'
  return undefined
}

export interface ArticleMeta {
  slug: string
  title: string
  type: WikiType
  area: Area
  status?: Status
  summary: string
  tags: string[]
  links: string[]
  confidence?: string
}

const LINK_RE = /\[\[([a-z0-9-]+)\]\]/gi

export function extractLinks(body: string): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(LINK_RE)) out.add(m[1].toLowerCase())
  return [...out]
}

// ─── Frontmatter (minimal YAML subset) ──────────────────────────────────────

export function parseFrontmatter(content: string): { fm: Record<string, string | string[]>; body: string } {
  const lines = content.split('\n')
  if (lines[0] !== '---') return { fm: {}, body: content }
  const end = lines.indexOf('---', 1)
  if (end === -1) return { fm: {}, body: content }
  const fm: Record<string, string | string[]> = {}
  for (const line of lines.slice(1, end)) {
    const i = line.indexOf(':')
    if (i === -1) continue
    const key = line.slice(0, i).trim()
    const raw = line.slice(i + 1).trim()
    fm[key] =
      raw.startsWith('[') && raw.endsWith(']')
        ? raw.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
        : raw
  }
  return { fm, body: lines.slice(end + 1).join('\n').replace(/^\n+/, '') }
}

export function serializeFrontmatter(fm: Record<string, string | string[]>): string {
  const body = Object.entries(fm)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`)
    .join('\n')
  return `---\n${body}\n---\n`
}

function firstParagraph(body: string): string {
  const line = body.split('\n').find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('>'))
  if (!line) return ''
  const t = line.trim()
  return t.length > 100 ? t.slice(0, 97) + '…' : t
}

// ─── Index (auto-generated, two areas: 정보 / 문제) ──────────────────────────

const KNOWLEDGE_ORDER: [WikiType, string][] = [
  ['concept', 'Concepts'],
  ['decision', 'Decisions'],
  ['spec', 'Specs'],
  ['guide', 'Guides'],
  ['source', 'Sources'],
]

function effectiveStatus(a: ArticleMeta): Status | undefined {
  return a.status ?? defaultStatus(a.type)
}

function listLine(a: ArticleMeta, withStatus = false): string {
  const st = withStatus && a.status ? ` _(${a.status})_` : ''
  return `- [[${a.slug}]]${st}${a.summary ? ` — ${a.summary}` : ''}`
}

/** Pure: build index.md — 시작점 + 정보(knowledge) + 문제(problems) + backlinks. */
export function composeIndex(articles: ArticleMeta[]): string {
  if (articles.length === 0) return '# Wiki Index\n\n_no articles yet_\n'

  const lines: string[] = ['# Wiki Index', '']
  const overview = articles.filter((a) => a.type === 'overview')
  lines.push('## 시작점', '')
  for (const a of overview) lines.push(listLine(a))
  lines.push('- [[log]] — 시간순 작업 로그', '')

  // ── 정보 (knowledge) ──
  const knowledge = articles.filter((a) => a.area === 'knowledge' && a.type !== 'overview')
  if (knowledge.length > 0) {
    lines.push('## 정보 (knowledge)', '')
    for (const [type, label] of KNOWLEDGE_ORDER) {
      const group = knowledge.filter((a) => a.type === type).sort((a, b) => a.slug.localeCompare(b.slug))
      if (group.length === 0) continue
      lines.push(`### ${label}`, '')
      for (const a of group) lines.push(listLine(a))
      lines.push('')
    }
  }

  // ── 문제 (problems): 미해결 먼저, 그다음 해결됨 ──
  const problems = articles.filter((a) => a.area === 'problem').sort((a, b) => a.slug.localeCompare(b.slug))
  if (problems.length > 0) {
    lines.push('## 문제 (problems)', '')
    const open = problems.filter((a) => effectiveStatus(a) === 'open')
    const resolved = problems.filter((a) => effectiveStatus(a) !== 'open')
    if (open.length > 0) {
      lines.push('### 미해결 (open)', '')
      for (const a of open) lines.push(listLine(a))
      lines.push('')
    }
    if (resolved.length > 0) {
      lines.push('### 해결됨 (resolved)', '')
      for (const a of resolved) lines.push(listLine(a))
      lines.push('')
    }
  }

  const backlinks = new Map<string, string[]>()
  for (const a of articles) for (const t of a.links) (backlinks.get(t) ?? backlinks.set(t, []).get(t)!).push(a.slug)
  if (backlinks.size > 0) {
    lines.push('## Backlinks', '')
    for (const [t, src] of [...backlinks].sort()) lines.push(`- ${t} ← ${src.sort().join(', ')}`)
  }
  return lines.join('\n').replace(/\n+$/, '') + '\n'
}

// ─── Log ────────────────────────────────────────────────────────────────────

export type LogKind = 'ingest' | 'query' | 'lint'

export interface LogEntry {
  date: string
  kind: LogKind
  title: string
  created?: string[]
  updated?: string[]
  note?: string
}

export function composeLogEntry(e: LogEntry): string {
  const lines = [`## [${e.date}] ${e.kind} | ${e.title}`]
  if (e.created?.length) lines.push(`- 생성: ${e.created.map((s) => `[[${s}]]`).join(', ')}`)
  if (e.updated?.length) lines.push(`- 수정: ${e.updated.map((s) => `[[${s}]]`).join(', ')}`)
  if (e.note) lines.push(`- 비고: ${e.note}`)
  return lines.join('\n') + '\n'
}

export function appendLog(root: string, e: LogEntry): void {
  const p = paths(root)
  mkdirSync(p.wikiDir, { recursive: true })
  if (!existsSync(p.wikiLog)) writeFileSync(p.wikiLog, '# Wiki Log\n\n', 'utf8')
  appendFileSync(p.wikiLog, '\n' + composeLogEntry(e), 'utf8')
}

// ─── Lint ─────────────────────────────────────────────────────────────────

export interface LintReport {
  orphans: string[]
  deadLinks: { from: string; to: string }[]
  lowConfidence: string[]
  openProblems: string[]
}

export function lintWiki(articles: ArticleMeta[]): LintReport {
  const slugs = new Set(articles.map((a) => a.slug))
  const linkedTo = new Set<string>()
  for (const a of articles) for (const t of a.links) linkedTo.add(t)

  // problems are discoverable via the ## 문제 index section, so they are not
  // expected to be linked-to hubs — exclude them (and overview) from orphans.
  const orphans = articles
    .filter((a) => a.type !== 'overview' && a.area !== 'problem' && !linkedTo.has(a.slug))
    .map((a) => a.slug)
  const deadLinks: { from: string; to: string }[] = []
  for (const a of articles) for (const t of a.links) if (!slugs.has(t)) deadLinks.push({ from: a.slug, to: t })
  const lowConfidence = articles.filter((a) => a.confidence === 'low').map((a) => a.slug)
  const openProblems = articles.filter((a) => a.area === 'problem' && effectiveStatus(a) === 'open').map((a) => a.slug)

  return { orphans, deadLinks, lowConfidence, openProblems }
}

// ─── fs operations (scan both area dirs) ────────────────────────────────────

function areaDir(root: string, type: WikiType): string {
  return areaOf(type) === 'problem' ? paths(root).wikiProblemsDir : paths(root).wikiKnowledgeDir
}

function findArticleFile(root: string, slug: string): { file: string; area: Area } | null {
  const p = paths(root)
  const prob = join(p.wikiProblemsDir, `${slug}.md`)
  if (existsSync(prob)) return { file: prob, area: 'problem' }
  const know = join(p.wikiKnowledgeDir, `${slug}.md`)
  if (existsSync(know)) return { file: know, area: 'knowledge' }
  return null
}

function readDirArticles(dir: string, area: Area): ArticleMeta[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '')
      const content = readFileSync(join(dir, f), 'utf8')
      const { fm, body } = parseFrontmatter(content)
      const type = (typeof fm.type === 'string' && (WIKI_TYPES as readonly string[]).includes(fm.type) ? fm.type : area === 'problem' ? 'issue' : 'concept') as WikiType
      const headingTitle = body.split('\n').find((l) => l.startsWith('# '))?.slice(2).trim()
      const status = (fm.status === 'open' || fm.status === 'resolved' ? fm.status : defaultStatus(type)) as Status | undefined
      return {
        slug,
        title: (typeof fm.title === 'string' && fm.title) || headingTitle || slug,
        type,
        area,
        status,
        summary: (typeof fm.summary === 'string' && fm.summary) || firstParagraph(body),
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        links: extractLinks(content),
        confidence: typeof fm.confidence === 'string' ? fm.confidence : undefined,
      }
    })
}

export function listArticles(root: string): ArticleMeta[] {
  const p = paths(root)
  return [
    ...readDirArticles(p.wikiKnowledgeDir, 'knowledge'),
    ...readDirArticles(p.wikiProblemsDir, 'problem'),
  ].sort((a, b) => a.slug.localeCompare(b.slug))
}

export interface NewArticleOpts {
  type?: WikiType
  summary?: string
  tags?: string[]
  status?: Status
}

export function newArticle(root: string, slug: string, title: string, opts: NewArticleOpts = {}): string {
  if (findArticleFile(root, slug)) throw new Error(`article already exists: ${slug}`)
  const type = opts.type ?? 'concept'
  const dir = areaDir(root, type)
  mkdirSync(dir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const fm = serializeFrontmatter({
    title,
    type,
    status: (opts.status ?? defaultStatus(type)) ?? '',
    tags: opts.tags ?? [],
    summary: opts.summary ?? '',
    created: date,
    updated: date,
  })
  const file = join(dir, `${slug}.md`)
  writeFileSync(file, `${fm}\n# ${title}\n\n`, 'utf8')
  appendLog(root, { date, kind: 'ingest', title, created: [slug] })
  rebuildIndex(root)
  return file
}

export function appendArticle(root: string, slug: string, text: string): string {
  const found = findArticleFile(root, slug)
  if (!found) throw new Error(`no such article: ${slug} (use \`intent wiki new\`)`)
  writeFileSync(found.file, readFileSync(found.file, 'utf8').replace(/\n*$/, '') + `\n\n${text}\n`, 'utf8')
  rebuildIndex(root)
  return found.file
}

export function readArticle(root: string, slug: string): string {
  const found = findArticleFile(root, slug)
  if (!found) throw new Error(`no such article: ${slug}`)
  return readFileSync(found.file, 'utf8')
}

/** Flip a problem page's status (e.g. close an issue). Rewrites frontmatter. */
export function setStatus(root: string, slug: string, status: Status): string {
  const found = findArticleFile(root, slug)
  if (!found) throw new Error(`no such article: ${slug}`)
  const { fm, body } = parseFrontmatter(readFileSync(found.file, 'utf8'))
  fm.status = status
  fm.updated = new Date().toISOString().slice(0, 10)
  writeFileSync(found.file, `${serializeFrontmatter(fm)}\n${body}`, 'utf8')
  rebuildIndex(root)
  return found.file
}

export function rebuildIndex(root: string): string {
  const p = paths(root)
  mkdirSync(p.wikiDir, { recursive: true })
  writeFileSync(p.wikiIndex, composeIndex(listArticles(root)), 'utf8')
  return p.wikiIndex
}
