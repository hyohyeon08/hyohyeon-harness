# Phase 4: Trace and span schema

## Status

- status: `passing`
- completed_at: `2026-07-06T14:59:43.9356840+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 4 전체 완료가 아니라 `FG-04-01 Trace and span schema` 기능 항목 완료 기록이다. 범위는 trace/span schema와 raw observability paths에 제한한다. Span writer runtime은 다음 항목이다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-04-01` | Trace and span schema | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `SpanKindSchema`를 추가해 `edit`, `apply_patch`, `run_command`, `run_check`, `hook`, `cli` span kind를 검증한다.
- `SpanStatusSchema`를 추가해 `ok`, `error`, `blocked` status를 검증한다.
- `TraceSchema`를 추가해 trace id, run id, root span id, span id list, timestamps를 구조화한다.
- `SpanSchema`를 추가해 trace/run linkage, parent span, kind, name, status, attributes, timestamps를 구조화한다.
- `.intent/raw/observability`, `.intent/raw/observability/traces`, `.intent/raw/observability/spans` path helper를 추가했다.
- `tests/observability.test.mjs`를 추가해 schema와 paths를 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:59:43.9356840+09:00` |
| `npm.cmd test` | 0 | terminal output, 160 tests passed | `2026-07-06T14:59:43.9356840+09:00` |

## Changed Files

- `src/runtime/schemas.ts`: Trace/Span schemas를 추가했다.
- `src/state/paths.ts`: raw observability trace/span paths를 추가했다.
- `tests/observability.test.mjs`: observability schema/path tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-04-01` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-04-02`로 옮겼다.
- `docs/phase/phase-4-trace-span-schema.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- 초기 구현은 OpenTelemetry 호환 가능성을 고려한 단순 JSON schema로 둔다.
- span attributes는 structured arbitrary metadata를 담기 위해 JSON object로 둔다.
- trace/span raw storage는 `.intent/raw/observability` 아래에 둔다.
- span writer와 hook/verify integration은 아직 구현하지 않는다.

## Known Risks

- trace/span id 생성 정책은 아직 없다.
- writer runtime이 없어 실제 span file은 아직 생성되지 않는다.
- setup은 raw observability directories를 선제 생성하지 않는다.

## Next Phase Entry Point

- next_feature: `FG-04-02 Span writer runtime`
- reason: schema와 path가 준비되었으므로 active run에 span을 append하고 list하는 runtime을 구현할 수 있다.

## Correction

없음.
