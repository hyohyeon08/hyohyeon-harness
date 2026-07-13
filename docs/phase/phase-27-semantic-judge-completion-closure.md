# Phase 27: Semantic Judge and Completion Closure

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

2차 semantic/Judge 비용을 제한하고 feature/fix completion을 approved execution chain에 결박한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-27-01` | Cached embedding similarity and bounded Judge queue | `passing` | typecheck; test |
| `FG-27-02` | Behavior completion chain closure | `passing` | full CLI chain test |

## Actual Work Performed

- Candidate thrashing의 stable semantic input을 생성한다.
- 외부 embedding adapter vector를 model/input digest와 함께 Detection에 캐시한다.
- Cosine similarity threshold를 통과한 후보만 Judge queue/batch에 넣는다.
- Embedding candidate/input/vector dimension과 Judge candidate/per-input/batch-input budget을 config에 추가했다.
- 동일 Judge input digest/adapter key 결과를 재사용한다.
- Judge classification, rationale, confidence, suggested action을 구조화해 저장한다.
- Feature/fix completion에 approved matching Contract와 verify phase를 요구한다.
- 전체 승인 artifact와 fresh evidence의 end-to-end completion CLI 회귀를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 324 tests passed | `2026-07-10` |

## Decisions

- False-success missing evidence는 deterministic하므로 embedding/Judge 비용을 쓰지 않는다.
- Embedding과 Judge adapter는 hook 밖의 명시적 CLI에서만 실행한다.
- Adapter command 원문은 Detection에 저장하지 않고 SHA-256 adapter key만 저장한다.
- Feature/fix는 evidence 검사를 먼저 제공하되 최종 ready 판정에는 approved Contract/verify가 필수다.

## Known Risks

- Embedding 품질은 사용자가 선택한 command adapter/model에 의존한다.
- Single candidate는 semantic peer가 없어 자동 Judge queue에 들어가지 않는다.
- 일부 unified shell 관측은 upstream hook 제공 범위에 의존한다.
- Artifact revision/archive lifecycle은 다음 phase 마감 항목이다.

## Next Phase Entry Point

- Interview/Plan/Contract revision/supersedes/archive lifecycle을 완성한 뒤 최종목표 audit를 실행한다.
