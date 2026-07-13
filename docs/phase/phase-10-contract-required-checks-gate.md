# Phase 10: Contract Required Checks Gate

## Summary

Phase 10 is passing. Active run contracts now drive completion evidence requirements.

## Completed Features

| Feature | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-10-01` | Contract requiredChecks completion gate | `passing` | `npm run typecheck`; `npm test` |

## Changes

- `src/runtime/stop-gate.ts` evaluates matching contract `requiredChecks` before falling back to run-level `requiredEvidenceTypes`.
- `src/runtime/intents.ts` accepts an optional contract when completing an intent.
- `src/cli/index.ts` passes the active contract to `complete` and `stop-check`.
- `tests/stop-gate.test.mjs` and `tests/verify-cli.test.mjs` cover missing, failed, passing, and fallback behavior.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0 with 223 tests passing.

## Next

Continue with `FG-11-01 Judge/reviewer/eval read-only CLI`.
