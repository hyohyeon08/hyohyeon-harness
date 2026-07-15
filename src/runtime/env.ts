/** True when running inside a supported AI agent shell. */
export function isAiAgent(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.CLAUDECODE === '1' ||
    Boolean(env.CODEX_THREAD_ID) ||
    Boolean(env.CODEX_SHELL) ||
    Boolean(env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE)
  )
}

/**
 * Record who performed a readiness transition without assigning special
 * authority to any actor. The CLI remains the only writer of governance state.
 */
export function approvalActor(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CLAUDECODE === '1') return 'agent:claude-code'
  if (env.CODEX_THREAD_ID || env.CODEX_SHELL || env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE) {
    return 'agent:codex'
  }
  return 'human'
}
