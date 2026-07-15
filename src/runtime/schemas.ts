import { z } from 'zod'

/**
 * An Intent is the spine of the harness: AI declares "what + why" before
 * touching non-trivial code. Approval is an agent-controlled readiness
 * transition and an auditable scope boundary.
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
  /** Provenance for the actor that performed the readiness transition. */
  approvedBy: z.string().nullable().default(null),
  /** Required for behavior-changing intents (feature/fix) before they reach 'done'. */
  learnings: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Intent = z.infer<typeof IntentSchema>

/** Durable journal for the cross-record Intent + Run completion transition. */
export const CompletionTransactionStatusSchema = z.enum(['pending', 'committed', 'aborted'])
export type CompletionTransactionStatus = z.infer<typeof CompletionTransactionStatusSchema>

export const CompletionTransactionSchema = z.object({
  version: z.literal(1),
  transactionId: z.string(),
  intentId: z.string(),
  runId: z.string().nullable().default(null),
  status: CompletionTransactionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CompletionTransaction = z.infer<typeof CompletionTransactionSchema>

/**
 * A machine-enforced gate rule, distinct from the readable wiki. Failures that
 * can be expressed deterministically become rules (Beck: a gate beats a text
 * reminder). Only rules in the explicit `approved` readiness state enforce.
 */
export const RuleKindSchema = z.enum(['forbid-path', 'forbid-pattern'])
export type RuleKind = z.infer<typeof RuleKindSchema>

export const RuleReflectionKindSchema = z.enum(['agents', 'ci'])
export type RuleReflectionKind = z.infer<typeof RuleReflectionKindSchema>

export const RuleReflectionStatusSchema = z.enum(['candidate', 'applied'])
export type RuleReflectionStatus = z.infer<typeof RuleReflectionStatusSchema>

export const RuleReflectionSchema = z.object({
  kind: RuleReflectionKindSchema,
  status: RuleReflectionStatusSchema,
  target: z.string(),
  evidence: z.string().default(''),
  updatedAt: z.string(),
})
export type RuleReflection = z.infer<typeof RuleReflectionSchema>

export const RuleSchema = z.object({
  id: z.string(),
  kind: RuleKindSchema,
  pattern: z.string(), // a scope glob (forbid-path) or a regex (forbid-pattern)
  reason: z.string(),
  status: z.enum(['draft', 'approved']).default('draft'),
  approvedBy: z.string().nullable().default(null),
  sourceDetectionId: z.string().nullable().default(null),
  reflections: z.array(RuleReflectionSchema).default([]),
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

export const RunBudgetSchema = z.object({
  maxAttempts: z.number().int().positive().default(3),
  attemptsUsed: z.number().int().nonnegative().default(0),
})
export type RunBudget = z.infer<typeof RunBudgetSchema>

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

export const ContentFingerprintFileSchema = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
})
export type ContentFingerprintFile = z.infer<typeof ContentFingerprintFileSchema>

export const ContentFingerprintSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal('sha256'),
  allowedScope: z.array(z.string()),
  forbiddenScope: z.array(z.string()),
  digest: z.string(),
  files: z.array(ContentFingerprintFileSchema),
})
export type ContentFingerprint = z.infer<typeof ContentFingerprintSchema>

