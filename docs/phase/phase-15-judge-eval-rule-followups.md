# Phase 15: Judge, Eval, and Rule Follow-Ups

## Status

Phase 15 is passing. Judge results, eval runner output, and AGENTS.md rule candidates are now represented in the workflow.

## Completed Features

| ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-15-01` | Judge/eval/rule follow-up persistence | `passing` | `npm run typecheck`; `npm test` |

## What Changed

- `DetectionRecord.judge` stores judge status, judgement, confidence, and update time.
- `intent judge record <detectionId> <pass|fail|uncertain> "<judgement>" [--confidence N]` records judge output.
- `EvalCase.lastRun` stores deterministic eval runner results.
- `intent eval run [evalId]` runs one eval or all evals.
- `intent rule agents-candidate <ruleId>` prints a human-reviewable AGENTS.md candidate snippet.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0 with the full suite passing.

## Next

Phase 16 closes the loop with complete/stop automation, external Judge adapter support, and rule reflection tracking.
