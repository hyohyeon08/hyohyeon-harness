/**
 * Stop — the DoD + learning gate as a Claude Code hook. Blocks session
 * termination while any approved intent is not yet completable. Silent-fail.
 */
import { readStdinJson } from './_stdin.js'
import { evaluateStopGate } from '../src/runtime/stop-gate.js'
import { loadIntents } from '../src/runtime/intents.js'
import { rootOf, isIntentProject } from './_env.js'

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return
  const decision = evaluateStopGate(loadIntents(root))
  if (decision.block) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: '[intent] unfinished work:\n' + decision.reasons.map((r) => `  - ${r}`).join('\n'),
      }),
    )
  }
}

main().catch((e) => {
  process.stderr.write(`[intent] stop-continue error (ignored): ${e}\n`)
  process.exit(0)
})
