# Phase 7: Detection to eval case

## Status

- status: `passing`
- completed_at: `2026-07-06T16:10:59.6895177+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-07-04 Detection to eval case`. Detection records can now be converted into persisted draft eval cases, but no eval execution engine is included.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-07-04` | Detection to eval case | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/evals.ts` adds eval case load/find/create helpers.
- `draftEvalCaseFromDetection(root, detectionId)` converts one Detection Record into one draft EvalCase.
- false_success detections become completion-blocking regression drafts.
- thrashing detections become repeated-failure regression drafts.
- `tests/evals.test.mjs` covers false_success and thrashing conversion.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T16:10:59.6895177+09:00` |
| `npm.cmd test` | 0 | terminal output, 199 tests passed | `2026-07-06T16:10:59.6895177+09:00` |

## Changed Files

- `src/runtime/evals.ts`: adds eval persistence and detection-to-eval draft conversion.
- `tests/evals.test.mjs`: adds eval runtime and conversion coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-07-04` passing and moves the next entry point to `FG-H-01`.
- `docs/phase/phase-7-detection-to-eval-case.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Eval cases remain draft by default.
- The runtime persists eval JSON but does not run evals.
- Evidence refs preserve the source detection plus original detection refs.
- Conversion is type-specific for false_success and thrashing expected outcomes.

## Known Risks

- No CLI command exists for eval case creation or listing.
- No deduplication prevents creating multiple eval drafts from the same detection.
- The expected outcome shape may need tightening once an eval runner exists.

## Next Phase Entry Point

- next_feature: `FG-H-01 Immutable scratch update cleanup`
- reason: Phase 7 is passing; the remaining documented work is the cross-phase hardening backlog.

## Correction

None.
