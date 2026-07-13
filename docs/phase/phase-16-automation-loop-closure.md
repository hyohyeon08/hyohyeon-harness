# Phase 16: Automation Loop Closure

## Status

- status: `passing`
- completed_at: `2026-07-09T11:53:33+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Phase 15까지 남아 있던 수동 후속 작업을 complete/stop, judge adapter, rule reflection, monitor, spec/plan link로 연결한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-16-01` | Completion/Stop monitor automation | `passing` | `npm run typecheck`; `npm test` |
| `FG-16-02` | External Judge adapter CLI | `passing` | `npm run typecheck`; `npm test` |
| `FG-16-03` | Approved rule impact report | `passing` | `npm run typecheck`; `npm test` |
| `FG-16-04` | Monitor repeated file edits | `passing` | `npm run typecheck`; `npm test` |
| `FG-16-05` | Spec/Plan automatic run linking | `passing` | `npm run typecheck`; `npm test` |
| `FG-16-06` | Rule AGENTS/CI reflection loop | `passing` | `npm run typecheck`; `npm test` |

## Actual Work Performed

- `intent complete`, `intent stop-check`, Stop hook이 required evidence gap과 monitor detection을 자동 생성하고 run을 blocked로 전환한다.
- `intent judge run <detectionId> -- <command...>`가 judge bundle을 stdin으로 넘기고 JSON 판정을 DetectionRecord에 저장한다.
- `intent rule impact`, `intent rule ci-candidate`, `intent rule reflect`가 rule enforcement와 AGENTS/CI reflection 상태를 추적한다.
- monitor가 edit/apply_patch spans에서 같은 파일 반복 수정 thrashing 후보를 탐지한다.
- `intent spec draft`, `intent spec link`, `intent plan draft`가 run/spec/plan 연결을 자동 보존한다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-09T11:53:33+09:00` |
| `npm test` | 0 | terminal output, 249 tests passed | `2026-07-09T11:53:33+09:00` |

## Changed Files

- `src/runtime/monitor.ts`: completion attempt aggregation, repeated file edit detection, run blocking helper.
- `src/runtime/judge-adapter.ts`: external judge command adapter.
- `src/runtime/rules.ts`: rule impact, CI candidate, reflection persistence.
- `src/runtime/schemas.ts`: rule reflection schema.
- `src/runtime/spec.ts`: spec existence helper for CLI link flow.
- `src/cli/index.ts`: complete/stop/monitor/judge/rule/spec/plan command integration.
- `hooks/stop-continue.ts`: Stop hook monitor/detection integration.
- `tests/*.test.mjs`: CLI, hook, monitor, judge, rule, spec, and plan coverage.

## Decisions

- Hooks remain deterministic. External judge execution is CLI-only and outside hooks.
- AGENTS/CI reflection is tracked as candidate/applied metadata; automatic file patching is left as an explicit future feature.
- Plan/spec auto-linking uses the active run when available and stays non-blocking when no active run exists.

## Known Risks

- General shell command tracing is still absent outside `intent verify`.
- Semantic thrashing detection is still structural and does not group similar failures by meaning.
- Plan has no human approval lifecycle yet.
- Interview output is not a first-class schema-validated artifact yet.

## Next Phase Entry Point

- Start with `InterviewSummarySchema` and `intent interview` CLI, or Plan approval lifecycle. Both directly strengthen the User Goal -> Plan -> Run part of the final-goal workflow.
