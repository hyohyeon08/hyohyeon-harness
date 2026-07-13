/**
 * Stop — the DoD + learning gate as a Claude Code hook. Blocks session
 * termination while any approved intent is not yet completable. Silent-fail.
 */
import { readStdinJson } from './_stdin.js'
import { evaluateCompletionAttempt } from '../src/runtime/completion.js'
import { IntentStateError, loadIntents } from '../src/runtime/intents.js'
import { ContractStateError } from '../src/runtime/contracts.js'
import { RunStateError } from '../src/runtime/runs.js'
import { ProvenanceError } from '../src/runtime/provenance.js'
import { rootOf, isIntentProject } from './_env.js'

async function main(): Promise<void> {
  const payload = await readStdinJson()
  const root = rootOf(payload)
  if (!isIntentProject(root)) return
  let intents
  try {
    intents = loadIntents(root)
  } catch (error) {
    if (!(error instanceof IntentStateError)) throw error
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `[intent state] ${error.message}. Repair the state before stopping.`,
    }))
    return
  }
  let attempt
  try {
    attempt = evaluateCompletionAttempt(root, intents)
  } catch (error) {
    if (error instanceof ProvenanceError) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `[provenance] ${error.message}. Repair the filesystem state before stopping.`,
      }))
      return
    }
    if (error instanceof RunStateError) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `[run state] ${error.message}. Repair the state before stopping.`,
      }))
      return
    }
    if (!(error instanceof ContractStateError)) throw error
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `[contract state] ${error.message}. Repair the state before stopping.`,
    }))
    return
  }
  if (attempt.block) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: '[intent] unfinished work:\n' + attempt.reasons.map((reason) => `  - ${reason}`).join('\n'),
      }),
    )
  }
}

main().catch((e) => {
  process.stderr.write(`[intent] stop-continue error (ignored): ${e}\n`)
  process.exit(0)
})
