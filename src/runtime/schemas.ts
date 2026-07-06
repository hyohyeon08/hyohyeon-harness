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
  sourceDetectionId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Rule = z.infer<typeof RuleSchema>

/**
 * A Run tracks one agent execution separately from the approved Intent.
 * Intent answers "what/why/scope"; Run answers "where is this execution now?".
 */
export const RunStatusSchema = z.enum(['active', 'blocked', 'passing', 'paused'])
export type RunStatus = z.infer<typeof RunStatusSchema>

export const RunPhaseSchema = z.enum(['interview', 'plan', 'contract', 'act', 'verify', 'done'])
export type RunPhase = z.infer<typeof RunPhaseSchema>

export const VerificationEvidenceTypeSchema = z.enum([
  'typecheck',
  'build',
  'lint',
  'unit_test',
  'integration_test',
  'e2e_test',
  'custom',
])
export type VerificationEvidenceType = z.infer<typeof VerificationEvidenceTypeSchema>

export const VerificationEvidenceStatusSchema = z.enum(['passed', 'failed'])
export type VerificationEvidenceStatus = z.infer<typeof VerificationEvidenceStatusSchema>

export const VerificationEvidenceSchema = z.object({
  evidenceId: z.string(),
  type: VerificationEvidenceTypeSchema,
  status: VerificationEvidenceStatusSchema,
  command: z.string(),
  args: z.array(z.string()).default([]),
  exitCode: z.number().int().nullable(),
  logPath: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
})
export type VerificationEvidence = z.infer<typeof VerificationEvidenceSchema>

export const TestMatrixDispositionSchema = z.enum(['required', 'optional', 'skipped'])
export type TestMatrixDisposition = z.infer<typeof TestMatrixDispositionSchema>

export const TestMatrixSchema = z.object({
  typecheck: TestMatrixDispositionSchema.default('optional'),
  build: TestMatrixDispositionSchema.default('optional'),
  lint: TestMatrixDispositionSchema.default('optional'),
  unit_test: TestMatrixDispositionSchema.default('optional'),
  integration_test: TestMatrixDispositionSchema.default('skipped'),
  e2e_test: TestMatrixDispositionSchema.default('skipped'),
  custom: TestMatrixDispositionSchema.default('skipped'),
})
export type TestMatrix = z.infer<typeof TestMatrixSchema>

export function defaultTestMatrixForIntentType(type: IntentType): TestMatrix {
  const common = TestMatrixSchema.parse({})
  if (type === 'feature' || type === 'fix') {
    return {
      ...common,
      typecheck: 'required',
      unit_test: 'required',
      integration_test: 'optional',
      e2e_test: 'optional',
    }
  }
  if (type === 'tidy') {
    return {
      ...common,
      typecheck: 'required',
      lint: 'optional',
      unit_test: 'optional',
    }
  }
  return {
    ...common,
    typecheck: 'required',
    build: 'optional',
    unit_test: 'skipped',
  }
}

export function requiredEvidenceTypesForMatrix(matrix: TestMatrix): VerificationEvidenceType[] {
  const parsed = TestMatrixSchema.parse(matrix)
  return VerificationEvidenceTypeSchema.options.filter((type) => parsed[type] === 'required')
}

export const SpanKindSchema = z.enum(['edit', 'apply_patch', 'run_command', 'run_check', 'hook', 'cli'])
export type SpanKind = z.infer<typeof SpanKindSchema>

export const SpanStatusSchema = z.enum(['ok', 'error', 'blocked'])
export type SpanStatus = z.infer<typeof SpanStatusSchema>

export const TraceSchema = z.object({
  traceId: z.string(),
  runId: z.string(),
  rootSpanId: z.string().nullable().default(null),
  spanIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Trace = z.infer<typeof TraceSchema>

export const SpanSchema = z.object({
  spanId: z.string(),
  traceId: z.string(),
  runId: z.string(),
  parentSpanId: z.string().nullable().default(null),
  kind: SpanKindSchema,
  name: z.string(),
  status: SpanStatusSchema.default('ok'),
  attributes: z.record(z.unknown()).default({}),
  startedAt: z.string(),
  endedAt: z.string().nullable().default(null),
})
export type Span = z.infer<typeof SpanSchema>

export const DetectionTypeSchema = z.enum(['thrashing', 'false_success'])
export type DetectionType = z.infer<typeof DetectionTypeSchema>

export const DetectionResultSchema = z.enum(['candidate', 'confirmed', 'dismissed'])
export type DetectionResult = z.infer<typeof DetectionResultSchema>

export const DetectionRecordSchema = z.object({
  detectionId: z.string(),
  type: DetectionTypeSchema,
  result: DetectionResultSchema.default('candidate'),
  runId: z.string().nullable().default(null),
  intentId: z.string().nullable().default(null),
  title: z.string(),
  summary: z.string(),
  evidenceRefs: z.array(z.string()).default([]),
  attributes: z.record(z.unknown()).default({}),
  resolution: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
})
export type DetectionRecord = z.infer<typeof DetectionRecordSchema>

export const EvalCaseStatusSchema = z.enum(['draft', 'approved', 'archived'])
export type EvalCaseStatus = z.infer<typeof EvalCaseStatusSchema>

export const EvalCaseSchema = z.object({
  evalId: z.string(),
  status: EvalCaseStatusSchema.default('draft'),
  sourceDetectionId: z.string().nullable().default(null),
  trigger: DetectionTypeSchema,
  title: z.string(),
  summary: z.string(),
  input: z.record(z.unknown()).default({}),
  expected: z.record(z.unknown()).default({}),
  evidenceRefs: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type EvalCase = z.infer<typeof EvalCaseSchema>

export const ContractStatusSchema = z.enum(['draft', 'approved', 'archived'])
export type ContractStatus = z.infer<typeof ContractStatusSchema>

export const SprintContractSchema = z.object({
  contractId: z.string(),
  runId: z.string(),
  intentId: z.string(),
  status: ContractStatusSchema.default('draft'),
  allowedScope: z.array(z.string()).default(['**']),
  forbiddenScope: z.array(z.string()).default([]),
  architectureBoundaries: z.array(z.string()).default([]),
  testMatrix: TestMatrixSchema.default(TestMatrixSchema.parse({})),
  requiredChecks: z.array(VerificationEvidenceTypeSchema).default([]),
  definitionOfDone: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SprintContract = z.infer<typeof SprintContractSchema>

export const RunStateSchema = z.object({
  runId: z.string(),
  objective: z.string(),
  phase: RunPhaseSchema.default('act'),
  status: RunStatusSchema.default('active'),
  intentId: z.string().nullable().default(null),
  specSlug: z.string().nullable().default(null),
  planId: z.string().nullable().default(null),
  contractId: z.string().nullable().default(null),
  nextAction: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
  evidence: z.array(VerificationEvidenceSchema).default([]),
  requiredEvidenceTypes: z.array(VerificationEvidenceTypeSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type RunState = z.infer<typeof RunStateSchema>

export const RunIndexSchema = z.object({
  version: z.literal(1),
  activeRunId: z.string().nullable().default(null),
  recentRunIds: z.array(z.string()).default([]),
})
export type RunIndex = z.infer<typeof RunIndexSchema>

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
