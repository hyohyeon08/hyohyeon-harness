# Phase 21: Structural Semantic Monitor and Feedback

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

구조 gate의 반복 행동 후보를 edit region과 tool sequence로 정밀화하고, candidate 판정과 regression/Wiki feedback 의미를 바로잡는다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-21-01` | Edit region and tool sequence candidates | `passing` | `npm run typecheck`; `npm test` |
| `FG-21-02` | Candidate verdict separation | `passing` | `npm run typecheck`; `npm test` |
| `FG-21-03` | Span replay eval and resolve-to-Wiki feedback | `passing` | `npm run typecheck`; `npm test` |

## Actual Work Performed

- old-text anchor를 실제 파일에서 찾아 20-line bucket `regionKey`로 span에 기록했다.
- 동일 region 반복 수정과 edit/error tool sequence 반복을 candidate로 탐지한다.
- broad same-file detection은 자동 monitor 집계에서 제외했다.
- candidate thrashing은 Run을 자동 차단하지 않고 confirmed verdict만 차단한다.
- thrashing eval draft에 evidence span snapshot과 detector identity를 저장한다.
- eval runner가 span fixture를 재생해 반복 command/error/file/region/sequence 신호를 다시 계산한다.
- `intent detection resolve`가 판정 내용을 Wiki problem page에 자동 저장한다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 289 tests passed | `2026-07-10` |

## Changed Files

- `src/runtime/edit-region.ts`: deterministic line bucket locator.
- `hooks/pre-write-guard.ts`: edit region span attributes.
- `src/runtime/monitor.ts`: region/sequence detectors and confirmed-only blocking.
- `src/runtime/completion.ts`: confirmed monitor reason only.
- `src/runtime/evals.ts`: span snapshot and detector replay.
- `src/cli/index.ts`: resolve-to-Wiki feedback.
- `tests/*.test.mjs`: region, sequence, verdict, replay, Wiki regression coverage.

## Decisions

- 같은 파일 수정 횟수만으로 자동 후보를 만들지 않는다.
- region bucket은 값싼 1차 구조 신호이며 semantic verdict가 아니다.
- candidate와 confirmed를 실행 정책에서 구분한다.
- regression eval은 저장된 verdict가 아니라 detector input/output을 검증한다.
- 사람의 resolve 판정은 즉시 Wiki에 축적한다.

## Known Risks

- add-only patch처럼 old-text anchor가 없는 edit는 region을 찾지 못할 수 있다.
- 20-line bucket 경계 근처 수정은 같은 논리 영역이 다른 key로 나뉠 수 있다.
- embedding semantic similarity와 자동 Judge 대상/비용 정책은 아직 없다.
- false_success eval은 thrashing만큼 독립적인 fixture replay가 아니다.

## Next Phase Entry Point

- Contract 승인 및 `contract -> act` phase에 approved Interview/Plan/Contract lineage를 요구한다.
