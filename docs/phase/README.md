# Phase completion records

`docs/phase/`는 phase가 끝날 때마다 실제로 무엇을 했는지 기록하는 폴더다. `docs/final-goal-phase-feature-spec.md`가 앞으로 할 일을 정의한다면, 이 폴더는 끝난 phase의 결과와 검증 증거를 보존한다.

## 기록 원칙

각 phase는 모든 필수 기능 항목이 `passing` 상태가 되었을 때만 완료 기록을 남긴다.

`passing`은 구현자의 설명이 아니라 검증 명령 성공으로만 인정한다. phase 완료 기록에도 반드시 검증 명령, exit code, 검증 시각, 관련 문서 또는 로그 위치를 남긴다.

## 파일 규칙

파일명은 다음 형식을 따른다.

```text
phase-<number>-<short-name>.md
```

예시:

```text
phase-0-roadmap-and-operating-rules.md
phase-1-runstate-mvp.md
phase-2-verification-evidence-mvp.md
```

## 필수 섹션

각 phase 완료 기록은 아래 섹션을 포함한다.

- `Status`
- `Scope`
- `Completed Feature Items`
- `Actual Work Performed`
- `Verification Evidence`
- `Changed Files`
- `Decisions`
- `Known Risks`
- `Next Phase Entry Point`

## Agent handoff rule

새 세션의 Agent는 구현을 시작하기 전에 아래 순서로 읽는다.

1. `docs/final-goal-phase-feature-spec.md`
2. 가장 최근 `docs/phase/phase-*.md`
3. 현재 작업 대상 기능 항목의 `status`, `dependencies`, `next_action`

완료된 phase 기록과 기능 명세가 충돌하면 기능 명세를 먼저 갱신하고, 해당 phase 기록의 `Correction` 섹션에 정정 이유를 남긴다.

## Loop and compaction rule

이 프로젝트를 phase loop로 진행할 때 Agent는 한 번에 하나의 feature item만 `active`로 잡는다.

컨텍스트 압축이 가까워지거나 남은 컨텍스트가 약 10%라고 판단되면, 구현을 계속하기 전에 반드시 다음을 먼저 기록한다.

- `docs/final-goal-phase-feature-spec.md`의 현재 feature item `active_work`, `attempted_commands`, `last_observation`, `next_action`
- 필요하면 `docs/phase/phase-<number>-<short-name>.md` 완료 또는 중간 handoff 기록

압축 후 재개한 Agent는 대화 기억보다 파일 상태를 우선한다. 항상 `/docs`와 `docs/phase`를 먼저 확인하고, 가장 최근 phase 기록의 `Next Phase Entry Point`와 feature spec의 `현재 추천 시작점`을 기준으로 다음 루프를 시작한다.
