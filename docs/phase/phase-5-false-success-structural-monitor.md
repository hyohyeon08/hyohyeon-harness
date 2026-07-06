# Phase 5: False success structural monitor

## Status

- status: `passing`
- completed_at: `2026-07-06T15:22:06.6589100+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-05-02 False success structural monitor`. It adds deterministic runtime support for turning a completion attempt with missing required evidence into a `false_success` detection candidate.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-05-02` | False success structural monitor | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/stop-gate.ts` now exports `missingRequiredEvidenceTypes(run)`.
- `src/runtime/detections.ts` persists DetectionRecord JSON files and loads sorted detection records.
- `src/runtime/monitor.ts` adds `detectFalseSuccessOnCompletionAttempt(root, intent, run)`.
- The monitor writes a `false_success` candidate only when the run belongs to the intent and at least one required evidence type is missing.
- The detection includes `missingEvidenceTypes`, `runId`, `intentId`, and evidence refs for the run and intent.
- `tests/monitor.test.mjs` covers missing evidence calculation, detection persistence, and non-detection cases.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:22:06.6589100+09:00` |
| `npm.cmd test` | 0 | terminal output, 176 tests passed | `2026-07-06T15:22:06.6589100+09:00` |

## Changed Files

- `src/runtime/stop-gate.ts`: exports missing required evidence calculation.
- `src/runtime/detections.ts`: adds detection create/load persistence runtime.
- `src/runtime/monitor.ts`: adds false_success structural monitor.
- `tests/monitor.test.mjs`: adds monitor and persistence coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-05-02` passing and moves the next entry point to `FG-05-03`.
- `docs/phase/phase-5-false-success-structural-monitor.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- The monitor is deterministic and makes no LLM/Judge calls.
- The runtime is not automatically wired into `intent complete` in this phase; it accepts completion-attempt context explicitly.
- Missing evidence is distinct from failed evidence; this phase only creates candidates for missing required evidence.
- Duplicate detection suppression is deferred.

## Known Risks

- Repeated calls can create repeated false_success candidates.
- CLI/list/resolve flows are not implemented yet.
- Complete-command integration is still a later wiring decision.

## Next Phase Entry Point

- next_feature: `FG-05-03 Repeated command failure monitor`
- reason: Detection persistence now exists, so repeated failed command spans can become thrashing candidates.

## Correction

None.
