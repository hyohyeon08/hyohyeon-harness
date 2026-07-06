# Phase 1: RunState runtime CRUD

## Status

- status: `passing`
- completed_at: `2026-07-06T14:09:29.0988831+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 1 전체 완료가 아니라 `FG-01-02 RunState runtime CRUD` 기능 항목 완료 기록이다. 범위는 RunState 파일 IO wrapper, atomic write 기반 생성/조회/갱신 API, active run 조회, latest-runs index, 그리고 해당 단위 테스트 검증까지로 제한한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-01-02` | RunState runtime CRUD | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/runs.ts`를 추가해 `createRun`, `loadRuns`, `findRun`, `updateRun`, `activeRun`, `loadRunIndex`를 구현했다.
- `RUN-001` 형식의 순차 run id를 생성하고, 각 run을 `.intent/runs/<id>.json`에 저장하도록 했다.
- `latest-runs.json`은 `activeRunId`와 최근 run id 목록만 담는 작은 index로 사용한다.
- `updateRun`은 기존 run을 schema로 검증한 뒤 immutable transform 결과와 새 `updatedAt`을 atomic write로 저장한다.
- `activeRun`은 index의 active run이 유효하면 그것을 반환하고, 그렇지 않으면 가장 최신 active run으로 fallback한다.
- `tests/runs.test.mjs`를 추가해 생성, 목록, 조회, 갱신, active fallback, active 해제 동작을 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:09:29.0988831+09:00` |
| `npm.cmd test` | 0 | terminal output, 111 tests passed | `2026-07-06T14:09:29.0988831+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: `RunIndexSchema`와 `RunIndex` 타입을 추가했다.
- `src/runtime/runs.ts`: RunState CRUD runtime을 추가했다.
- `tests/runs.test.mjs`: RunState runtime CRUD 테스트를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-01-02` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-01-03`으로 옮겼다.
- `docs/phase/README.md`: context compaction 전 phase 기록 규칙과 압축 후 재개 순서를 명시했다.
- `docs/phase/phase-1-runstate-runtime-crud.md`: 이 완료 기록을 추가했다.

## Decisions

- `latest-runs.json`은 전체 run 복제본이 아니라 active pointer와 최근 run id 목록만 저장한다.
- `RunState`는 여전히 실행 상태와 다음 행동만 책임진다. 검증 증거, 관측 span, detection은 이후 phase에서 별도 schema로 붙인다.
- active run이 `passing`, `blocked`, `paused` 등으로 active 상태를 떠나면 `activeRunId`를 비운다.
- 컨텍스트 압축 전에는 feature spec의 `active_work`와 phase 기록을 먼저 갱신한다.

## Known Risks

- `intent setup`은 아직 `.intent/runs` 디렉터리를 미리 만들지 않는다. 현재 runtime은 첫 write 때 디렉터리를 만든다.
- `intent run` CLI는 아직 없다. 사용자가 run을 직접 조작하려면 `FG-01-03`이 필요하다.
- 여러 active run이 공존할 경우 `activeRun`은 최신 run id를 fallback으로 선택한다. 동시 실행 정책은 아직 없다.

## Next Phase Entry Point

- next_feature: `FG-01-03 Run CLI start/status/list/note`
- reason: runtime CRUD가 생겼으므로 사용자가 RunState를 시작, 조회, 기록할 CLI surface가 필요하다.

## Correction

없음.
