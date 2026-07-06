# Phase 5: Repeated error signature monitor

## Status

- status: `passing`
- completed_at: `2026-07-06T15:28:25.5193045+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-05-04 Repeated error signature monitor`. It detects thrashing candidates when the same failure signature repeats across failed verification spans, even if the commands differ.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-05-04` | Repeated error signature monitor | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/monitor.ts` now includes `detectRepeatedErrorSignatures(root, runId, threshold)`.
- The monitor groups `run_check` spans with `status: error` by non-empty `errorSignature`.
- The default threshold is 3 failures.
- When a group reaches threshold, it writes a `thrashing` DetectionRecord with errorSignature, count, spanIds, and observed commands.
- `tests/monitor.test.mjs` covers repeated signature detection across different commands and ignored blank/below-threshold signatures.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:28:25.5193045+09:00` |
| `npm.cmd test` | 0 | terminal output, 180 tests passed | `2026-07-06T15:28:25.5193045+09:00` |

## Changed Files

- `src/runtime/monitor.ts`: adds signature grouping and thrashing detection.
- `tests/monitor.test.mjs`: adds repeated error signature monitor tests.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-05-04` passing and moves the next entry point to `FG-05-05`.
- `docs/phase/phase-5-repeated-error-signature-monitor.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Blank signatures are excluded from detection.
- Signature grouping intentionally ignores command identity.
- Observed command names are retained in attributes for human review.
- Duplicate detection suppression remains deferred.

## Known Risks

- Signature normalization is still the simple Phase 4 extractor.
- Repeated signatures across different runs are not grouped in this phase.
- Detection review UX remains `FG-05-05`.

## Next Phase Entry Point

- next_feature: `FG-05-05 Detection CLI list/show/resolve`
- reason: Detection records can now be generated, so the next step is human-facing inspection and dismissal/confirmation.

## Correction

None.
