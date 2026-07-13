# Phase 14: Contract Lifecycle and Report

## Status

Phase 14 is passing. Sprint Contracts now have approval, edit, and report CLI support.

## Completed Features

| ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-14-01` | Contract lifecycle, rubric, and report CLI | `passing` | `npm run typecheck`; `npm test` |

## What Changed

- `SprintContract` now stores `rubric`, `stopConditions`, and `requiresUserDecision`.
- `intent contract approve <contractId>` marks a contract approved from a human shell.
- `intent contract edit <contractId> ...` appends scope, boundary, DoD, stop, decision, required check, and rubric data.
- `intent contract report <contractId>` compares required checks with linked run evidence.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0.

## Next

Continue with `FG-15-01 Judge/eval/rule follow-up persistence`.
