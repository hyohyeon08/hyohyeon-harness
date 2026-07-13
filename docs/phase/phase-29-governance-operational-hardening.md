# Phase 29: Governance and Operational Hardening

## Status

- status: `passing`
- completed_at: `2026-07-13`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

지원 Agent 채널의 신뢰 경계, semantic edit governance, Detection 전이 정책, 완료 원자성, 저장소 운영·배포 준비를 한 번에 감사하고 각각 독립 검증한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-29-01` | Human-only command/state boundary | `passing` | command guard + hook tests |
| `FG-29-02` | Semantic edit governance closure | `passing` | triviality + Codex hook tests |
| `FG-29-03` | Confirmed-only Detection blocking | `passing` | monitor + completion tests |
| `FG-29-04` | Durable completion recovery | `passing` | fault injection + reconcile tests |
| `FG-29-05` | Operational delivery hardening | `passing` | repository ops + full audit |

## Actual Work Performed

- Agent Bash에서 approval/archive/resolve와 직접 `.intent/` mutation을 실행 전 차단했다.
- semantic code change는 줄 수로 trivial 처리하지 않고 active Run과 같은 Intent scope를 요구한다.
- thrashing/false_success 모두 candidate는 기록 전용, confirmed만 Run 차단으로 통일했다.
- completion journal을 먼저 기록하고 Intent/Run terminal write의 중간 실패를 reconcile이 복구하게 했다.
- `.intent/`, Claude/Codex 상대경로 hook을 tracked 상태로 두어 저장소가 하네스를 dogfood한다.
- Node 20/22 CI, MIT license, npm runtime allowlist와 prepack build를 추가했다.
- 1,510줄 CLI를 931줄 진입점과 `core`/`feedback`/`knowledge` command 모듈로 분리했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-13` |
| `npm test` | 0 | terminal output, 344 tests passed | `2026-07-13` |
| `npm run coverage` | 0 | line 89.26%, branch 71.38%, function 88.21% | `2026-07-13` |
| `npm pack --dry-run --json` | 0 | 65 files, 75.8 KB tarball | `2026-07-13` |

## Changed Files

- `src/runtime/command-guard.ts`, `hooks/pre-command-guard.ts`: supported-channel command boundary.
- `src/runtime/triviality.ts`, `hooks/pre-write-guard.ts`: semantic edit governance.
- `src/runtime/monitor.ts`: confirmed-only blocking policy.
- `src/runtime/completion-transaction.ts`, `src/runtime/reconcile.ts`: completion journal and recovery.
- `src/cli/commands/*`, `src/cli/shared.ts`: CLI domain split.
- `.intent/`, `.claude/settings.json`, `.codex/hooks.json`: repository self-dogfooding.
- `.github/workflows/ci.yml`, `LICENSE`, `package.json`: CI and package delivery.

## Decisions

- Human-only는 지원 Claude/Codex hook 채널의 confirmation boundary이며 OS process sandbox를 주장하지 않는다.
- Completion은 cross-file atomic rename을 가장하지 않고 durable journal + recovery로 보장한다.
- Candidate detection은 유형별 예외 없이 record-only다.
- 배포 tarball은 `files` allowlist로 runtime과 설치 자산만 포함한다.

## Known Risks

- Upstream hook이 노출하지 않는 shell/direct write는 wrapper 밖에서 관측할 수 없다.
- 동일 OS 권한의 적대적 프로세스 격리는 별도 sandbox가 필요하다.
- External embedding/Judge 품질과 비용은 선택한 adapter에 의존한다.

## Next Phase Entry Point

- 실제 운영에서 생성되는 Detection/Rule/Eval feedback 또는 사람이 선택한 AGENTS/CI patch 적용을 독립 Intent로 시작한다.
