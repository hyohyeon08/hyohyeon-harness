import { basename } from 'node:path'

export interface AgentCommandDecision {
  blocked: boolean
  reason: string
}

const DIRECT_MUTATORS = new Set([
  'rm',
  'mv',
  'cp',
  'install',
  'touch',
  'mkdir',
  'rmdir',
  'truncate',
  'tee',
  'dd',
  'chmod',
  'chown',
  'python',
  'python3',
  'node',
  'ruby',
  'bash',
  'sh',
  'zsh',
  'powershell',
  'pwsh',
])

function shellTokens(command: string): string[] {
  return (command.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s;&|]+/g) ?? [])
    .map((token) => token.replace(/^["']|["']$/g, ''))
}

function referencesIntentState(tokens: string[]): boolean {
  return tokens.some((token) => /(?:^|[/\\])\.intent(?:[/\\]|$)/.test(token.replace(/^[^=]*=/, '')))
}

function redirectsToIntentState(tokens: string[]): boolean {
  return tokens.some((token, index) => (
    (token === '>' || token === '>>' || /^\d?>>$/.test(token) || /^\d?>$/.test(token)) &&
    /(?:^|[/\\])\.intent(?:[/\\]|$)/.test(tokens[index + 1] ?? '')
  ))
}

function mutatesIntentState(tokens: string[]): boolean {
  if (!referencesIntentState(tokens)) return false
  if (redirectsToIntentState(tokens)) return true

  const programs = tokens.map((token) => basename(token))
  if (programs.some((program) => DIRECT_MUTATORS.has(program))) return true
  if (programs.includes('sed') && tokens.some((token) => /^-.*i/.test(token))) return true
  if (programs.includes('perl') && tokens.some((token) => /^-.*i/.test(token))) return true
  if (programs.includes('git')) {
    return tokens.some((token) => ['checkout', 'restore', 'clean', 'reset', 'apply'].includes(token))
  }
  return false
}

/**
 * Guard the supported Agent shell channel before execution.
 *
 * This is deliberately conservative around `.intent/`: supported AI tools
 * must use the CLI writer for every lifecycle transition. Approval, archive,
 * and resolution commands are ordinary CLI operations and remain allowed.
 */
export function checkAgentCommand(command: string): AgentCommandDecision {
  const tokens = shellTokens(command)
  if (mutatesIntentState(tokens)) {
    return {
      blocked: true,
      reason: 'protected .intent state must be changed through the intent CLI, not a direct shell write',
    }
  }
  return { blocked: false, reason: 'command does not directly mutate protected intent state' }
}
