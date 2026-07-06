# Phase 3: Forbidden scope gate

## Status

- status: `passing`
- completed_at: `2026-07-06T14:56:21.2139911+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`
- phase_3_status: `complete`

## Scope

이 기록은 `FG-03-04 Forbidden scope gate` 기능 항목 완료 기록이며, 이 항목 완료로 Phase 3의 모든 기능 항목이 `passing` 상태가 되었다. 범위는 active run에 연결된 SprintContract의 `forbiddenScope` path 차단에 제한한다. architecture boundary lint는 별도 기능으로 남긴다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-03-04` | Forbidden scope gate | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `activeContract(root)`를 추가해 active run의 `contractId`로 contract를 조회한다.
- `checkContractForbiddenScope(path, contract)`를 추가해 forbidden scope hit 여부와 contract-specific reason을 반환한다.
- pre-write guard가 rule gate 다음, intent gate 전에 contract forbidden scope를 검사하도록 했다.
- forbiddenScope와 allowedScope가 동시에 매칭되면 forbiddenScope가 이기도록 순수 함수 테스트를 추가했다.
- Codex apply_patch hook fixture에서 active contract forbiddenScope가 실제로 write를 block하는지 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:56:21.2139911+09:00` |
| `npm.cmd test` | 0 | terminal output, 154 tests passed | `2026-07-06T14:56:21.2139911+09:00` |

## Changed Files

- `src/runtime/contracts.ts`: active contract lookup and forbidden scope checker를 추가했다.
- `hooks/pre-write-guard.ts`: contract forbidden scope gate를 연결했다.
- `tests/contracts.test.mjs`: forbiddenScope pure tests를 추가했다.
- `tests/codex-hooks.test.mjs`: Codex apply_patch가 contract forbiddenScope로 block되는 hook test를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-03-04` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-04-01`로 옮겼다.
- `docs/phase/phase-3-forbidden-scope-gate.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- pre-write guard는 active run에 연결된 contract를 적용한다.
- contract status가 아직 draft여도 active run에 연결된 실행 계약이면 forbiddenScope를 적용한다.
- rule gate를 먼저 검사하고, contract gate를 그 다음, intent gate를 그 다음에 검사한다.
- forbiddenScope는 allowedScope보다 우선한다.
- denial reason에는 `[contract gate]`와 contract id, `forbiddenScope` source를 포함한다.

## Known Risks

- contract approve flow가 아직 없어서 draft contract도 active run에 연결되면 강제된다.
- architecture boundary lint는 아직 없다.
- setup은 `.intent/contracts` directory를 선제 생성하지 않는다. runtime write가 필요 시 생성한다.

## Next Phase Entry Point

- next_feature: `FG-04-01 Trace and span schema`
- reason: Phase 3이 완료되어 Run의 계약과 forbidden scope gate가 준비되었다. 다음은 Agent 행동 증거를 trace/span으로 구조화하는 Observability MVP를 시작한다.

## Correction

없음.
