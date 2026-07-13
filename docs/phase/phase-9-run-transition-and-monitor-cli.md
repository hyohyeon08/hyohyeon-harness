# Phase 9: Run Transition and Monitor CLI

## Summary

Phase 9 is passing. Runs can now record explicit phase/status/next-action transitions, and monitor detection runtime is exposed through CLI commands.

## Completed Features

| Feature | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-09-01` | Run phase transition CLI | `passing` | `npm run typecheck`; `npm test` |
| `FG-09-02` | Monitor CLI | `passing` | `npm run typecheck`; `npm test` |

## Changes

- `src/cli/index.ts` adds `intent run phase`, `intent run status-set`, and `intent run next`.
- `src/cli/index.ts` adds `intent monitor active` and `intent monitor run <runId>`.
- `src/runtime/monitor.ts` now avoids duplicate detections for the same repeated failure group.
- `tests/run-cli.test.mjs` and `tests/monitor-cli.test.mjs` cover the new command surfaces.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0 with 223 tests passing.

## Next

Continue with `FG-10-01 Contract requiredChecks completion gate`.
