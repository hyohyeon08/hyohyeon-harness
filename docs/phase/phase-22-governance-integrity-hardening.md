# Phase 22: Governance Integrity Hardening

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Plan/Contract 승인 사슬, verification freshness, state 손상에서 governance policy가 우회되지 않게 한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-22-01` | Approved Plan to Contract lineage gate | `passing` | `npm run typecheck`; `npm test` |
| `FG-22-02` | Post-edit evidence freshness | `passing` | `npm run typecheck`; `npm test` |
| `FG-22-03` | Governance state fail-closed and atomic temp isolation | `passing` | typecheck; test; coverage |

## Actual Work Performed

- Contract 승인에 같은 Run/Intent의 approved Plan을 요구한다.
- Interview lineage가 있으면 approved Interview와 Plan의 interviewId 일치를 검증한다.
- successful edit/apply_patch 이후 이전 pass evidence를 stale로 처리한다.
- malformed/schema-invalid Intent를 건너뛰지 않고 `IntentStateError`로 만든다.
- 손상되거나 유실된 linked Contract를 `ContractStateError`로 만든다.
- pre-write와 Stop hook이 governance state 오류에 한해 fail-closed 응답을 낸다.
- atomic JSON temp 파일을 PID+UUID별로 분리하고 잔여 temp를 정리한다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 296 tests passed | `2026-07-10` |
| `node --experimental-test-coverage --test tests/*.test.mjs` | 0 | line 88.39%, branch 70.56%, function 89.96% | `2026-07-10` |

## Decisions

- Draft Contract는 계속 completion fallback을 허용하지만 Contract 자체 승인은 approved Plan 없이는 불가능하다.
- Freshness는 우선 successful edit span의 시간 순서로 판정한다.
- 일반 hook 내부 오류는 silent-fail이지만 governance state 손상은 명시적으로 fail-closed다.
- atomic rename 전 temp 이름 충돌을 피하되 multi-record transaction은 별도 과제로 둔다.

## Known Risks

- feature/fix actual write와 `contract -> act` 전이는 아직 approved Contract를 필수로 요구하지 않는다.
- Run/Plan/Rule/Detection 등 다른 state loader 일부는 invalid record를 건너뛴다.
- timestamp freshness는 unobserved direct filesystem write나 clock anomaly를 증명하지 못한다.
- sequential ID allocation과 multi-record update는 process 간 transaction lock이 없다.

## Next Phase Entry Point

- feature/fix write와 phase 전이에 approved Contract를 요구한 뒤 broader state/transaction hardening을 진행한다.
