# Phase 2: Setup run and raw directories

## Status

- status: `passing`
- completed_at: `2026-07-06T14:44:36.6771888+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`
- phase_2_status: `complete`

## Scope

이 기록은 `FG-02-05 Setup creates run and raw directories` 기능 항목 완료 기록이며, 이 항목 완료로 Phase 2의 모든 기능 항목이 `passing` 상태가 되었다. 범위는 `intent setup`이 RunState와 verification raw log 저장에 필요한 디렉터리를 만드는 데 제한한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-02-05` | Setup creates run and raw directories | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `intent setup`이 `.intent/runs`를 생성하도록 했다.
- `intent setup`이 `.intent/raw`를 생성하도록 했다.
- `intent setup`이 VerificationEvidence type별 raw result directory를 생성하도록 했다.
- setup install fixture에서 `.intent/runs`, `.intent/raw/typecheck-results`, `.intent/raw/unit_test-results`, `.intent/raw/custom-results` 존재를 확인하도록 했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:44:36.6771888+09:00` |
| `npm.cmd test` | 0 | terminal output, 137 tests passed | `2026-07-06T14:44:36.6771888+09:00` |

## Changed Files

- `src/cli/index.ts`: setup이 runs/raw verification result directories를 생성하도록 했다.
- `tests/install.test.mjs`: setup fixture에 runs/raw directory assertions를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-02-05` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-03-01`로 옮겼다.
- `docs/phase/phase-2-setup-run-raw-directories.md`: 이 완료 기록을 추가했다.

## Decisions

- setup은 Phase 2 evidence type별 `<type>-results` directory를 생성한다.
- 별도의 generic `.intent/raw/test-results` directory는 만들지 않았다. Phase 2에서 확정된 runner 경로가 `.intent/raw/<type>-results`이기 때문이다.
- test count는 기존 install fixture assertion 확장이라 137개로 유지된다.

## Known Risks

- future evidence type이 추가되면 setup 생성 목록도 schema enum을 통해 함께 확장된다.
- raw result directory cleanup/retention 정책은 아직 없다.

## Next Phase Entry Point

- next_feature: `FG-03-01 TestMatrix schema`
- reason: Phase 2가 완료되어 evidence 저장, CLI, completion gate, setup directory가 준비되었다. 다음은 작업 유형별 required/optional verification matrix를 schema로 정의하는 것이다.

## Correction

없음.
