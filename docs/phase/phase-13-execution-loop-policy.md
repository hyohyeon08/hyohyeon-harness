# Phase 13: Execution Loop Policy

## Status

Phase 13 is passing. Runs now track an attempt budget and repeated monitor detections block the run with a next action.

## Completed Features

| ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-13-01` | Execution loop budget and blocked policy | `passing` | `npm run typecheck`; `npm test` |

## What Changed

- `RunState.budget` defaults to `maxAttempts: 3` and `attemptsUsed: 0`.
- `intent run budget <maxAttempts> [runId]` sets the attempt budget.
- `intent run attempt ["note"] [runId]` records attempts and blocks when exhausted.
- `intent monitor active|run <runId>` blocks a run when it emits detections and records `nextAction`.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0.

## Next

Continue with `FG-14-01 Contract lifecycle, rubric, and report CLI`.
