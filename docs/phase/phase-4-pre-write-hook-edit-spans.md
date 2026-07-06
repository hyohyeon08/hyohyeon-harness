# Phase 4: Pre-write hook edit spans

## Status

- status: `passing`
- completed_at: `2026-07-06T15:08:12.1763659+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-04-03 Pre-write hook records edit spans`. The pre-write guard now records checked edit/apply_patch behavior as observability spans. Detection, diagnosis, and rule generation remain later phases.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-04-03` | Pre-write hook records edit spans | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `hooks/pre-write-guard.ts` imports the failure-safe observability writer.
- Added `recordEditSpan(root, tool, edit, status, reason)` inside the hook adapter.
- Allowed edits now record `ok` spans after the intent/contract/rule checks pass.
- Denied edits now record `blocked` spans before returning the deny decision.
- Span attributes include `tool`, `path`, `isNewFile`, and `reason`; patch contents are not stored.
- `tests/codex-hooks.test.mjs` now verifies that a blocked Codex `apply_patch` payload creates a span file for the active run.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:08:12.1763659+09:00` |
| `npm.cmd test` | 0 | terminal output, 164 tests passed | `2026-07-06T15:08:12.1763659+09:00` |

## Changed Files

- `hooks/pre-write-guard.ts`: records pre-write edit/apply_patch spans for allowed and blocked checked edits.
- `tests/codex-hooks.test.mjs`: adds a Codex hook fixture asserting span output.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-04-03` passing and moves the next entry point to `FG-04-04`.
- `docs/phase/phase-4-pre-write-hook-edit-spans.md`: records this completed phase item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- Hook observability uses `tryAppendSpanToActiveRun` so span write failures never block the hook.
- The span kind is `apply_patch` when the tool name includes apply_patch; otherwise it is `edit`.
- Denied edits are recorded before the hook returns the block decision, preserving behavior evidence.
- Span attributes avoid raw file contents and diffs; the monitor only needs action metadata for this phase.

## Known Risks

- No active run means no span is recorded, by design.
- Multiple checked edits in one hook invocation can create multiple spans.
- Concurrent hook writes still rely on the existing atomic file write path and do not add locking.

## Next Phase Entry Point

- next_feature: `FG-04-04 Verify command records command spans`
- reason: edit/apply_patch behavior evidence is now captured, so verification commands can be linked into the same trace stream with pass/fail status and raw log pointers.

## Correction

None.
