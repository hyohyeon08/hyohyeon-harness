# Phase 19: Structured InterviewSummary and Lineage

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Interview 결과를 schema-validated artifact로 만들고 승인된 공유 이해가 Intent/Spec/Plan/Run까지 추적되게 한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-19-01` | Structured InterviewSummary artifact | `passing` | `npm run typecheck`; `npm test` |
| `FG-19-02` | Interview-to-Run lineage propagation | `passing` | `npm run typecheck`; `npm test` |

## Actual Work Performed

- `InterviewSummarySchema`와 `.intent/interviews/INTERVIEW-*.json` 경로를 추가했다.
- 목표, 이유, 맥락, 제약, scope, 성공/실패 기준, 검증, 선택지, 비목표, 가정, 열린 질문을 구조화했다.
- `intent interview draft/show/list/link/approve` CLI를 추가했다.
- 승인된 Interview 본문은 불변이고 downstream lineage는 비어 있는 참조만 append할 수 있다.
- RunState와 Plan에 `interviewId`를 추가했다.
- `run start --interview`, `spec draft --interview`, `plan draft`가 lineage를 자동 전파한다.
- SessionStart와 handoff의 active Run에 Interview/Spec/Plan/Contract lineage를 표시한다.
- interview skill을 structured artifact 중심 workflow로 갱신했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 276 tests passed | `2026-07-10` |

## Changed Files

- `src/runtime/interviews.ts`: CRUD, approval, append-only lineage.
- `src/runtime/schemas.ts`: InterviewSummary와 Run/Plan interview reference.
- `src/state/paths.ts`: interviews directory/file helpers.
- `src/runtime/runs.ts`, `src/runtime/plans.ts`: Interview lineage storage.
- `src/runtime/memory.ts`, `src/runtime/handoff.ts`: active Run lineage context.
- `src/cli/index.ts`: interview CLI와 automatic propagation.
- `skills/interview/SKILL.md`: structured workflow.
- `tests/*.test.mjs`: schema, runtime, CLI, propagation, context coverage.

## Decisions

- InterviewSummary는 wiki spec과 별개다. 전자는 기계 판정 가능한 구조화 근거이고 후자는 사람이 읽는 상세 공유 이해다.
- 승인 후 본문은 수정하지 않는다.
- downstream artifact는 승인 시점에 아직 없을 수 있으므로 lineage만 append-only로 허용한다.
- 기존 lineage 값을 다른 ID로 바꾸는 relink는 거부한다.

## Known Risks

- Interview revision/archive CLI는 아직 없다.
- Wiki spec 본문 자체는 JSON Interview와 내용 동등성을 자동 검증하지 않는다.
- Contract 승인 시 Interview/Plan lineage 전체를 아직 검증하지 않는다.

## Next Phase Entry Point

- `intent verify` 밖의 일반 shell command를 Run span으로 남기는 command tracing을 추가한다.
