# Phase 5: DetectionRecord schema and paths

## Status

- status: `passing`
- completed_at: `2026-07-06T15:18:37.7430611+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-05-01 DetectionRecord schema and paths`. It creates the structured shell that later monitors, CLI commands, wiki ingest, and eval drafts can share.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-05-01` | DetectionRecord schema and paths | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/schemas.ts` now defines `DetectionTypeSchema`, `DetectionResultSchema`, and `DetectionRecordSchema`.
- Detection type is currently limited to `thrashing` and `false_success`.
- Detection result is currently limited to `candidate`, `confirmed`, and `dismissed`, defaulting to `candidate`.
- Detection records include run/intent links, title, summary, evidence refs, flexible attributes, and optional resolution fields.
- `src/state/paths.ts` now exposes `.intent/detections` and per-detection JSON file paths.
- `tests/detection.test.mjs` covers schema enums, record defaults, evidence payloads, and paths.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:18:37.7430611+09:00` |
| `npm.cmd test` | 0 | terminal output, 173 tests passed | `2026-07-06T15:18:37.7430611+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: adds DetectionRecord contracts.
- `src/state/paths.ts`: adds detection state paths.
- `tests/detection.test.mjs`: adds DetectionRecord and path coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-05-01` passing and moves the next entry point to `FG-05-02`.
- `docs/phase/phase-5-detection-record-schema-paths.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Type/result are strict enums to keep monitor output predictable.
- `evidenceRefs` stays a string list so later phases can reference spans, logs, runs, or wiki pages without another schema migration.
- `attributes` is intentionally flexible for monitor-specific fields like missing checks, repeated command keys, or repeated signatures.
- Resolution fields are present but optional so CLI work can update them later.

## Known Risks

- There is no persistence runtime yet; this phase only defines schema and paths.
- No duplicate detection prevention exists yet.
- Human review semantics for `confirmed` and `dismissed` remain CLI work.

## Next Phase Entry Point

- next_feature: `FG-05-02 False success structural monitor`
- reason: Detection records can now persist monitor output, so the next step is generating a false_success candidate from missing required evidence.

## Correction

None.
