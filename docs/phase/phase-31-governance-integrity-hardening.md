# Phase 31: Governance Integrity Hardening

## Status

- status: `passing`
- completed_at: `2026-07-15T16:22:14+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

운영 감사에서 드러난 lexical root escape, 1000번째 observation 경계, concurrent Run/Trace lost update를 수정한다. 동시에 Sprint Contract와 RunState 설명을 실제 실행 모델에 맞추고 self-dogfood의 실제 표본과 한계를 남긴다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-31-01` | Repository and state integrity boundaries | `passing` | targeted 61 tests; 356-test suite; coverage |
| `FG-31-02` | Executable semantics and dogfood evidence | `passing` | Contract/reviewer tests; Wiki/package/diff audit |

## Actual Work Performed

- Scope matcher가 absolute path와 `..` segment를 broad glob 전에 거부하게 했다.
- Write/Edit adapter는 저장소 내부 absolute payload만 상대경로로 정규화하고, 원본 경로를 검사하기 전에 저장소 밖 대상을 읽지 않게 했다.
- Span loader와 Eval evidence parser가 `RUN-1000`·`SPAN-1000` 이상을 보존하게 했다.
- existing Run과 Trace read-transform-write에 short cross-process lock을 적용하고 Span exclusive create를 유지했다.
- 16개 Node process를 동시에 시작해 같은 Run evidence와 Trace span이 모두 보존되는 회귀 테스트를 추가했다.
- Contract show/report/reviewer checklist와 schema 주석에서 machine-enforced policy와 reviewer metadata를 구분했다.
- 최종목표의 RunState를 실제 `active|blocked|passing|paused`, `phase: done`, attempt-only budget 모델로 교정했다.
- `INT-003`/`RUN-004` 실제 workflow와 Wiki decision을 생성하고 `docs/dogfooding-baseline.md`에 작은 표본의 한계를 기록했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| integrity targeted suite | 0 | terminal output, 61/61 | `2026-07-15` |
| `npm test` | 0 | terminal output, 356/356 | `2026-07-15` |
| `npm run coverage` | 0 | line 89.71%, branch 71.92%, function 88.73% | `2026-07-15` |
| `intent wiki lint` | 0 | `.intent/wiki/index.md` | `2026-07-15` |
| `npm pack --dry-run --json` | 0 | terminal output, 65 files | `2026-07-15` |
| `git diff --check` | 0 | terminal output | `2026-07-15` |

## Changed Files

- `src/runtime/scope.ts`, `hooks/pre-write-guard.ts`: repository-relative lexical containment.
- `src/utils/json.ts`, `src/runtime/runs.ts`, `src/runtime/observability.ts`: locked state updates.
- `src/runtime/evals.ts`: high sequential span evidence references.
- `src/runtime/schemas.ts`, `src/cli/index.ts`: Contract semantics presentation.
- `tests/*`: containment, high-ID, Contract semantics, 16-process concurrency regressions.
- product, operating, phase, gap, and dogfooding documentation.

## Decisions

- Natural-language Contract fields are not silently promoted to executable gates. Enforcement requires a deterministic rule or required check.
- The implemented attempt budget remains intentionally small; wall-clock budget and invented terminal statuses are not added to satisfy stale prose.
- Sidecar locks serialize only short JSON read-transform-write sections; immutable record publication still uses exclusive create.
- Dogfood maturity claims must cite observed governed work and state what the current sample cannot prove.

## Known Risks

- A root-relative path that traverses a repository symlink needs a separate canonical-path threat-model decision.
- Stale-lock recovery is time-based and should be observed under longer real multi-agent runs.
- Three self-referential Intents do not establish detection precision or long-term Wiki reuse.

## Next Phase Entry Point

- Complete three to five independent feature/fix Intents using `docs/dogfooding-baseline.md`, then prioritize any Detection/Rule/Eval feedback that recurs.
