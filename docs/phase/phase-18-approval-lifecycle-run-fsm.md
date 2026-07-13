# Phase 18: Approval Lifecycle and Run FSM

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Plan/Contract의 사람 승인 의미를 state와 runtime 불변식으로 보존하고, Run terminal 상태를 completion gate에만 맡긴다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-18-01` | Plan/Contract approval integrity | `passing` | `npm run typecheck`; `npm test` |
| `FG-18-02` | Run phase FSM and completion terminal | `passing` | `npm run typecheck`; `npm test` |

## Actual Work Performed

- Plan과 Sprint Contract에 `approvedBy`, `approvedAt` schema 필드를 추가했다.
- `intent plan approve`를 human-only CLI로 추가했다.
- 승인되거나 archived된 Plan/Contract의 runtime 수정을 거부한다.
- Draft Contract가 pre-write scope와 completion evidence policy를 바꾸지 않게 했다.
- 승인된 Contract는 `forbiddenScope` 우선, 그 다음 `allowedScope` 포함 여부를 강제한다.
- Run phase를 순방향 FSM과 `verify -> act` 재작업 루프로 제한했다.
- `run phase done`을 거부하고 successful complete만 Run을 `passing/done`으로 만든다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 268 tests passed | `2026-07-10` |

## Changed Files

- `src/runtime/schemas.ts`: Plan/Contract approval metadata.
- `src/runtime/plans.ts`: 사람 승인과 approved/archived 불변성.
- `src/runtime/contracts.ts`: 사람 승인, approved-only enforcement, allowed/forbidden scope.
- `src/runtime/stop-gate.ts`, `src/runtime/completion.ts`: draft Contract fallback.
- `src/runtime/runs.ts`: phase FSM과 terminal completion transition.
- `src/cli/index.ts`: Plan approve와 completion terminal 연결.
- `hooks/pre-write-guard.ts`: approved Contract scope 판정.
- `tests/*.test.mjs`: approval, immutability, draft isolation, scope, phase/terminal 회귀 테스트.

## Decisions

- Draft artifact는 제안이며 실행 권한이 아니다.
- 승인된 artifact를 제자리에서 수정하지 않는다. 변경 시 새 draft/revision이 필요하다.
- Forbidden scope가 allowed scope보다 우선한다.
- `passing/done`은 self-reported status가 아니라 completion evaluator의 결과다.
- AI 환경 marker 기반 human-only 판정은 협력적 실행 경계이며 OS 수준 보안 경계로 간주하지 않는다.

## Known Risks

- Contract 승인 시 linked Plan의 승인 상태를 아직 요구하지 않는다.
- Contract revision/archive CLI와 lineage가 없다.
- Run status-set 전이는 phase FSM만큼 엄격하지 않다.
- 동일 OS 사용자 권한 안에서 agent와 human을 암호학적으로 구분하지는 못한다.

## Next Phase Entry Point

- Structured InterviewSummary artifact를 추가하고 User Goal -> Interview -> Spec -> Plan -> Run lineage를 연결한다.
