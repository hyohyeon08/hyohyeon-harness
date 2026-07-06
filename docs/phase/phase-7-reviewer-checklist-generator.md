# Phase 7: Reviewer checklist generator

## Status

- status: `passing`
- completed_at: `2026-07-06T16:02:01.1746868+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-07-02 Reviewer checklist generator`. The runtime now generates a deterministic read-only markdown checklist for human review.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-07-02` | Reviewer checklist generator | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/reviewer.ts` adds `buildReviewerChecklist(root, runId)`.
- The checklist summarizes the run objective, status, phase, intent, linked contract, scope, boundaries, DoD, required evidence, optional evidence, and run detections.
- Required evidence lines distinguish passed, failed, and missing evidence.
- Candidate detections stay unchecked for human attention; resolved or dismissed detections are checked.
- `tests/reviewer.test.mjs` covers passing, failed, and blocked run fixtures.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T16:02:01.1746868+09:00` |
| `npm.cmd test` | 0 | terminal output, 194 tests passed | `2026-07-06T16:02:01.1746868+09:00` |

## Changed Files

- `src/runtime/reviewer.ts`: adds deterministic reviewer checklist generation.
- `tests/reviewer.test.mjs`: adds checklist coverage for passing, failed, and blocked runs.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-07-02` passing and moves the next entry point to `FG-07-03`.
- `docs/phase/phase-7-reviewer-checklist-generator.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Reviewer output is markdown only and does not approve, resolve, or mutate state.
- Linked SprintContract required checks take precedence over RunState required evidence when present.
- Missing contracts are rendered explicitly instead of treated as an error.
- Detections are included by run id.

## Known Risks

- There is no CLI command for rendering the checklist yet.
- Checklist formatting is plain markdown and not schema-validated.
- Contract linkage relies on `run.contractId`; orphan contracts are not searched by run id.

## Next Phase Entry Point

- next_feature: `FG-07-03 Eval case schema`
- reason: Review reports are now deterministic; repeated failure patterns can next be captured as reusable eval cases.

## Correction

None.
