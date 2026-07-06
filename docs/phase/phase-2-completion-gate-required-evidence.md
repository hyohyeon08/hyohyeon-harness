# Phase 2: Completion gate required evidence

## Status

- status: `passing`
- completed_at: `2026-07-06T14:42:07.0634463+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 2 전체 완료가 아니라 `FG-02-04 Completion gate uses required verification evidence` 기능 항목 완료 기록이다. 범위는 active run의 `requiredEvidenceTypes`를 completion/stop gate에 연결하는 데 제한하고, Test Matrix default 세분화는 Phase 3으로 남긴다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-02-04` | Completion gate uses required verification evidence | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `canComplete(intent, run?)`가 optional run context를 받아 required evidence를 검사하도록 했다.
- required evidence type이 있는데 해당 evidence가 없으면 completion/stop gate가 block한다.
- required evidence type이 있는데 failed evidence만 있으면 completion/stop gate가 block한다.
- required evidence type마다 passed evidence가 하나 이상 있으면 gate가 통과한다.
- 기존 DoD/learning gate는 제거하지 않고 required evidence check 앞에 그대로 유지했다.
- `evaluateStopGate(intents, run?)`와 CLI `stop-check`가 active run context를 사용하도록 했다.
- CLI `complete`가 active run context를 `completeIntent`에 넘기도록 했다.
- active run이 특정 intent에 연결되어 있으면 그 intent에만 required evidence를 적용하도록 guard를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:42:07.0634463+09:00` |
| `npm.cmd test` | 0 | terminal output, 137 tests passed | `2026-07-06T14:42:07.0634463+09:00` |

## Changed Files

- `src/runtime/stop-gate.ts`: required evidence check를 completion/stop gate에 추가했다.
- `src/runtime/intents.ts`: `completeIntent`가 optional run context를 받도록 했다.
- `src/cli/index.ts`: `complete`와 `stop-check`가 active run context를 넘기도록 했다.
- `tests/stop-gate.test.mjs`: missing/failed/passed required evidence와 linked-intent guard tests를 추가했다.
- `tests/verify-cli.test.mjs`: CLI `complete`가 active run required evidence를 보는 통합 테스트를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-02-04` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-02-05`로 옮겼다.
- `docs/phase/phase-2-completion-gate-required-evidence.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- required evidence는 RunState의 `requiredEvidenceTypes`를 기준으로 한다.
- 같은 type에 failed evidence가 있어도 passed evidence가 하나 이상 있으면 해당 type은 충족된 것으로 본다.
- active run이 `intentId`를 갖고 있으면 해당 intent에만 required evidence를 적용한다.
- active run이 없거나 required evidence type이 없으면 기존 DoD/learning gate만 적용한다.

## Known Risks

- `requiredEvidenceTypes`를 설정하는 CLI는 아직 없다. 현재는 schema/runtime/fixture에서 설정 가능하다.
- Stop gate는 한 개 active run context만 본다. 여러 concurrent active run 정책은 아직 없다.
- Test Matrix default와 작업 유형별 required evidence 자동 설정은 Phase 3 범위다.

## Next Phase Entry Point

- next_feature: `FG-02-05 Setup creates run and raw directories`
- reason: Phase 2의 runtime/CLI/gate는 준비되었으므로 새 프로젝트 setup에서 runs/raw directory structure를 만들어 설치 직후 바로 사용할 수 있어야 한다.

## Correction

없음.
