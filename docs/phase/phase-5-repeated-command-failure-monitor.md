# Phase 5: Repeated command failure monitor

## Status

- status: `passing`
- completed_at: `2026-07-06T15:25:14.3354892+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-05-03 Repeated command failure monitor`. It detects thrashing candidates when the same verification command fails repeatedly with the same exit code.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-05-03` | Repeated command failure monitor | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/monitor.ts` now includes `detectRepeatedCommandFailures(root, runId, threshold)`.
- The monitor reads run spans through `listSpans`.
- It groups `run_check` spans with `status: error` by `command`, `args`, and `exitCode`.
- The default threshold is 3 failures.
- When a group reaches threshold, it writes a `thrashing` DetectionRecord with command, args, exitCode, count, and spanIds.
- `tests/monitor.test.mjs` covers the positive threshold case and below-threshold/different-exit-code ignored cases.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:25:14.3354892+09:00` |
| `npm.cmd test` | 0 | terminal output, 178 tests passed | `2026-07-06T15:25:14.3354892+09:00` |

## Changed Files

- `src/runtime/monitor.ts`: adds command failure grouping and thrashing detection.
- `tests/monitor.test.mjs`: adds repeated command failure monitor tests.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-05-03` passing and moves the next entry point to `FG-05-04`.
- `docs/phase/phase-5-repeated-command-failure-monitor.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- The grouping key is `command + args + exitCode`.
- Only `run_check` spans with `status: error` participate.
- The threshold is a default parameter set to 3 for now.
- The monitor can create duplicate detections on repeated invocation; deduplication is deferred.

## Known Risks

- Command string normalization is intentionally minimal.
- Repeated failures across different run ids are not grouped in this phase.
- Error-signature grouping remains `FG-05-04`.

## Next Phase Entry Point

- next_feature: `FG-05-04 Repeated error signature monitor`
- reason: command-level thrashing is covered; signature-level thrashing can now catch the same failure across different commands.

## Correction

None.
