# Phase 1: Handoff active run context

## Status

- status: `passing`
- completed_at: `2026-07-06T14:22:16.3889021+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 1 전체 완료가 아니라 `FG-01-05 Handoff includes active run` 기능 항목 완료 기록이다. 범위는 PreCompact handoff가 사용하는 handoff composition에 active run 요약을 추가하고, unit test로 출력 형식을 검증하는 데 제한한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-01-05` | Handoff includes active run | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `HandoffParts`가 optional `activeRun`을 받을 수 있게 확장했다.
- `composeHandoff`가 `## Active Run` 섹션을 출력하도록 했다.
- active run이 있으면 run id, status, phase, objective, linked intent를 출력한다.
- active run에 `nextAction`이 있으면 `next:` 줄을 출력한다.
- active run notes는 최근 3개만 출력해 handoff가 전체 run history를 싣지 않도록 했다.
- `writeHandoff`가 `activeRun(root)`을 읽어 handoff에 포함하도록 했다.
- `tests/handoff.test.mjs`에 Active Run 섹션 출력 테스트를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:22:16.3889021+09:00` |
| `npm.cmd test` | 0 | terminal output, 119 tests passed | `2026-07-06T14:22:16.3889021+09:00` |

## Changed Files

- `src/runtime/handoff.ts`: handoff composition에 active run section을 추가했다.
- `tests/handoff.test.mjs`: active run handoff section 테스트를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-01-05` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-02-01`로 옮겼다.
- `docs/phase/phase-1-handoff-active-run.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- Handoff는 scratch와 별도로 `## Active Run` 섹션을 둔다.
- active run이 없을 때도 `## Active Run` 섹션에 `없음`을 표시해 재개자가 상태를 명확히 확인할 수 있게 한다.
- SessionStart와 같이 notes는 최근 3개만 출력한다. 긴 evidence/log는 Phase 2에서 별도 artifact로 연결한다.
- `hooks/pre-compact.ts` 자체는 변경하지 않았다. hook은 계속 `writeHandoff(root)`만 호출하고, handoff runtime이 context 조립 책임을 가진다.

## Known Risks

- `nextAction`을 CLI로 직접 설정하는 명령은 아직 없다. 현재는 runtime schema와 fixture를 통해 handoff 출력 경로만 검증했다.
- 완료 판단은 아직 구조화된 verification evidence가 아니라 문서화된 terminal output에 의존한다. 이 연결은 Phase 2 범위다.

## Next Phase Entry Point

- next_feature: `FG-02-01 VerificationEvidence schema and raw paths`
- reason: RunState가 CLI, SessionStart, Handoff까지 연결되었으므로 이제 검증 명령 결과와 raw log path를 RunState에 구조화해 저장해야 한다.

## Correction

없음.
