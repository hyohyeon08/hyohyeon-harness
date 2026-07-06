# Phase 7: Judge input bundle builder

## Status

- status: `passing`
- completed_at: `2026-07-06T15:58:10.4130036+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-07-01 Judge input bundle builder`. The runtime now builds deterministic input bundles for later reviewer or LLM judge layers without calling any LLM.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-07-01` | Judge input bundle builder | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/judge.ts` adds `buildJudgeInputBundle(root, detectionId)`.
- The bundle includes the source detection, a compact run summary, selected verification evidence summaries, related raw log paths, and related trace/span ids.
- Evidence refs can narrow the bundle to specific `VE-*` evidence and `span:<runId>:<spanId>` spans.
- Broad run refs fall back to all run evidence and spans for the linked run.
- `tests/judge.test.mjs` covers both narrow detection refs and broad run refs.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:58:10.4130036+09:00` |
| `npm.cmd test` | 0 | terminal output, 191 tests passed | `2026-07-06T15:58:10.4130036+09:00` |

## Changed Files

- `src/runtime/judge.ts`: adds deterministic judge bundle construction.
- `tests/judge.test.mjs`: adds bundle builder coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-07-01` passing and moves the next entry point to `FG-07-02`.
- `docs/phase/phase-7-judge-input-bundle-builder.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- The judge boundary remains read-only and deterministic.
- No hook or runtime path calls an LLM in this phase.
- The bundle carries summaries and references, not raw log contents.
- Specific evidence/span refs narrow the bundle; broad run refs keep all linked run evidence and spans.

## Known Risks

- There is no CLI for judge bundles yet.
- Bundle shape is TypeScript-only for now; no zod schema is persisted.
- If future detection refs use new formats, `buildJudgeInputBundle` will need explicit parsing support.

## Next Phase Entry Point

- next_feature: `FG-07-02 Reviewer checklist generator`
- reason: Judge input context is now structured; the next step is a deterministic human review checklist generated from run, contract, evidence, and detections.

## Correction

None.
