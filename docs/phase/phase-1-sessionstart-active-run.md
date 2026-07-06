# Phase 1: SessionStart active run context

## Status

- status: `passing`
- completed_at: `2026-07-06T14:16:32.5939870+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 1 전체 완료가 아니라 `FG-01-04 SessionStart includes active run context` 기능 항목 완료 기록이다. 범위는 SessionStart memory에 active run 요약을 포함하고, formatter와 Codex SessionStart hook fixture로 검증하는 데 제한한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-01-04` | SessionStart includes active run context | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `formatSessionContext`가 optional `activeRun`을 받아 active run id, status, phase, objective, linked intent를 출력하도록 했다.
- active run에 `nextAction`이 있으면 `next:` 줄을 출력한다.
- active run notes는 전체 history 대신 최근 3개만 출력해 progressive disclosure를 유지한다.
- `readSessionContext`가 `activeRun(root)`를 읽어 SessionStart additional context에 포함하도록 했다.
- `tests/memory.test.mjs`에 active run formatter 테스트를 추가했다.
- `tests/codex-hooks.test.mjs`에 실제 CLI로 run을 만든 뒤 SessionStart hook output에 active run context가 들어오는 smoke test를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:16:32.5939870+09:00` |
| `npm.cmd test` | 0 | terminal output, 118 tests passed | `2026-07-06T14:16:32.5939870+09:00` |

## Changed Files

- `src/runtime/memory.ts`: SessionStart memory에 active run summary를 추가했다.
- `tests/memory.test.mjs`: active run formatter 테스트를 추가했다.
- `tests/codex-hooks.test.mjs`: SessionStart hook이 active run context를 주입하는 smoke test를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-01-04` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-01-05`로 옮겼다.
- `docs/phase/phase-1-sessionstart-active-run.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- SessionStart는 전체 run history를 주입하지 않고 active run 요약만 주입한다.
- notes는 최근 3개만 주입한다. 긴 evidence/log는 이후 verification/observability phase에서 별도 artifact로 다룬다.
- `hooks/session-start.ts` 자체는 변경하지 않았다. hook은 계속 `readSessionContext(root)`만 호출하고, memory runtime이 context 조립 책임을 가진다.

## Known Risks

- `nextAction`을 직접 설정하는 CLI는 아직 없어, 현재는 notes가 다음 행동 힌트 역할을 한다.
- PreCompact handoff에는 아직 active run이 들어가지 않는다. 이 연결은 `FG-01-05` 범위다.

## Next Phase Entry Point

- next_feature: `FG-01-05 Handoff includes active run`
- reason: 새 세션에는 active run이 보이지만, 압축 직전 handoff 문서에도 active run 상태와 다음 행동이 남아야 한다.

## Correction

없음.
