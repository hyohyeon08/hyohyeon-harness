# Phase 17: Governed Completion Integrity

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Completion과 Stop 판정이 active run 상태나 오래된 verification pass에 의해 우회되지 않도록 완료 정책의 기준을 단일화한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-17-01` | Governed completion and latest evidence | `passing` | `npm run typecheck`; `npm test` |

## Actual Work Performed

- 현재 조작 대상을 찾는 `activeRun`과 Intent 완료 근거를 찾는 `latestRunForIntent`를 분리했다.
- feature/fix Intent는 같은 Intent에 연결된 governed run이 있어야 완료할 수 있게 했다.
- blocked/paused/passing 상태의 Run도 completion context에서 유지해 두 번째 완료 시도 우회를 막았다.
- required evidence는 유형별 마지막 기록을 사용해 과거 pass 뒤의 최신 fail을 무시하지 않게 했다.
- contract report에도 같은 latest-result-wins 규칙을 적용했다.
- CLI complete/stop-check와 Stop hook이 공통 completion evaluator를 사용하게 했다.
- `run start`가 Intent type의 test matrix에서 required evidence type을 파생하게 했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 258 tests passed | `2026-07-10` |

## Changed Files

- `src/runtime/runs.ts`: Intent별 최신 governed run 조회와 required evidence 입력.
- `src/runtime/stop-gate.ts`: 최신 evidence 선택, governed completion context, 순수 판정 함수.
- `src/runtime/completion.ts`: CLI와 hook이 공유하는 completion orchestration.
- `src/runtime/contracts.ts`: contract report의 최신 evidence 판정.
- `src/cli/index.ts`: complete/stop-check 통합과 run start evidence 파생.
- `hooks/stop-continue.ts`: 공통 completion evaluator 사용.
- `tests/*.test.mjs`: 상태 독립 completion, 최신 결과 우선, 반복 완료/Stop 회귀 테스트.

## Decisions

- `active`는 조작 초점이고 완료 증거의 유효성 표지가 아니다.
- 완료 정책은 Intent에 연결된 가장 최근 Run을 사용한다.
- 같은 evidence type은 append-only로 보존하되 마지막 결과만 현재 상태를 대표한다.
- CLI와 Stop hook은 별도 판정 로직을 갖지 않고 공통 runtime evaluator를 사용한다.

## Known Risks

- evidence가 마지막 코드 revision 이후 생성됐는지를 증명하는 freshness/provenance는 아직 없다.
- approved Plan/Contract의 불변성과 Run phase 전이는 아직 충분히 강제되지 않는다.
- candidate detection이 자동으로 hard block되는 정책은 semantic monitor 단계에서 재검토해야 한다.
- state 파일의 원자적 쓰기와 손상 시 fail-closed 정책은 별도 hardening이 필요하다.

## Next Phase Entry Point

- Plan/Contract approval lifecycle을 강화하고 승인 상태와 Run phase transition을 연결한다.
