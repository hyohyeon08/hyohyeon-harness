# Phase 3: SprintContract schema and runtime

## Status

- status: `passing`
- completed_at: `2026-07-06T14:50:23.0351681+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 3 전체 완료가 아니라 `FG-03-02 SprintContract schema and runtime` 기능 항목 완료 기록이다. 범위는 contract schema와 생성/조회 runtime에 제한한다. CLI는 다음 항목이다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-03-02` | SprintContract schema and runtime | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `SprintContractSchema`와 `ContractStatusSchema`를 추가했다.
- `.intent/contracts` path를 추가했다.
- `src/runtime/contracts.ts`를 추가했다.
- `createContract(root, args)`가 draft contract를 생성하고 저장하도록 했다.
- contract defaults가 연결된 Intent의 `scope`, `dod`, intent type 기반 TestMatrix를 사용하도록 했다.
- `requiredChecks`는 TestMatrix의 required evidence type에서 파생한다.
- `findContract`, `loadContracts`를 추가했다.
- `tests/contracts.test.mjs`를 추가해 schema defaults, path, default 생성, explicit override, sorted load를 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:50:23.0351681+09:00` |
| `npm.cmd test` | 0 | terminal output, 147 tests passed | `2026-07-06T14:50:23.0351681+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: SprintContract schemas를 추가했다.
- `src/runtime/contracts.ts`: contract create/find/load runtime을 추가했다.
- `src/state/paths.ts`: `.intent/contracts` path를 추가했다.
- `tests/contracts.test.mjs`: contract runtime tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-03-02` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-03-03`으로 옮겼다.
- `docs/phase/phase-3-sprint-contract-schema-runtime.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- SprintContract는 Intent를 대체하지 않는다. `intentId`와 `runId`로 연결된 평가 계약으로 둔다.
- initial contract status는 `draft`다.
- default `allowedScope`는 Intent scope에서 가져온다.
- default `definitionOfDone`은 Intent DoD에서 가져온다.
- default `requiredChecks`는 TestMatrix required disposition에서 파생한다.

## Known Risks

- contract approve flow는 아직 없다.
- run start 시 contract를 자동 생성하지 않는다.
- setup은 아직 `.intent/contracts` directory를 생성하지 않는다. contract runtime write는 atomic write helper가 parent dir을 만든다.

## Next Phase Entry Point

- next_feature: `FG-03-03 Contract CLI`
- reason: contract runtime이 준비되었으므로 사람이 `intent contract draft/show/list`로 평가 계약을 만들고 확인할 수 있어야 한다.

## Correction

없음.