export const VerificationEvidenceSchema = z.object({
  evidenceId: z.string(),
  type: VerificationEvidenceTypeSchema,
  status: VerificationEvidenceStatusSchema,
  command: z.string(),
  args: z.array(z.string()).default([]),
  exitCode: z.number().int().nullable(),
  logPath: z.string(),
  provenance: ContentFingerprintSchema.nullable().default(null),
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

export const JudgeStatusSchema = z.enum(['not_run', 'pass', 'fail', 'uncertain'])
export type JudgeStatus = z.infer<typeof JudgeStatusSchema>

export const JudgeClassificationSchema = z.enum(['thrashing', 'false_success', 'none'])
export type JudgeClassification = z.infer<typeof JudgeClassificationSchema>

export const DetectionJudgeSchema = z.object({
  status: JudgeStatusSchema.default('not_run'),
  judgement: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  classification: JudgeClassificationSchema.nullable().default(null),
  suggestedAction: z.string().nullable().default(null),
  inputDigest: z.string().nullable().default(null),
  adapterKey: z.string().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
})
export type DetectionJudge = z.infer<typeof DetectionJudgeSchema>

export const DetectionEmbeddingSchema = z.object({
  modelKey: z.string(),
  inputDigest: z.string(),
  vector: z.array(z.number().finite()).min(1),
  updatedAt: z.string(),
})
export type DetectionEmbedding = z.infer<typeof DetectionEmbeddingSchema>

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
  judge: DetectionJudgeSchema.default(DetectionJudgeSchema.parse({})),
  embedding: DetectionEmbeddingSchema.nullable().default(null),
  resolution: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
})
export type DetectionRecord = z.infer<typeof DetectionRecordSchema>

export const EvalCaseStatusSchema = z.enum(['draft', 'approved', 'archived'])
export type EvalCaseStatus = z.infer<typeof EvalCaseStatusSchema>

export const EvalRunStatusSchema = z.enum(['passed', 'failed'])
export type EvalRunStatus = z.infer<typeof EvalRunStatusSchema>

export const EvalRunResultSchema = z.object({
  status: EvalRunStatusSchema,
  reason: z.string(),
  runAt: z.string(),
})
export type EvalRunResult = z.infer<typeof EvalRunResultSchema>

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
  lastRun: EvalRunResultSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type EvalCase = z.infer<typeof EvalCaseSchema>

export const ContractStatusSchema = z.enum(['draft', 'approved', 'archived'])
export type ContractStatus = z.infer<typeof ContractStatusSchema>

/**
 * Contract semantics are deliberately split:
 * - Machine-enforced policy: lifecycle status and Run/Intent lineage,
 *   allowedScope, forbiddenScope, and requiredChecks.
 * - Reviewer metadata only: architectureBoundaries, definitionOfDone, rubric,
 *   stopConditions, and requiresUserDecision. These fields are displayed to a
 *   reviewer but are not interpreted as automatic write or completion gates.
 */
