/**
 * True when running inside an AI agent (Claude Code sets CLAUDECODE=1).
 *
 * Approvals (intent approve, rule approve) are human-only: the pre-write-guard
 * blocks the *file-edit* path, but the AI also has a shell and could run the CLI
 * directly. Gating those commands on this flag closes that hole — a human runs
 * them from their own terminal, where CLAUDECODE is unset.
 */
export function isAiAgent(): boolean {
  return process.env.CLAUDECODE === '1'
}
