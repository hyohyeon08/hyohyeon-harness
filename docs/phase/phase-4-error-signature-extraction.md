# Phase 4: Error signature extraction

## Status

- status: `passing`
- completed_at: `2026-07-06T15:15:04.8318239+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes `FG-04-05 Error signature extraction` and completes Phase 4. The feature adds deterministic failure signatures for verification logs and attaches them to failed command spans.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-04-05` | Error signature extraction | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/verification.ts` now exports `extractErrorSignature(log)`.
- Signature extraction prefers the last non-empty line from the `[stderr]` section.
- If stderr is empty, signature extraction falls back to a TAP `not ok <n> - <headline>` line from stdout.
- Failed `run_check` spans now include `errorSignature` when a signature can be extracted.
- `tests/verification.test.mjs` now covers stderr signatures, TAP fallback signatures, and failed span signature attributes.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:15:04.8318239+09:00` |
| `npm.cmd test` | 0 | terminal output, 169 tests passed | `2026-07-06T15:15:04.8318239+09:00` |

## Changed Files

- `src/runtime/verification.ts`: adds deterministic error signature extraction and failed span attributes.
- `tests/verification.test.mjs`: adds signature extraction and failed-span signature coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-04-05` passing and moves the next entry point to `FG-05-01`.
- `docs/phase/phase-4-error-signature-extraction.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Stderr wins because command errors usually report the most precise failure there.
- TAP fallback normalizes away the numeric test index by returning `tap:not ok - <headline>`.
- Signature extraction is deterministic and does not call LLMs, embeddings, or external services.
- The signature is stored on failed spans rather than changing the VerificationEvidence schema.

## Known Risks

- The first version intentionally keeps signatures simple and may not collapse path or line-number noise.
- Multi-failure logs use the last stderr line or first TAP not-ok headline.
- Detection thresholds and false-positive handling remain Phase 5 work.

## Next Phase Entry Point

- next_feature: `FG-05-01 DetectionRecord schema and paths`
- reason: Phase 4 now produces span and signature evidence; Phase 5 can start persisting deterministic monitor results.

## Correction

None.
