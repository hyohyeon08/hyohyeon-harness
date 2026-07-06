# Phase 2: Verification evidence schema and paths

## Status

- status: `passing`
- completed_at: `2026-07-06T14:25:40.0096623+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 2 전체 완료가 아니라 `FG-02-01 VerificationEvidence schema and raw paths` 기능 항목 완료 기록이다. 범위는 verification evidence 계약과 raw result path helper를 추가하는 데 제한하고, 실제 command execution runtime은 다음 항목으로 남긴다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-02-01` | VerificationEvidence schema and raw paths | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `VerificationEvidenceTypeSchema`를 추가해 `typecheck`, `build`, `lint`, `unit_test`, `integration_test`, `e2e_test`, `custom` evidence type을 검증한다.
- `VerificationEvidenceStatusSchema`를 추가해 `passed`, `failed` outcome을 검증한다.
- `VerificationEvidenceSchema`를 추가해 evidence id, type, status, command, args, exit code, log path, start/end timestamp를 구조화한다.
- `RunStateSchema`에 `evidence`와 `requiredEvidenceTypes` 기본값을 추가했다.
- `paths(root)`에 `.intent/raw`와 `.intent/raw/<type>-results` helper를 추가했다.
- `tests/verification.test.mjs`를 추가해 schema parsing, RunState defaults, raw result path를 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:25:40.0096623+09:00` |
| `npm.cmd test` | 0 | terminal output, 125 tests passed | `2026-07-06T14:25:40.0096623+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: verification evidence schema와 RunState evidence fields를 추가했다.
- `src/state/paths.ts`: raw result directory helper를 추가했다.
- `tests/verification.test.mjs`: schema/path tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-02-01` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-02-02`로 옮겼다.
- `docs/phase/phase-2-verification-evidence-schema-and-paths.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- evidence는 raw stdout/stderr 본문을 직접 RunState에 넣지 않고 `logPath`로 연결한다.
- command는 `command` 문자열과 `args` 배열로 나누어 저장한다.
- process가 signal 등으로 종료될 수 있는 후속 runner를 고려해 `exitCode`는 nullable로 둔다.
- `requiredEvidenceTypes`는 Phase 2 completion gate에서 바로 사용할 수 있도록 RunState에 기본 빈 배열로 추가했다.

## Known Risks

- 아직 검증 명령을 실행하거나 log file을 쓰는 runtime은 없다.
- `.intent/raw/<type>-results` directory는 path helper만 존재하고 setup에서 생성되지는 않는다. setup 생성은 `FG-02-05` 범위다.
- `VerificationEvidenceSchema`는 timestamp format을 문자열로만 검증한다. 더 강한 timestamp 검증이 필요하면 후속 hardening에서 다룬다.

## Next Phase Entry Point

- next_feature: `FG-02-02 Verification command runner`
- reason: evidence 계약과 raw result path가 준비되었으므로 실제 명령 실행 결과를 log file과 RunState evidence에 저장하는 runtime을 구현할 수 있다.

## Correction

없음.
