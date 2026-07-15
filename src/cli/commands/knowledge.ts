import { existsSync, readFileSync } from 'node:fs'
import { paths } from '../../state/paths.js'
import { appendScratch, writeHandoff, type ScratchKind } from '../../runtime/handoff.js'
import { recentLogLines } from '../../runtime/memory.js'
import {
  newArticle, appendArticle, readArticle, listArticles, rebuildIndex, lintWiki, setStatus,
  type WikiType, type Status,
} from '../../runtime/wiki.js'
import { recordPostmortem } from '../../runtime/postmortem.js'
import { recordDetectionWikiPage, unIngestedDetections } from '../../runtime/detections.js'
import type { RuleKind } from '../../runtime/schemas.js'
import type { CliContext } from '../shared.js'

export function cmdHandoff(context: CliContext): void {
  const { root, args } = context
  const p = paths(root)
  if (args[0] === 'note') {
    const kind = args[1] as ScratchKind
    const text = args[2]
    if (!['deadend', 'next', 'question'].includes(kind) || !text) {
      console.error('usage: intent handoff note <deadend|next|question> "<text>"')
      process.exit(1)
    }
    appendScratch(root, kind, text)
    console.log(`handoff: noted (${kind})`)
    return
  }
  const file = writeHandoff(root, {
    decisions: recentLogLines(p.decisions, 10),
    learnings: recentLogLines(p.learnings, 10),
  })
  console.log(`handoff written: ${file}`)
}

export function cmdWiki(context: CliContext): void {
  const { root, args } = context
  const sub = args[0]
  const flag = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  try {
    if (sub === 'new') {
      const file = newArticle(root, args[1], args[2] ?? args[1], {
        type: flag('--type') as WikiType | undefined,
        summary: flag('--summary'),
        status: flag('--status') as Status | undefined,
      })
      console.log(`wiki: created ${file}`)
    } else if (sub === 'resolve') {
      const file = setStatus(root, args[1], 'resolved')
      console.log(`wiki: resolved ${args[1]} (${file})`)
    } else if (sub === 'append') {
      const file = appendArticle(root, args[1], args[2])
      console.log(`wiki: appended to ${file}`)
    } else if (sub === 'ingest' && args[1] === 'detection') {
      const detectionId = args[2]
      if (!detectionId) {
        console.error('usage: intent wiki ingest detection <detectionId>')
        process.exit(1)
      }
      const { slug, file } = recordDetectionWikiPage(root, detectionId)
      console.log(`wiki: ingested detection ${detectionId} -> ${slug} (${file})`)
    } else if (sub === 'show') {
      process.stdout.write(readArticle(root, args[1]))
    } else if (sub === 'index') {
      console.log(`wiki: index rebuilt at ${rebuildIndex(root)}`)
    } else if (sub === 'log') {
      const p = paths(root)
      process.stdout.write(existsSync(p.wikiLog) ? readFileSync(p.wikiLog, 'utf8') : '(no wiki log yet)\n')
    } else if (sub === 'lint') {
      const r = lintWiki(listArticles(root))
      const unIngested = unIngestedDetections(root).map((detection) => detection.detectionId)
      console.log(`orphans: ${r.orphans.join(', ') || 'none'}`)
      console.log(`dead links: ${r.deadLinks.map((d) => `${d.from}→${d.to}`).join(', ') || 'none'}`)
      console.log(`low confidence: ${r.lowConfidence.join(', ') || 'none'}`)
      console.log(`open problems: ${r.openProblems.join(', ') || 'none'}`)
      console.log(`un-ingested detections: ${unIngested.join(', ') || 'none'}`)
    } else if (sub === 'list' || !sub) {
      for (const a of listArticles(root)) {
        const st = a.status ? ` (${a.status})` : ''
        console.log(`${a.slug}  [${a.area}/${a.type}${st}]  ${a.title}`)
      }
    } else {
      console.error('usage: intent wiki list | new <slug> "<title>" [--type T --status open|resolved --summary "..."] | resolve <slug> | append <slug> "<text>" | ingest detection <detectionId> | show <slug> | index | log | lint')
      process.exit(1)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

export function cmdPostmortem(context: CliContext): void {
  const { root, args } = context
  const title = args.find((a) => !a.startsWith('--'))
  if (!title) {
    console.error('usage: intent postmortem "<title>" --cause "..." --prevent "..." [--rule <forbid-path|forbid-pattern> <pattern>]')
    process.exit(1)
  }
  const flag = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const ruleIdx = args.indexOf('--rule')
  const rule =
    ruleIdx >= 0
      ? { kind: args[ruleIdx + 1] as RuleKind, pattern: args[ruleIdx + 2] }
      : undefined
  if (rule && rule.kind !== 'forbid-path' && rule.kind !== 'forbid-pattern') {
    console.error('--rule kind must be forbid-path or forbid-pattern')
    process.exit(1)
  }
  const res = recordPostmortem(root, {
    title,
    cause: flag('--cause') ?? '',
    prevention: flag('--prevent') ?? '',
    rule,
  })
  console.log(`postmortem recorded: wiki/${res.slug}` + (res.ruleId ? ` + drafted ${res.ruleId} (activate when ready)` : ''))
}
