# Phase 1: Run CLI

## Status

- status: `passing`
- completed_at: `2026-07-06T14:14:13.0297733+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 1 전체 완료가 아니라 `FG-01-03 Run CLI start/status/list/note` 기능 항목 완료 기록이다. 범위는 사용자가 RunState를 시작, 조회, 목록화, 메모 추가할 수 있는 `intent run` 하위 명령과 CLI fixture 테스트까지로 제한한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-01-03` | Run CLI start/status/list/note | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `intent run start <intentId> "<objective>"`를 추가해 기존 intent에 연결된 active run을 생성한다.
- `intent run status`를 추가해 active run의 id, status, phase, objective, linked intent, next action, notes를 출력한다.
- `intent run list`를 추가해 저장된 run 목록을 id 순서로 출력한다.
- `intent run note "<text>"`를 추가해 active run의 notes에 작업 중 메모를 append한다.
- `tests/run-cli.test.mjs`를 추가해 start/status/list/note 성공 경로와 active run이 없을 때 note 실패 경로를 실제 CLI process로 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:14:13.0297733+09:00` |
| `npm.cmd test` | 0 | terminal output, 116 tests passed | `2026-07-06T14:14:13.0297733+09:00` |

## Changed Files

- `src/cli/index.ts`: `intent run` dispatcher와 `start`, `status`, `list`, `note` 하위 명령을 추가했다.
- `tests/run-cli.test.mjs`: Run CLI fixture 테스트를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-01-03` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-01-04`로 옮겼다.
- `docs/phase/phase-1-run-cli.md`: 이 완료 기록을 추가했다.
- `README.md`: 명령 표와 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- `intent run start`는 존재하는 intent id를 요구한다. 현재는 approved 상태를 요구하지 않고, 실행 추적을 intent와 연결하는 데 집중한다.
- `intent run note`는 active run의 `notes`에 append한다. `nextAction` 전용 CLI는 아직 두지 않는다.
- `intent run status`는 progressive disclosure 원칙에 맞게 active run 요약과 notes만 출력하고 전체 run history는 `intent run list`로 분리한다.

## Known Risks

- `intent run start`가 새 active run을 만들 때 기존 active run을 자동 pause/close하지 않는다. 동시 active run 정책은 아직 없다.
- `nextAction`을 CLI로 직접 설정하는 명령은 없다. 필요하면 후속 feature에서 `intent run next "<text>"` 또는 `intent run note --next`를 별도 설계한다.
- SessionStart/Handoff에는 아직 active run이 주입되지 않는다. 이 연결은 `FG-01-04`, `FG-01-05` 범위다.

## Next Phase Entry Point

- next_feature: `FG-01-04 SessionStart includes active run context`
- reason: 사용자가 RunState를 만들 수 있게 되었으므로 새 세션과 압축 후 재개 시 active run context가 자동으로 드러나야 한다.

## Correction

없음.
