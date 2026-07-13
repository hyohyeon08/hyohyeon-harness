# Phase 28: Artifact Lifecycle and Final Audit

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Interview/Plan/Contract revision lifecycle을 완성하고 최종목표의 필수 구현 gap을 종결한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-28-01` | Interview/Plan/Contract revision lifecycle | `passing` | typecheck; tests |
| `FG-28-02` | Final-goal completion audit | `passing` | full suite; coverage; diff check |

## Actual Work Performed

- Interview/Plan/Contract schema에 revision과 supersedes reference를 추가했다.
- Approved artifact의 archive는 human-only CLI로 제한했다.
- Archived artifact만 새 draft revision으로 복제할 수 있다.
- Contract→Plan→Interview archive 순서를 강제한다.
- Archive 시 Run pointer를 비우고 phase를 이전 approval 단계로 되돌린다.
- Reconcile이 crash 뒤 남은 archived pointer를 안전하게 제거한다.
- Root docs, gap matrix, phase ledger를 완료 상태로 동기화했다.
- Full tests와 coverage를 다시 실행했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 330 tests passed | `2026-07-10` |
| `node --experimental-test-coverage --test tests/*.test.mjs` | 0 | line 89.14%, branch 71.40%, function 88.65% | `2026-07-10` |
| `git diff --check` | 0 | terminal output | `2026-07-10` |
| `npm_config_cache=/tmp/hyohyeon-harness-npm-cache npm pack --dry-run` | 0 | 227-file package manifest | `2026-07-10` |

## Decisions

- Revision은 approved artifact mutation이 아니라 새 draft record다.
- Archive는 연결을 끊어 재승인 전 write/completion을 멈추는 실행 의미를 가진다.
- Upstream hook이 노출하지 않는 shell은 wrapper로 관측하는 경계를 유지한다.
- AGENTS/CI 자동 patch는 최종목표 비용 원칙에 따라 human-selected candidate로 유지한다.

## Known Risks

- External embedding/Judge 품질과 비용은 선택한 adapter/provider에 의존한다.
- Very large `**` provenance scope는 hashing 비용이 커질 수 있다.
- Unified/streaming shell 관측은 host hook 제공 범위에 의존한다.
- 현재 worktree에는 이 작업 이전부터 존재한 대규모 미커밋 변경이 함께 있다.

## Next Phase Entry Point

- 필수 구현 phase는 완료됐다. 실제 사용 중 생성되는 Detection/Rule/Eval feedback을 독립적인 후속 intent로 처리한다.
