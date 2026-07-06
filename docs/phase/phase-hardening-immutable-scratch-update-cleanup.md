# Hardening: Immutable scratch update cleanup

## Status

- status: `passing`
- completed_at: `2026-07-06T16:15:15.2009722+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

This closes only `FG-H-01 Immutable scratch update cleanup`. It refactors handoff scratch updates to avoid array push mutation without changing behavior.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-H-01` | Immutable scratch update cleanup | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/handoff.ts` now creates a new Scratch object in `appendScratch`.
- The previous `push` mutation was replaced with immutable array copies.
- `tests/handoff.test.mjs` adds coverage for appending dead-end, next-step, and question scratch notes.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T16:15:15.2009722+09:00` |
| `npm.cmd test` | 0 | terminal output, 200 tests passed | `2026-07-06T16:15:15.2009722+09:00` |

## Changed Files

- `src/runtime/handoff.ts`: removes array push mutation from `appendScratch`.
- `tests/handoff.test.mjs`: adds scratch append coverage.
- `docs/final-goal-phase-feature-spec.md`: marks `FG-H-01` passing and moves the next entry point to `FG-H-02`.
- `docs/phase/phase-hardening-immutable-scratch-update-cleanup.md`: records this completed hardening item.
- `README.md`: updates the passing test count.
- `AGENT.md`: updates the passing test count.

## Decisions

- No handoff output format changed.
- The scratch file path and JSON shape remain unchanged.
- This hardening item is covered by existing full-suite verification plus one focused regression test.

## Known Risks

- Other older runtime code may still have mutation patterns not covered by this item.

## Next Phase Entry Point

- next_feature: `FG-H-02 Windows command guidance`
- reason: The remaining documented work is Windows PowerShell command guidance.

## Correction

None.
