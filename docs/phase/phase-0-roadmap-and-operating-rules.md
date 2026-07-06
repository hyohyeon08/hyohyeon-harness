# Phase 0: Roadmap and operating rules

## Status

- status: `passing`
- completed_at: `2026-07-02T16:01:40.3820566+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Phase 0는 최종목표 문서를 현재 코드베이스에서 실행 가능한 phase 계획과 기능 목록으로 바꾸는 단계다. 이 phase는 제품 기능 구현이 아니라 운영 규칙과 작업 분해 방식을 고정한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-00-01` | 기능 상태 모델 문서화 | `passing` | `Get-Content -Raw -Encoding UTF8 docs\final-goal-phase-feature-spec.md` |

## Actual Work Performed

- `docs/final-goal-gap-analysis.md`를 바탕으로 최종목표와 현재 구현의 차이를 phase 단위 작업으로 재구성했다.
- 기능 항목의 상태를 `not_started`, `active`, `blocked`, `passing` 네 가지로 고정했다.
- `active -> passing` 전이는 검증 명령 성공으로만 가능하다는 규칙을 명시했다.
- 각 기능 항목이 하나의 세션 안에서 완료 가능한 범위가 되도록 쪼갰다.
- Phase 1부터 Phase 7까지의 구현 순서와 dependency map을 정의했다.
- 다음 구현 시작점을 `FG-01-01 RunState schema and paths`로 지정했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `Get-Content -Raw -Encoding UTF8 docs\final-goal-phase-feature-spec.md` | 0 | terminal output | `2026-07-02T16:01:40.3820566+09:00` |

## Changed Files

- `docs/final-goal-gap-analysis.md`: 최종목표와 현재 구현의 차이 분석을 기록했다.
- `docs/final-goal-phase-feature-spec.md`: phase 계획, 기능 목록, 상태 전이 규칙, 검증 조건을 기록했다.
- `docs/phase/README.md`: phase 완료 기록 폴더의 운영 규칙을 정의했다.
- `docs/phase/_template.md`: phase 완료 기록 템플릿을 추가했다.
- `docs/phase/phase-0-roadmap-and-operating-rules.md`: Phase 0 완료 내용을 기록했다.

## Decisions

- `Intent`는 변경 허가와 scope를 관리하고, 이후 추가될 `RunState`는 실행 상태와 증거를 관리한다.
- 기능 항목은 세션 하나에서 끝낼 수 있는 크기로 유지한다.
- 기능 항목의 `passing` 상태는 검증 명령 성공 없이는 부여하지 않는다.
- Phase 완료 기록은 `docs/phase/`에 별도로 남긴다.
- 구현의 첫 시작점은 `FG-01-01 RunState schema and paths`다.

## Known Risks

- Phase 0 기록은 아직 machine-readable 상태 파일이 아니라 markdown이다.
- `docs/phase` 기록과 기능 명세가 앞으로 수동으로 어긋날 수 있다.
- 실제 `RunState`와 `Verification Evidence` 구현 전까지는 phase 상태 전이가 하네스에 의해 자동 강제되지 않는다.

## Next Phase Entry Point

- next_feature: `FG-01-01 RunState schema and paths`
- reason: RunState가 Verification Evidence, Observability Evidence, Detection Record의 공통 부모가 되기 때문이다.

## Correction

없음.
