# Phase 30: Fully Autonomous Lifecycle Policy

## Status

- status: `passing`
- completed_at: `2026-07-15`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

과거 human-only였던 governance lifecycle을 완전 자율 정책으로 전환한다. 사용자가 별도 shell 명령을 입력하지 않아도 AI가 준비 상태를 판단하고 모든 기존 approve/archive/resolve CLI를 직접 실행한다. Artifact state, lineage, immutability, verification gate와 `.intent/` 보호는 유지한다.

Phase 18, 28, 29를 포함한 이전 phase 문서는 당시 구현과 검증의 역사 기록이다. Phase 30은 그 문서를 소급 수정하지 않고 현재 actor authority 정책만 대체한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-30-01` | Autonomous lifecycle commands and actor provenance | `passing` | typecheck + autonomous CLI/hook tests |
| `FG-30-02` | Autonomous workflow and protected-state regression | `passing` | full suite + coverage + package/diff audit |

## Actual Work Performed

- 제품 SSOT에서 사람의 수동 governance 명령 개입을 0으로 고정했다.
- AI가 Intent/Rule/Spec/Interview/Plan/Contract approve, artifact archive, Detection resolve를 직접 실행하는 정책을 정의했다.
- `approved`를 사람의 보증이 아니라 readiness·lineage·immutability를 나타내는 기계적 상태로 재정의했다.
- CLI actor를 `agent:codex`, `agent:claude-code`, `human`으로 구분해 provenance를 남기되 actor별 권한 차이는 두지 않도록 했다.
- `.intent/` 직접 Edit/Write, redirect, 임의 script mutation은 계속 차단하고 schema-validated `intent` CLI만 writer로 유지하도록 했다.
- archive/revise 순서, Contract/Plan/Interview lineage, Run phase precondition, completion evidence는 자율화 이후에도 동일하게 강제하도록 했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-15` |
| `npm test` | 0 | terminal output, 346 tests passed | `2026-07-15` |
| `npm run coverage` | 0 | line 89.54%, branch 71.08%, function 88.48% | `2026-07-15` |
| `npm pack --dry-run --json` | 0 | 65 files, 75.9 KB tarball | `2026-07-15` |
| `git diff --check` | 0 | terminal output | `2026-07-15` |

## Changed Files

- `hyohyeon-harness-최종목표.md`: 완전 자율 lifecycle을 상위 제품 정책으로 정의.
- `docs/final-goal-gap-analysis.md`: human-only gap을 Phase 30 autonomous boundary로 교체.
- `docs/final-goal-phase-feature-spec.md`: FG-30-01/02와 dependency를 추가.
- `docs/phase/phase-30-autonomous-approval-policy.md`: Phase 30 범위·결정·검증 기준 기록.
- Runtime, CLI, hook, tests, 운영 문서를 FG-30-01/02 구현 범위에서 갱신했다.

## Decisions

- 사용자 목표 위임 뒤 approve/archive/resolve를 위해 사람이 shell에 개입하지 않는다.
- AI는 과거 사람 전용이었던 모든 lifecycle 명령을 기존 CLI를 통해 스스로 실행한다.
- `approved` 이름과 기존 상태값은 backward compatibility를 위해 유지하되 의미는 readiness·lineage seal이다.
- Actor provenance는 감사 정보이며 권한 판정 수단이 아니다.
- 자율화는 CLI-only writer, Zod validation, artifact immutability, phase/lineage/completion gate를 완화하지 않는다.
- 이전 phase 문서의 human-only 설명은 역사적 사실로 남기고 Phase 30이 현재 정책을 명시적으로 supersede한다.

## Known Risks

- 환경 marker가 누락된 Agent shell은 actor가 `human`으로 기록되므로 배포 환경이 marker를 보존해야 한다.
- Lifecycle 명령 허용과 direct `.intent/` mutation 허용을 혼동하면 anti-cheat 경계가 무너질 수 있다.
- 향후 문서·설치 skill이 이전 human-only 문구로 회귀하면 Agent가 불필요하게 멈출 수 있다.
- 여러 lifecycle 명령 사이의 process crash는 각 atomic 전이와 기존 reconcile/재시도 범위 안에서만 복구된다.

## Next Phase Entry Point

- 필수 구현 gap은 없다. 실제 운영 Detection/Rule/Eval feedback 또는 AI-executable AGENTS/CI patch를 독립 Intent로 시작한다.
