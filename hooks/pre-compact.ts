/**
 * PreCompact — the deterministic handoff trigger. Fires just before Claude
 * Code compacts the context window. Snapshots the "퇴근 전 인수인계" document
 * (current state + the AI's accumulated dead-ends/next-steps/questions) so the
 * post-compaction session resumes instead of losing subtle context. Silent-fail.
 */
import { readStdinJson } from './_stdin.js'
import { writeHandoff } from '../src/runtime/handoff.js'
import { recentLogLines } from '../src/runtime/memory.js'
import { paths } from '../src/state/paths.js'
import { rootOf, isIntentProject } from './_env.js'

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return
  const p = paths(root)
  const file = writeHandoff(root, {
    decisions: recentLogLines(p.decisions, 10),
    learnings: recentLogLines(p.learnings, 10),
  })
  process.stderr.write(`[intent] handoff snapshot written before compaction: ${file}\n`)
}

main().catch((e) => {
  process.stderr.write(`[intent] pre-compact error (ignored): ${e}\n`)
  process.exit(0)
})
