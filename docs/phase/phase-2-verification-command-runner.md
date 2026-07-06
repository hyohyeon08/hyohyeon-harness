# Phase 2: Verification command runner

## Status

- status: `passing`
- completed_at: `2026-07-06T14:35:13.7597741+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 2 전체 완료가 아니라 `FG-02-02 Verification command runner` 기능 항목 완료 기록이다. 범위는 검증 명령을 실행하고 raw log file과 RunState evidence를 연결하는 runtime에 제한한다. 사용자용 CLI는 `FG-02-03` 범위다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-02-02` | Verification command runner | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/verification.ts`를 추가했다.
- `runVerification(root, args)`가 run 존재를 먼저 확인한 뒤 검증 command를 실행하도록 했다.
- command stdout/stderr, cwd, timestamps, exit code를 `.intent/raw/<type>-results/<runId>-<timestamp>.log`에 저장하도록 했다.
- RunState에는 raw output 본문 대신 `VerificationEvidence` summary와 `logPath`를 append하도록 했다.
- `src/runtime/runs.ts`에 `appendRunEvidence` helper를 추가했다.
- `tests/verification.test.mjs`에 성공 command와 실패 command fixture를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:35:13.7597741+09:00` |
| `npm.cmd test` | 0 | terminal output, 127 tests passed | `2026-07-06T14:35:13.7597741+09:00` |

## Changed Files

- `src/runtime/verification.ts`: verification command runner를 추가했다.
- `src/runtime/runs.ts`: RunState evidence append helper를 추가했다.
- `tests/verification.test.mjs`: command runner success/failure tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-02-02` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-02-03`으로 옮겼다.
- `docs/phase/phase-2-verification-command-runner.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- runner는 `spawnSync`를 사용한다. 현재 harness test style과 CLI smoke tests가 동기 실행 위주라 가장 단순하고 안정적이다.
- stdout/stderr 원문은 RunState에 넣지 않고 raw log file에 저장한다.
- evidence `logPath`는 `.intent/raw/...` 상대 경로로 저장한다.
- command 실패도 throw하지 않고 `failed` evidence로 저장한다. run이 없는 경우만 실행 전 오류로 처리한다.
- 기본 실행 cwd는 project root이고, 로그에 실제 cwd를 남긴다.

## Known Risks

- 아직 `intent verify` CLI가 없어 사용자는 runtime을 직접 호출할 수 없다.
- long-running command, timeout, max buffer 정책은 아직 없다.
- spawned command가 signal로 종료되면 `exitCode`는 nullable로 저장되지만 signal field는 아직 별도 schema에 없다.

## Next Phase Entry Point

- next_feature: `FG-02-03 Verify CLI`
- reason: runtime은 준비되었으므로 active run을 기준으로 `intent verify <type> -- <command...>`를 실행하고 evidence 목록을 확인할 CLI가 필요하다.

## Correction

없음.
