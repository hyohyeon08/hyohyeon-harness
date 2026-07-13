# Phase 20: General Command Tracing

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Verification 밖의 일반 command 실행을 Run trace에 남기고 반복 실패 탐지로 연결한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-20-01` | Command wrapper and observed command runtime | `passing` | `npm run typecheck`; `npm test` |
| `FG-20-02` | PostToolUse command hook and monitor input | `passing` | `npm run typecheck`; `npm test` |

## Actual Work Performed

- 일반 command 실행/관측 결과를 기록하는 `src/runtime/commands.ts`를 추가했다.
- command, args, cwd, exit code, stdout/stderr, raw log, error signature를 저장한다.
- `intent command -- <command...>` wrapper가 실제 exit code와 출력을 전달한다.
- Codex/Claude PostToolUse(Bash) template과 `hooks/post-command.ts`를 추가했다.
- Hook은 command를 재실행하거나 차단하지 않고 결과만 기록한다.
- `run_command` 실패를 repeated command/error signature monitor 입력에 포함했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm test` | 0 | terminal output, 283 tests passed | `2026-07-10` |

## Changed Files

- `src/runtime/commands.ts`: wrapper와 observed command recorder.
- `src/state/paths.ts`: command-results raw log path.
- `src/cli/index.ts`: `intent command` CLI와 setup directory.
- `hooks/post-command.ts`: PostToolUse Bash adapter.
- `.codex/hooks.template.json`, `.claude/settings.template.json`: command hook installation.
- `src/runtime/monitor.ts`: general failure detection input.
- `tests/*.test.mjs`: runtime, CLI, hook, install, monitor coverage.

## Decisions

- Verification Evidence와 일반 command span을 구분한다. 일반 command 성공은 completion evidence를 만족시키지 않는다.
- Hook은 side effect를 재실행하지 않고 payload를 관측만 한다.
- 자동 interception이 불완전한 shell mechanism은 wrapper로 기록한다.
- 실패 signature와 반복 명령 탐지는 `run_check`와 `run_command`를 같은 structural signal로 본다.

## Known Risks

- Codex 공식 hooks 문서상 PostToolUse는 unified/streaming shell 호출 전체를 아직 가로채지 못한다.
- tool_response shape가 provider별로 다를 수 있어 adapter는 알려진 output/stdout/stderr/exit code 필드를 보수적으로 읽는다.
- command log의 secret redaction은 아직 없다.

## Next Phase Entry Point

- 같은 파일의 동일 영역 반복 수정과 tool sequence thrashing을 deterministic monitor로 추가한다.
