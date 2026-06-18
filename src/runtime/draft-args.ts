import { IntentTypeSchema, type IntentType } from './schemas.js'

export interface DraftArgs {
  what: string
  why: string
  type?: IntentType
  scope?: string[]
  dod?: string[]
}

/**
 * Parse `intent draft` arguments:
 *   intent draft "<what>" "<why>" [--type feature|fix|tidy|chore]
 *                [--scope a/**,b/**] [--dod "item" --dod "item"]
 *
 * Positional: first two non-flag tokens are what/why. Throws on missing
 * what/why or an unknown type so the skill gets a clear error.
 */
export function parseDraftArgs(args: string[]): DraftArgs {
  const positional: string[] = []
  let type: IntentType | undefined
  let scope: string[] | undefined
  const dod: string[] = []

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--type') {
      const v = args[++i]
      const parsed = IntentTypeSchema.safeParse(v)
      if (!parsed.success) throw new Error(`invalid --type "${v}" (feature|fix|tidy|chore)`)
      type = parsed.data
    } else if (a === '--scope') {
      scope = (args[++i] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (a === '--dod') {
      const v = args[++i]
      if (v) dod.push(v)
    } else {
      positional.push(a)
    }
  }

  const [what, why] = positional
  if (!what || !why) throw new Error('usage: intent draft "<what>" "<why>" [--type] [--scope] [--dod ...]')

  return { what, why, type, scope, dod: dod.length > 0 ? dod : undefined }
}
