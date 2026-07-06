# Phase 4: Verify command spans

## Status

- status: `passing`
- completed_at: `2026-07-06T15:12:03.9182305+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-04-04 Verify command records command spans`. Verification commands now produce traceable behavior evidence linked to the same run as their structured VerificationEvidence.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-04-04` | Verify command records command spans | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/observability.ts` now exposes `appendSpanToRun` and `tryAppendSpanToRun` for explicit run-linked spans.
- `appendSpanToActiveRun` now delegates to `appendSpanToRun`, preserving the existing hook API.
- `src/runtime/verification.ts` records a `run_check` span after command evidence is written.
- Passed verification commands produce `ok` spans; failed verification commands produce `error` spans.
- Verification span attributes include `type`, `evidenceId`, `evidenceStatus`, `command`, `args`, `cwd`, `exitCode`, and `logPath`.
- `tests/verification.test.mjs` now covers passed and failed command spans.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:12:03.9182305+09:00` |
| `npm.cmd test` | 0 | terminal output, 166 tests passed | `2026-07-06T15:12:03.9182305+09:00` |

## Changed Files

- `src/runtime/observability.ts`: adds explicit run span append helpers.
- `src/runtime/verification.ts`: writes `run_check` spans for verification commands.
- `tests/verification.test.mjs`: verifies ok/error span creation for passed and failed checks.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-04-04` passing and moves the next entry point to `FG-04-05`.
- `docs/phase/phase-4-verify-command-spans.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Verification uses `run_check` rather than generic `run_command` because this path represents intentional evidence collection.
- Span writes remain failure-safe through `tryAppendSpanToRun`.
- Span timing reuses the verification command `startedAt` and `finishedAt` values.
- The span points to raw output through `logPath`; it does not duplicate stdout/stderr content.

## Known Risks

- Explicit run span writes validate that the run exists, but they do not change run status.
- Concurrent span writes still rely on the existing trace file sequence and do not add locking.
- Error signature extraction is not implemented here; that remains `FG-04-05`.

## Next Phase Entry Point

- next_feature: `FG-04-05 Error signature extraction`
- reason: failed verification spans now point at raw logs, so the next step can derive stable failure signatures from those logs.

## Correction

None.
