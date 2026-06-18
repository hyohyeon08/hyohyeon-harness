import type { Change } from './triviality.js'

/**
 * Raw edit data lifted from a Claude Code tool call:
 *   Write -> newText = content, oldText = existing file (or ''), isNewFile = !exists
 *   Edit  -> newText = new_string, oldText = old_string, isNewFile = false
 */
export interface RawEdit {
  path: string
  newText: string
  oldText: string
  isNewFile: boolean
}

// Language-agnostic heuristics. Comment lines are excluded before testing, so
// a comment that merely mentions "if" does not register as control flow.
const NEW_SYMBOL_RE =
  /\b(function|class|interface|enum|struct|trait|impl|def|fn|func|type|module|namespace)\b|=>\s*\{|\bexport\b/
const CONTROL_FLOW_RE = /\b(if|else|for|while|switch|case|try|catch|finally|do|match|when)\b/
const COMMENT_RE = /^(\/\/|#|\/\*|\*\/|\*|<!--|-->|--)/

function isCommentOrBlank(line: string): boolean {
  const t = line.trim()
  return t.length === 0 || COMMENT_RE.test(t)
}

function lineCount(text: string): number {
  return text === '' ? 0 : text.split('\n').length
}

export function extractChange(edit: RawEdit): Change {
  const codeLines = edit.newText.split('\n').filter((l) => !isCommentOrBlank(l))
  const nonBlank = edit.newText.split('\n').filter((l) => l.trim().length > 0)
  const codeText = codeLines.join('\n')

  return {
    path: edit.path,
    addedLines: lineCount(edit.newText),
    removedLines: lineCount(edit.oldText),
    newSymbols: NEW_SYMBOL_RE.test(codeText),
    addsControlFlow: CONTROL_FLOW_RE.test(codeText),
    onlyCommentsOrFormat: nonBlank.length > 0 && codeLines.length === 0,
    isNewFile: edit.isNewFile,
  }
}
