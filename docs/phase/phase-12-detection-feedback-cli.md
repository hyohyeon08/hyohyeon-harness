# Phase 12: Detection Feedback CLI

## Status

Phase 12 is passing. Detections can now be ingested into the wiki and converted into draft rule candidates from the CLI.

## Completed Features

| ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-12-01` | Detection ingest and rule draft CLI | `passing` | `npm run typecheck`; `npm test` |

## What Changed

- `intent wiki ingest detection <detectionId>` writes or updates a problem wiki page.
- `intent rule draft-from-detection <detectionId> <forbid-path|forbid-pattern> <pattern> ["reason"]` drafts a linked rule.
- Rule approval remains human-only.

## Verification

- `npm run typecheck` exited 0.
- `npm test` exited 0.

## Next

Continue with `FG-13-01 Execution loop budget and blocked policy`.
