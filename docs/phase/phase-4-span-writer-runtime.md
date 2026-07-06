# Phase 4: Span writer runtime

## Status

- status: `passing`
- completed_at: `2026-07-06T15:03:03.0539434+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 4 전체 완료가 아니라 `FG-04-02 Span writer runtime` 기능 항목 완료 기록이다. 범위는 active run에 span을 append하고 list하는 runtime에 제한한다. Hooks와 verify command integration은 다음 항목들이다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-04-02` | Span writer runtime | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `src/runtime/observability.ts`를 추가했다.
- `appendSpanToActiveRun(root, args)`가 active run을 조회하고 trace/span JSON file을 쓰도록 했다.
- span append 시 trace의 `rootSpanId`와 `spanIds`를 갱신하도록 했다.
- `listSpans(root, runId?)`가 raw span files를 읽어 run별 span 목록을 반환하도록 했다.
- hook integration에서 쓸 수 있도록 실패해도 throw하지 않는 `tryAppendSpanToActiveRun`을 추가했다.
- `tests/observability.test.mjs`에 append/list/failure-safe tests를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T15:03:03.0539434+09:00` |
| `npm.cmd test` | 0 | terminal output, 163 tests passed | `2026-07-06T15:03:03.0539434+09:00` |

## Changed Files

- `src/runtime/observability.ts`: span writer/list runtime을 추가했다.
- `tests/observability.test.mjs`: span writer tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-04-02` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-04-03`으로 옮겼다.
- `docs/phase/phase-4-span-writer-runtime.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- trace id는 active run id에서 `TRACE-<runId>` 형태로 파생한다.
- span id는 trace 안에서 `SPAN-001`, `SPAN-002` 순서로 증가한다.
- raw span files는 `.intent/raw/observability/spans/<traceId>-<spanId>.json`에 저장한다.
- hook에서 사용할 writer는 failure-safe wrapper를 사용한다.

## Known Risks

- concurrent writes에 대한 locking은 아직 없다.
- span id generation은 trace file의 현재 `spanIds` 길이에 의존한다.
- setup은 raw observability directory를 선제 생성하지 않는다.

## Next Phase Entry Point

- next_feature: `FG-04-03 Pre-write hook records edit spans`
- reason: span writer가 준비되었으므로 pre-write guard가 검사한 edit/apply_patch 변경을 행동 증거로 남길 수 있다.

## Correction

없음.
