# Phase 3: Contract CLI

## Status

- status: `passing`
- completed_at: `2026-07-06T14:53:18.6984758+09:00`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

이 기록은 Phase 3 전체 완료가 아니라 `FG-03-03 Contract CLI` 기능 항목 완료 기록이다. 범위는 `intent contract draft/show/list` CLI에 제한한다. approve flow는 아직 별도 기능으로 남긴다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-03-03` | Contract CLI | `passing` | `npm.cmd run typecheck`; `npm.cmd test` |

## Actual Work Performed

- `intent contract draft [runId]`를 추가했다.
- run id를 생략하면 active run을 대상으로 draft contract를 만든다.
- contract 생성 후 해당 RunState의 `contractId`를 갱신하도록 했다.
- `intent contract show <contractId>`를 추가해 scope, forbidden scope, required checks, definition of done을 출력한다.
- `intent contract list`를 추가해 contract summaries를 출력한다.
- `tests/contract-cli.test.mjs`를 추가해 draft/show/list/no-active-run 케이스를 실제 CLI process로 검증했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm.cmd run typecheck` | 0 | terminal output | `2026-07-06T14:53:18.6984758+09:00` |
| `npm.cmd test` | 0 | terminal output, 151 tests passed | `2026-07-06T14:53:18.6984758+09:00` |

## Changed Files

- `src/cli/index.ts`: `contract` command dispatcher와 `draft`, `show`, `list` subcommands를 추가했다.
- `tests/contract-cli.test.mjs`: Contract CLI process tests를 추가했다.
- `docs/final-goal-phase-feature-spec.md`: `FG-03-03` 상태와 검증 증거를 `passing`으로 갱신하고 다음 시작점을 `FG-03-04`로 옮겼다.
- `docs/phase/phase-3-contract-cli.md`: 이 완료 기록을 추가했다.
- `README.md`: 테스트 수를 갱신했다.
- `AGENT.md`: 테스트 수를 갱신했다.

## Decisions

- `intent contract draft`는 run id가 없으면 active run을 사용한다.
- contract draft는 연결된 run의 `intentId`를 요구한다.
- contract draft 후 RunState의 `contractId`를 갱신한다.
- show 출력은 Agent가 읽기 쉬운 plain text section 형태로 둔다.

## Known Risks

- contract approve flow는 아직 없다.
- contract editing CLI는 아직 없다.
- 여러 contract가 같은 run에 만들어지는 것을 막지는 않는다.

## Next Phase Entry Point

- next_feature: `FG-03-04 Forbidden scope gate`
- reason: contract를 생성하고 확인할 수 있게 되었으므로 `forbiddenScope`를 pre-write guard에 연결해 실제 파일 변경을 막아야 한다.

## Correction

없음.
