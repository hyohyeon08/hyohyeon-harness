# Phase 3: Test Matrix schema

## Status

- status: `passing`
- completed_at: `2026-07-06T14:47:39.8047078+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 3 전체 완료가 아니라 `FG-03-01 TestMatrix schema` 기능 항목 완료 기록이다. 범위는 TestMatrix schema, intent type 기반 default matrix 함수, required evidence type 추출 helper에 제한한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-03-01` | TestMatrix schema | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `TestMatrixDispositionSchema`를 추가해 `required`, `optional`, `skipped`를 검증한다.
- `TestMatrixSchema`를 추가해 Phase 2의 `VerificationEvidenceType` keys별 disposition을 검증한다.
- `defaultTestMatrixForIntentType(type)`를 추가해 `feature`, `fix`, `tidy`, `chore` 기본 matrix를 제공한다.
- `requiredEvidenceTypesForMatrix(matrix)`를 추가해 Phase 2 gate에서 사용할 required evidence type 목록을 얻을 수 있게 했다.
- `tests/test-matrix.test.mjs`를 추가해 disposition, schema defaults, intent type별 default를 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:47:39.8047078+09:00` |
| `npm.cmd test` | 0 | terminal output, 142 tests passed | `2026-07-06T14:47:39.8047078+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: TestMatrix schemas and helpers를 추가했다.
- `tests/test-matrix.test.mjs`: TestMatrix tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-03-01` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-03-02`로 옮겼다.
- `docs/phase/phase-3-test-matrix-schema.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- TestMatrix key는 Phase 2의 `VerificationEvidenceType`과 맞춘다.
- `feature`와 `fix`는 `typecheck`, `unit_test`를 required로 둔다.
- `tidy`와 `chore`는 `typecheck`만 required로 둔다.
- `chore`는 product-level tests인 `unit_test`, `integration_test`, `e2e_test`를 기본 skipped로 둔다.

## Known Risks

- defaults는 아직 SprintContract나 RunState 생성 흐름에 자동 적용되지 않는다.
- 프로젝트별 custom matrix override는 아직 없다.
- `requiredEvidenceTypesForMatrix`는 disposition만 보고 required list를 만든다. command mapping은 이후 contract/CLI 흐름에서 정한다.

## Next Phase Entry Point

- next_feature: `FG-03-02 SprintContract schema and runtime`
- reason: TestMatrix default가 준비되었으므로 Run의 평가 기준, required checks, scope, DoD를 별도 contract로 저장할 수 있다.

## Correction

없음.
