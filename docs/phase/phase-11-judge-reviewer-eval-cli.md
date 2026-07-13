# Phase 11: Judge, Reviewer, and Eval CLI

## Status

Phase 11 is passing. The Phase 7 runtime helpers are now exposed through deterministic CLI commands.

## Completed Features

| ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-11-01` | Judge/reviewer/eval read-only CLI | `passing` | `npm run typecheck`; `npm test` |

## What Changed

- `intent judge bundle <detectionId>` prints the deterministic judge input bundle.
- `intent reviewer checklist [runId]` prints a markdown checklist for the active or explicit run.
- `intent eval draft-from-detection <detectionId>` persists a draft eval case from a detection.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0.

## Next

Continue with `FG-12-01 Detection ingest and rule draft CLI`.
