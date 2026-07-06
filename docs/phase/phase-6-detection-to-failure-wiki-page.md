# Phase 6: Detection to failure wiki page

## Status

- status: `passing`
- completed_at: `2026-07-06T15:47:28.1309762+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-06-01 Detection to failure wiki page`. Detection records can now be converted into problem wiki pages so monitor output survives as readable project knowledge.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-06-01` | Detection to failure wiki page | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/postmortem.ts` now composes detection wiki slugs and markdown bodies.
- `src/runtime/detections.ts` now exposes `recordDetectionWikiPage(root, detectionId)`.
- Candidate detections become open `issue` pages.
- Confirmed detections classify as resolved `failure` pages.
- Dismissed detections classify as resolved `issue` pages.
- Wiki bodies include detection id, type, result, run/intent links, evidence refs, and JSON attributes.
- `tests/postmortem.test.mjs` covers detection markdown composition.
- `tests/wiki.test.mjs` covers writing a detection-backed problem page and index update.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:47:28.1309762+09:00` |
| `npm.cmd test` | 0 | terminal output, 186 tests passed | `2026-07-06T15:47:28.1309762+09:00` |

## Changed Files

- `src/runtime/postmortem.ts`: adds detection wiki slug/body composition.
- `src/runtime/detections.ts`: adds detection-to-wiki writer.
- `tests/postmortem.test.mjs`: adds detection markdown coverage.
- `tests/wiki.test.mjs`: adds detection wiki persistence coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-06-01` passing and moves the next entry point to `FG-06-02`.
- `docs/phase/phase-6-detection-to-failure-wiki-page.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Candidate detections are open issues, because they still need review.
- Confirmed detections are resolved failures.
- Dismissed detections are resolved issues.
- Evidence refs remain literal strings in the page body so raw logs and span ids are preserved.

## Known Risks

- Re-running the conversion appends another detection section to the same page.
- No CLI command invokes this conversion yet.
- The body does not deep-link local files beyond literal path text.

## Next Phase Entry Point

- next_feature: `FG-06-02 Rule candidate links to detection`
- reason: Detection knowledge is now wiki-backed; rule drafts should preserve their source detection id.

## Correction

None.
