# Phase 26: Lineage Reconciliation

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Run index와 Interview/Plan/Contract/Run의 partial multi-record update를 안전하게 감사·복구한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-26-01` | Derived Run index rebuild | `passing` | `npm run typecheck`; `npm test` |
| `FG-26-02` | Cross-artifact reconciliation CLI | `passing` | runtime + CLI tests |

## Actual Work Performed

- sequential artifact 정렬을 numeric suffix comparator로 통일했다.
- Run records에서 active/recent index를 파생하는 `deriveRunIndex`와 rebuild runtime을 추가했다.
- `reconcileState`가 missing backlink와 lineage conflict를 별도로 수집한다.
- Existing lineage는 절대 교체하지 않고 null backlink만 채운다.
- Conflict가 하나라도 있으면 `--apply`가 어떤 repair도 수행하지 않는다.
- `intent reconcile` dry-run과 `intent reconcile --apply`를 추가했다.
- corrupt index + missing Interview/Plan/Contract backlink 복구가 한 번 적용 후 no-op임을 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 318 tests passed | `2026-07-10` |

## Decisions

- Run index는 권위 데이터가 아니라 재생성 가능한 cache다.
- 자동 복구는 missing backlink만 다루고 conflicting authority 판단은 사람에게 남긴다.
- 별도 transaction journal보다 idempotent reconciliation을 먼저 채택했다.
- Dry-run을 기본으로 하고 state mutation은 명시적 `--apply`에서만 수행한다.

## Known Risks

- Process가 apply 도중 다시 종료되면 다음 reconcile이 남은 missing backlink를 채워야 한다.
- Spec wiki artifact는 JSON lineage reconciliation 대상에 포함하지 않았다.
- Concurrent reconcile 두 개에 대한 global transaction lock은 없다.
- Semantic Judge invocation policy는 다음 phase다.

## Next Phase Entry Point

- deterministic candidate detection을 대상으로 bounded Judge selection/budget/cache policy를 추가한다.
