# Phase 8: Plan Artifact and CLI

## Summary

Phase 8 is passing. Plan artifacts now have schema/path support plus runtime and CLI commands.

## Completed Features

| Feature | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-08-01` | Plan schema and paths | `passing` | `npm run typecheck`; `npm test` |
| `FG-08-02` | Plan runtime and CLI | `passing` | `npm run typecheck`; `npm test` |

## Changes

- `src/runtime/schemas.ts` adds `PlanStatusSchema`, `PlanVerificationCommandSchema`, and `PlanSchema`.
- `src/state/paths.ts` adds `.intent/plans` path helpers.
- `src/runtime/plans.ts` adds plan load/find/create/update runtime helpers.
- `src/cli/index.ts` adds `intent plan draft/show/list/link` and setup creates `.intent/plans`.
- `tests/plan.test.mjs` and `tests/plan-cli.test.mjs` cover schema, persistence, and CLI behavior.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0 with 223 tests passing.

## Next

Continue with `FG-09-01 Run phase transition CLI`.
