# Phase 7: Eval case schema

## Status

- status: `passing`
- completed_at: `2026-07-06T16:06:39.2921147+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-07-03 Eval case schema`. The repository now has an eval case data contract and `.intent/evals/*.json` path helpers, but no eval persistence runtime yet.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-07-03` | Eval case schema | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/schemas.ts` adds `EvalCaseStatusSchema` and `EvalCaseSchema`.
- Eval cases store status, source detection id, trigger type, title, summary, input, expected outcome, evidence refs, tags, and timestamps.
- `src/state/paths.ts` adds `.intent/evals` and eval case file helpers.
- `tests/evals.test.mjs` adds false_success fixture and path coverage.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T16:06:39.2921147+09:00` |
| `npm.cmd test` | 0 | terminal output, 197 tests passed | `2026-07-06T16:06:39.2921147+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: adds eval case schema and status enum.
- `src/state/paths.ts`: adds eval path helpers.
- `tests/evals.test.mjs`: adds eval schema/path coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-07-03` passing and moves the next entry point to `FG-07-04`.
- `docs/phase/phase-7-eval-case-schema.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Eval cases start as `draft`.
- `trigger` reuses the existing detection type enum.
- `input` and `expected` are intentionally flexible records because no eval runner exists yet.
- Persistence/runtime behavior is deferred to `FG-07-04`.

## Known Risks

- No runtime loads or writes eval cases yet.
- No CLI displays eval cases yet.
- Flexible input/expected records may need tightening after the first runner exists.

## Next Phase Entry Point

- next_feature: `FG-07-04 Detection to eval case`
- reason: The eval contract and path now exist; the next step is converting a detection into a persisted eval draft.

## Correction

None.
