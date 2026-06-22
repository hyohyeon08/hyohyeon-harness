/**
 * True when running inside an AI agent shell.
 *
 * Approvals (intent approve, rule approve) are human-only: the pre-write-guard
 * blocks the *file-edit* path, but the AI also has a shell and could run the CLI
 * directly. Gating those commands on agent-specific environment variables
 * closes that hole. A human runs them from their own terminal.
 */
export function isAiAgent(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.CLAUDECODE === '1' ||
    Boolean(env.CODEX_THREAD_ID) ||
    Boolean(env.CODEX_SHELL) ||
    Boolean(env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE)
  )
}
