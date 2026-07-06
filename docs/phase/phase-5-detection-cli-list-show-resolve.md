# Phase 5: Detection CLI list/show/resolve

## Status

- status: `passing`
- completed_at: `2026-07-06T15:44:31.3579019+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes `FG-05-05 Detection CLI list/show/resolve` and completes Phase 5. Detection records are now inspectable and human-resolvable through the CLI.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-05-05` | Detection CLI list/show/resolve | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/detections.ts` now supports `findDetection`, `updateDetection`, and `resolveDetection`.
- `src/cli/index.ts` now exposes `intent detection list`.
- `src/cli/index.ts` now exposes `intent detection show <id>`.
- `src/cli/index.ts` now exposes `intent detection resolve <id> <confirmed|dismissed> "<resolution>"`.
- Detection resolve is human-only and refuses AI agent shells.
- `tests/detection-cli.test.mjs` covers list, show, resolve, and human-only enforcement.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:44:31.3579019+09:00` |
| `npm.cmd test` | 0 | terminal output, 184 tests passed | `2026-07-06T15:44:31.3579019+09:00` |

## Changed Files

- `src/runtime/detections.ts`: adds detection find/update/resolve runtime.
- `src/cli/index.ts`: adds detection CLI and human-only resolve handling.
- `tests/detection-cli.test.mjs`: adds detection CLI fixture tests.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-05-05` passing and moves the next entry point to `FG-06-01`.
- `docs/phase/phase-5-detection-cli-list-show-resolve.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- `resolve` requires either `confirmed` or `dismissed`; `candidate` is not accepted as a resolution target.
- A resolution note is required.
- Detection resolve is human-only, matching the project policy that final judgment belongs to the user.
- CLI output keeps summaries compact while `show` prints evidence refs and JSON attributes.

## Known Risks

- The CLI does not deduplicate detections.
- There is no `detection dismiss` alias; dismiss is expressed as `resolve <id> dismissed`.
- Bulk resolution is not implemented.

## Next Phase Entry Point

- next_feature: `FG-06-01 Detection to failure wiki page`
- reason: Detection records can now be reviewed, so the next step is converting them into long-lived wiki knowledge.

## Correction

None.