export const SprintContractSchema = z.object({
  /** Machine-enforced identity and lifecycle lineage. */
  contractId: z.string(),
  revision: z.number().int().positive().default(1),
  supersedesContractId: z.string().nullable().default(null),
  runId: z.string(),
  intentId: z.string(),
  status: ContractStatusSchema.default('draft'),
  /** Audit provenance for the readiness transition; not a completion predicate. */
  approvedBy: z.string().nullable().default(null),
  approvedAt: z.string().nullable().default(null),
  /** Machine-enforced write policy once the linked Contract is approved. */
  allowedScope: z.array(z.string()).default(['**']),
  forbiddenScope: z.array(z.string()).default([]),
  /** Reviewer metadata only; no natural-language boundary parser is a gate. */
  architectureBoundaries: z.array(z.string()).default([]),
  /** Planning input used to default requiredChecks; completion reads requiredChecks. */
  testMatrix: TestMatrixSchema.default(TestMatrixSchema.parse({})),
  /** Machine-enforced completion evidence policy. */
  requiredChecks: z.array(VerificationEvidenceTypeSchema).default([]),
  /** Reviewer metadata only; Intent DoD remains the automatic DoD gate. */
  definitionOfDone: z.array(z.string()).default([]),
  /** Reviewer metadata only; scores are not evaluated automatically. */
  rubric: z.record(z.number()).default({}),
  /** Reviewer metadata only; entries do not automatically block execution. */
  stopConditions: z.array(z.string()).default([]),
  /** Reviewer metadata only; entries do not create an automatic decision gate. */
  requiresUserDecision: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SprintContract = z.infer<typeof SprintContractSchema>

export const PlanStatusSchema = z.enum(['draft', 'approved', 'archived'])
export type PlanStatus = z.infer<typeof PlanStatusSchema>

export const InterviewStatusSchema = z.enum(['draft', 'approved', 'archived'])
export type InterviewStatus = z.infer<typeof InterviewStatusSchema>

export const InterviewSummarySchema = z.object({
  interviewId: z.string(),
  revision: z.number().int().positive().default(1),
  supersedesInterviewId: z.string().nullable().default(null),
  status: InterviewStatusSchema.default('draft'),
  title: z.string(),
  goal: z.string(),
  why: z.string().default(''),
  context: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  allowedScope: z.array(z.string()).default(['**']),
  forbiddenScope: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  failureCriteria: z.array(z.string()).default([]),
  verification: z.array(z.string()).default([]),
  consideredOptions: z.array(z.string()).default([]),
  nonGoals: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  intentId: z.string().nullable().default(null),
  specSlug: z.string().nullable().default(null),
  planId: z.string().nullable().default(null),
  runId: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  approvedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type InterviewSummary = z.infer<typeof InterviewSummarySchema>

export const PlanVerificationCommandSchema = z.object({
  type: VerificationEvidenceTypeSchema,
  command: z.string(),
  args: z.array(z.string()).default([]),
})
export type PlanVerificationCommand = z.infer<typeof PlanVerificationCommandSchema>

export const PlanSchema = z.object({
  planId: z.string(),
  revision: z.number().int().positive().default(1),
  supersedesPlanId: z.string().nullable().default(null),
  status: PlanStatusSchema.default('draft'),
  approvedBy: z.string().nullable().default(null),
  approvedAt: z.string().nullable().default(null),
  title: z.string(),
  objective: z.string(),
  problem: z.string().default(''),
  intentId: z.string().nullable().default(null),
  interviewId: z.string().nullable().default(null),
  specSlug: z.string().nullable().default(null),
  runId: z.string().nullable().default(null),
  allowedScope: z.array(z.string()).default(['**']),
  forbiddenScope: z.array(z.string()).default([]),
  expectedChanges: z.array(z.string()).default([]),
  researchRefs: z.array(z.string()).default([]),
  implementationSteps: z.array(z.string()).default([]),
  testStrategy: z.string().default(''),
  verificationCommands: z.array(PlanVerificationCommandSchema).default([]),
  definitionOfDone: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Plan = z.infer<typeof PlanSchema>

export const RunStateSchema = z.object({
  runId: z.string(),
  objective: z.string(),
  phase: RunPhaseSchema.default('act'),
  status: RunStatusSchema.default('active'),
  intentId: z.string().nullable().default(null),
  interviewId: z.string().nullable().default(null),
  specSlug: z.string().nullable().default(null),
  planId: z.string().nullable().default(null),
  contractId: z.string().nullable().default(null),
  nextAction: z.string().nullable().default(null),
  budget: RunBudgetSchema.default(RunBudgetSchema.parse({})),
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
      /** Legacy compatibility only; semantic code changes are never line-count exempt. */
      maxLines: z.number().int().positive().default(5),
    })
    .default({ maxLines: 5 }),
  judge: z.object({
    embeddingModelKey: z.string().min(1).default('default'),
    similarityThreshold: z.number().min(0).max(1).default(0.82),
    maxEmbeddingCandidates: z.number().int().positive().default(20),
    maxEmbeddingInputChars: z.number().int().positive().default(50000),
    maxEmbeddingDimensions: z.number().int().positive().default(4096),
    maxJudgeCandidates: z.number().int().positive().default(3),
    maxJudgeInputCharsPerCandidate: z.number().int().positive().default(16000),
    maxJudgeInputChars: z.number().int().positive().default(40000),
  }).default({
    embeddingModelKey: 'default',
    similarityThreshold: 0.82,
    maxEmbeddingCandidates: 20,
    maxEmbeddingInputChars: 50000,
    maxEmbeddingDimensions: 4096,
    maxJudgeCandidates: 3,
    maxJudgeInputCharsPerCandidate: 16000,
    maxJudgeInputChars: 40000,
  }),
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({ version: 1 })
