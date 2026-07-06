# Hardening: Windows command guidance

## Status

- status: `passing`
- completed_at: `2026-07-06T16:20:03.8232989+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-H-02 Windows command guidance`. README, AGENT, and the roadmap now document `npm.cmd` usage for Windows PowerShell execution-policy failures.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-H-02` | Windows command guidance | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `README.md` adds a Windows PowerShell note with `npm.cmd` install/build/typecheck/test examples.
- `AGENT.md` adds setup and verification-loop guidance for `npm.cmd`.
- `docs/final-goal-phase-feature-spec.md` records the hardening item and completion evidence.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T16:20:03.8232989+09:00` |
| `npm.cmd test` | 0 | terminal output, 200 tests passed | `2026-07-06T16:20:03.8232989+09:00` |

## Changed Files

- `README.md`: documents `npm.cmd` examples for Windows PowerShell.
- `AGENT.md`: documents `npm.cmd` setup and verification equivalents.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-H-02` passing and records no remaining next action.
- `docs/phase/phase-hardening-windows-command-guidance.md`: records this completed hardening item.

## Decisions

- The docs recommend `npm.cmd` instead of asking users to change PowerShell execution policy.
- No code changes were made for this item.

## Known Risks

- Users in non-PowerShell shells may still prefer standard `npm` commands.

## Next Phase Entry Point

- next_feature: null
- reason: All documented phase and hardening items in `docs/final-goal-phase-feature-spec.md` are passing.

## Correction

None.
