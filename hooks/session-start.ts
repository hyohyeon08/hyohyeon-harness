/**
 * SessionStart — memory injection. Writes open intents + recent decisions and
 * learnings to stderr (the context channel) so a fresh session resumes work
 * instead of re-deriving it. The cure for "컨텍스트 단절". Silent-fail.
 */
import { readStdinJson } from './_stdin.js'
import { readSessionContext } from '../src/runtime/memory.js'
import { rootOf, isIntentProject } from './_env.js'

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return
  process.stderr.write(readSessionContext(root) + '\n')
}

main().catch((e) => {
  process.stderr.write(`[intent] session-start error (ignored): ${e}\n`)
  process.exit(0)
})
