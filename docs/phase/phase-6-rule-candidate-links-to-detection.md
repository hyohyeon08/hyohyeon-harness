# Phase 6: Rule candidate links to detection

## Status

- status: `passing`
- completed_at: `2026-07-06T15:49:56.2246510+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-06-02 Rule candidate links to detection`. Rule drafts can now retain the detection id that caused them to be proposed.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-06-02` | Rule candidate links to detection | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/schemas.ts` adds optional `sourceDetectionId` to `RuleSchema`.
- Existing rule JSON remains compatible because `sourceDetectionId` defaults to `null`.
- `src/runtime/rules.ts` lets `draftRule` accept `sourceDetectionId`.
- `src/runtime/postmortem.ts` forwards `sourceDetectionId` to drafted rules.
- `tests/rules.test.mjs` covers old JSON compatibility and source-linked rule drafts.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:49:56.2246510+09:00` |
| `npm.cmd test` | 0 | terminal output, 188 tests passed | `2026-07-06T15:49:56.2246510+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: adds `sourceDetectionId` to RuleSchema.
- `src/runtime/rules.ts`: extends rule drafting options.
- `src/runtime/postmortem.ts`: forwards detection source ids to rule drafts.
- `tests/rules.test.mjs`: adds sourceDetectionId compatibility and persistence tests.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-06-02` passing and moves the next entry point to `FG-06-03`.
- `docs/phase/phase-6-rule-candidate-links-to-detection.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- The new field is nullable and defaults to null for compatibility.
- `draftRule` accepts source detection metadata through an options object.
- The rule gate behavior does not depend on sourceDetectionId.

## Known Risks

- No CLI displays sourceDetectionId on rules yet.
- No reverse lookup from detection to rule draft exists yet.

## Next Phase Entry Point

- next_feature: `FG-06-03 Wiki lint reports un-ingested detections`
- reason: Detections can now become wiki pages and source-linked rule drafts; lint should report detections that have not been ingested into wiki.

## Correction

None.
