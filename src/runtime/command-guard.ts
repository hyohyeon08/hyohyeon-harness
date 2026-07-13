import { basename } from 'node:path'

export interface AgentCommandDecision {
  blocked: boolean
  reason: string
}

const HUMAN_ONLY_ACTIONS = new Set([
  'approve',
  'rule approve',
  'spec approve',
  'plan approve',
  'plan archive',
  'interview approve',
  'interview archive',
  'contract approve',
  'contract archive',
  'detection resolve',
])

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

function isIntentCliToken(token: string): boolean {
  if (basename(token) === 'intent') return true
  return /(?:^|[/\\])(?:dist[/\\])?src[/\\]cli[/\\]index\.(?:js|ts)$/.test(token)
}

function humanOnlyAction(tokens: string[]): string | null {
  for (let index = 0; index < tokens.length; index += 1) {
    if (!isIntentCliToken(tokens[index])) continue
    const first = tokens[index + 1] ?? ''
    const second = tokens[index + 2] ?? ''
    const action = HUMAN_ONLY_ACTIONS.has(first) ? first : `${first} ${second}`
    if (HUMAN_ONLY_ACTIONS.has(action)) return action
  }
  return null
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
 * must use the CLI writer, while approvals and archives are performed from a
 * human terminal where this hook is not involved.
 */
export function checkAgentCommand(command: string): AgentCommandDecision {
  const tokens = shellTokens(command)
  const action = humanOnlyAction(tokens)
  if (action) {
    return {
      blocked: true,
      reason: `human-only approval action (${action}) must run from the user's terminal`,
    }
  }
  if (mutatesIntentState(tokens)) {
    return {
      blocked: true,
      reason: 'protected .intent state must be changed through the intent CLI, not a direct shell write',
    }
  }
  return { blocked: false, reason: 'command does not cross the supported Agent trust boundary' }
}
