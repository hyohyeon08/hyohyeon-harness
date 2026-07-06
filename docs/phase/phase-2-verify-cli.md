# Phase 2: Verify CLI

## Status

- status: `passing`
- completed_at: `2026-07-06T14:37:58.2850183+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 2 전체 완료가 아니라 `FG-02-03 Verify CLI` 기능 항목 완료 기록이다. 범위는 active run 기준으로 verification runtime을 호출하는 CLI와 evidence list 출력에 제한한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-02-03` | Verify CLI | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `intent verify <type> -- <command...>` CLI를 추가했다.
- `--` 뒤 command와 args가 그대로 `runVerification`에 전달되도록 했다.
- active run이 없으면 명확히 `no active run` 오류를 출력한다.
- 검증 command가 실패하면 evidence를 기록한 뒤 해당 command exit code를 CLI exit code로 반환하도록 정책을 고정했다.
- `intent verify list`가 active run의 evidence id, status, type, exit code, command, log path를 출력하도록 했다.
- `tests/verify-cli.test.mjs`를 추가해 성공, 실패, list, no active run, missing `--` 케이스를 실제 CLI process로 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:37:58.2850183+09:00` |
| `npm.cmd test` | 0 | terminal output, 132 tests passed | `2026-07-06T14:37:58.2850183+09:00` |

## Changed Files

- `src/cli/index.ts`: `verify` command dispatcher와 `verify list`를 추가했다.
- `tests/verify-cli.test.mjs`: Verify CLI process tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-02-03` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-02-04`로 옮겼다.
- `docs/phase/phase-2-verify-cli.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- `intent verify`는 active run만 대상으로 한다.
- 검증 대상 command 실패는 CLI 실패로 전파한다. 다만 failure evidence는 먼저 저장된다.
- `intent verify list`는 active run evidence만 출력한다. 전체 run history 조회는 아직 `intent run list`와 future reporting 영역으로 남긴다.

## Known Risks

- active run이 `passing` 또는 `paused`로 전환된 뒤에는 `verify list`로 evidence를 볼 수 없다.
- command display는 shell escaping 없이 command와 args를 공백으로 join한다. 저장된 구조 데이터는 `command`와 `args`로 보존된다.
- 완료 gate는 아직 required evidence를 검사하지 않는다. 이 연결은 `FG-02-04` 범위다.

## Next Phase Entry Point

- next_feature: `FG-02-04 Completion gate uses required verification evidence`
- reason: evidence를 남기는 CLI가 생겼으므로 완료 판정에서 필수 evidence 존재와 성공 여부를 검사해야 한다.

## Correction

없음.
