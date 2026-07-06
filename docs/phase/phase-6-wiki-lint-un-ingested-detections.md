# Phase 6: Wiki lint un-ingested detections

## Status

- status: `passing`
- completed_at: `2026-07-06T15:53:14.1745030+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-06-03 Wiki lint reports un-ingested detections`. Wiki lint now reports detection records that have not yet been turned into wiki problem pages.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-06-03` | Wiki lint reports un-ingested detections | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/detections.ts` adds `unIngestedDetections(root)` to compare detection records with existing detection wiki pages.
- `src/cli/index.ts` includes un-ingested detection ids in `intent wiki lint` output.
- `tests/wiki.test.mjs` covers the candidate-to-un-ingested path and confirms the list clears after `recordDetectionWikiPage`.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:53:14.1745030+09:00` |
| `npm.cmd test` | 0 | terminal output, 189 tests passed | `2026-07-06T15:53:14.1745030+09:00` |

## Changed Files

- `src/runtime/detections.ts`: adds un-ingested detection lookup.
- `src/cli/index.ts`: prints un-ingested detection ids in wiki lint output.
- `tests/wiki.test.mjs`: adds coverage for detection ingestion state.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-06-03` passing and moves the next entry point to `FG-07-01`.
- `docs/phase/phase-6-wiki-lint-un-ingested-detections.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- `lintWiki(articles)` stays pure; filesystem-aware detection ingestion is handled by `unIngestedDetections`.
- A detection is considered ingested when its deterministic detection wiki slug exists in the problem wiki articles.
- CLI output reports ids only, keeping `intent wiki lint` compact and script-friendly.

## Known Risks

- `intent wiki lint` reports un-ingested detections but does not auto-create wiki pages.
- The lookup relies on the detection wiki slug convention staying stable.

## Next Phase Entry Point

- next_feature: `FG-07-01 Judge input bundle builder`
- reason: Phase 6 is passing; detections now connect to wiki ingestion and rule sources, so the next layer can build deterministic review bundles.

## Correction

None.
