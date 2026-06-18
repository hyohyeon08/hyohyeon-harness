import { z } from 'zod'

/**
 * An Intent is the spine of the harness: AI declares "what + why" before
 * touching non-trivial code. A human approves it. Approval == scope boundary
 * == evidence that the human understood the change.
 */
export const IntentTypeSchema = z.enum(['feature', 'fix', 'tidy', 'chore'])
export type IntentType = z.infer<typeof IntentTypeSchema>

export const IntentStatusSchema = z.enum(['draft', 'approved', 'done', 'rejected'])
export type IntentStatus = z.infer<typeof IntentStatusSchema>

export const IntentSchema = z.object({
  id: z.string(),
  what: z.string(),
  why: z.string(),
  type: IntentTypeSchema,
  /** Glob-ish path prefixes this intent is allowed to touch (Phase 2 tightens matching). */
  scope: z.array(z.string()).default(['**']),
  dod: z.array(z.string()).default([]),
  dodChecked: z.array(z.string()).default([]),
  status: IntentStatusSchema.default('draft'),
  /** Only a human sets this — AI cannot self-approve (see decision: 승인 주체 = 사람만). */
  approvedBy: z.string().nullable().default(null),
  /** Required for behavior-changing intents (feature/fix) before they reach 'done'. */
  learnings: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Intent = z.infer<typeof IntentSchema>

/**
 * A machine-enforced gate rule, distinct from the readable wiki. Failures that
 * can be expressed deterministically become rules (Beck: a gate beats a text
 * reminder). Human-approved — only `approved` rules enforce.
 */
export const RuleKindSchema = z.enum(['forbid-path', 'forbid-pattern'])
export type RuleKind = z.infer<typeof RuleKindSchema>

export const RuleSchema = z.object({
  id: z.string(),
  kind: RuleKindSchema,
  pattern: z.string(), // a scope glob (forbid-path) or a regex (forbid-pattern)
  reason: z.string(),
  status: z.enum(['draft', 'approved']).default('draft'),
  approvedBy: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Rule = z.infer<typeof RuleSchema>

export const StateSchema = z.object({
  version: z.literal(1),
  activeIntentId: z.string().nullable().default(null),
})
export type State = z.infer<typeof StateSchema>

export const ConfigSchema = z.object({
  version: z.literal(1),
  triviality: z
    .object({
      /** Changes touching <= maxLines and adding no new symbols/control-flow are trivial. */
      maxLines: z.number().int().positive().default(5),
    })
    .default({ maxLines: 5 }),
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = { version: 1, triviality: { maxLines: 5 } }
