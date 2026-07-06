# hyohyeon-harness final goal phase and feature spec

## 목적

이 문서는 `hyohyeon-harness-최종목표.md`를 달성하기 위한 phase 계획과 기능 목록 명세다. 이전 문서인 `docs/final-goal-gap-analysis.md`가 "현재 무엇이 부족한가"를 설명한다면, 이 문서는 "어떤 기능을 어떤 순서로, 어떤 검증을 통과해야 완료로 볼 것인가"를 정의한다.

핵심 운영 원칙은 다음과 같다.

```text
기능은 작게 쪼갠다.
각 기능은 하나의 세션 안에서 완료 가능해야 한다.
상태는 not_started, active, blocked, passing 중 하나다.
active에서 passing으로 이동하는 유일한 방법은 선언된 검증 명령이 성공하는 것이다.
```

이 문서는 초기에는 사람이 읽는 로드맵이지만, 이후 `.intent/runs`, `.intent/contracts`, `.intent/detections`가 구현되면 machine-readable 상태로 이전할 수 있어야 한다.

## 기능 상태 규칙

각 기능 항목은 반드시 아래 네 가지 상태 중 하나만 가진다.

| 상태 | 의미 |
| --- | --- |
| `not_started` | 아직 작업하지 않았다. 구현, 테스트, 문서 갱신이 시작되지 않았다. |
| `active` | 현재 세션 또는 최근 세션에서 작업 중이다. 반드시 `active_work`와 `next_action`이 있어야 한다. |
| `blocked` | 외부 결정, 누락된 전제, 설계 충돌, 반복 실패 등으로 진행할 수 없다. 반드시 `blocked_reason`과 `unblock_condition`이 있어야 한다. |
| `passing` | 선언된 검증 명령이 성공했고, 그 증거가 기록되어 있다. |

허용되는 상태 전이는 다음뿐이다.

```text
not_started -> active
not_started -> blocked
blocked -> active
active -> blocked
active -> passing
passing -> active   # 회귀 또는 요구 변경이 명시적으로 발견된 경우에만
```

`active -> passing` 전이는 오직 해당 기능 항목에 적힌 `verification_commands`가 성공했을 때만 가능하다. 구현자가 "완료했다"고 말하는 것은 상태 전이 근거가 아니다. 검증을 실행하지 못했다면 `passing`이 아니라 `active` 또는 `blocked`다.

## 세션 단위 기능 기준

각 기능은 하나의 세션 안에서 완료 가능해야 한다. 여기서 "하나의 세션"은 다음 조건을 만족하는 범위다.

- 한 가지 개념만 바꾼다.
- 변경 파일 범위가 명확하다.
- 필요한 테스트를 같은 세션 안에서 추가 또는 갱신할 수 있다.
- 검증 명령을 같은 세션 안에서 실행할 수 있다.
- 실패했을 때 다음 행동을 명확히 기록할 수 있다.
- schema, runtime, CLI, hook, docs를 모두 크게 바꿔야 한다면 여러 기능으로 쪼갠다.

예를 들어 "RunState 전체 구현"은 너무 크다. 대신 "RunState schema와 경로 추가", "Run CRUD runtime 추가", "run CLI start/status 추가"처럼 나눈다.

## 기능 항목 형식

각 기능 항목은 Agent가 세션을 바꿔도 바로 이어받을 수 있도록 아래 정보를 가진다.

```yaml
id: FG-01-01
title: RunState schema and paths
status: not_started | active | blocked | passing
phase: Phase 1
objective: 무엇을 끝내는가
why: 왜 필요한가
scope:
  - 수정 가능한 파일/폴더
dependencies:
  - 먼저 passing이어야 하는 기능 ID
session_boundary: 하나의 세션에서 끝내야 하는 경계
implementation_notes:
  - 구현 시 주의할 점
verification_commands:
  - passing 전이를 위해 반드시 성공해야 하는 명령
passing_evidence:
  command: null
  exit_code: null
  log_path: null
  verified_at: null
active_work:
  current_focus: null
  touched_files: []
  attempted_commands: []
  last_observation: null
blocked_reason: null
unblock_condition: null
next_action: 이 기능을 시작하거나 이어받을 때 바로 할 일
```

초기 상태에서는 대부분 `not_started`다. 어떤 항목을 작업하기 시작하면 먼저 `active`로 바꾸고 `active_work.current_focus`와 `next_action`을 갱신한다. 검증 명령 성공 전에는 `passing`으로 바꾸지 않는다.

## Phase 0: 로드맵과 운영 규칙 고정

목표: 최종목표 문서를 현재 코드베이스의 실행 가능한 작업 목록으로 바꾼다.

이 phase는 구현 phase의 기반이다. 이 문서 자체가 Phase 0의 산출물이며, 이후 실제 기능 ledger가 구현되면 이 내용을 `.intent/` 상태 파일로 이관한다.

### FG-00-01 기능 상태 모델 문서화

- status: `passing`
- phase: Phase 0
- objective: 기능 항목의 상태 모델, 전이 규칙, passing 조건을 문서화한다.
- why: 세션이 바뀌어도 어떤 기능이 완료됐고 무엇이 진행 중인지 Agent가 알 수 있어야 한다.
- scope:
  - `docs/final-goal-phase-feature-spec.md`
- dependencies: []
- session_boundary: 문서 하나에 상태 규칙과 기능 항목 형식을 정리한다.
- implementation_notes:
  - 실제 상태 저장소 구현은 이 항목에 포함하지 않는다.
  - machine-readable schema는 Phase 1 이후 구현한다.
- verification_commands:
  - `Get-Content -Raw -Encoding UTF8 docs\final-goal-phase-feature-spec.md`
- passing_evidence:
  - command: `Get-Content -Raw -Encoding UTF8 docs\final-goal-phase-feature-spec.md`
  - exit_code: 0
  - log_path: terminal output
  - verified_at: `2026-07-02T16:01:40.3820566+09:00`
- active_work:
  - current_focus: null
  - touched_files:
    - `docs/final-goal-phase-feature-spec.md`
  - attempted_commands:
    - `Get-Content -Raw -Encoding UTF8 docs\final-goal-phase-feature-spec.md`
  - last_observation: 검증 명령이 exit code 0으로 성공했다.
- blocked_reason: null
- unblock_condition: null
- next_action: 다음 구현 시작점은 `FG-01-01 RunState schema and paths`다.

## Phase 1: RunState MVP

목표: Intent와 별개로 "이번 Agent 실행"을 추적하는 RunState를 만든다.

이 phase가 끝나면 Agent는 현재 active run, 목표, 연결된 intent/spec, 다음 행동, 세션 메모를 읽을 수 있어야 한다.

### FG-01-01 RunState schema and paths

- status: `passing`
- phase: Phase 1
- objective: RunState 관련 zod schema와 `.intent/runs` 경로를 추가한다.
- why: 최종목표의 중심 데이터인 RunState를 모든 후속 기능의 기반으로 삼기 위해.
- scope:
  - `src/runtime/schemas.ts`
  - `src/state/paths.ts`
  - `tests/run-state.test.mjs`
- dependencies: []
- session_boundary: schema, default object, path resolver, 단위 테스트까지만 포함한다.
- implementation_notes:
  - `Intent`와 `Run`은 분리한다.
  - `RunState`는 `intentId`, `specSlug`, `planId`, `contractId`를 optional reference로 가진다.
  - 기존 `StateSchema`와 호환성을 깨지 않는다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T11:31:24.7086340+09:00`
- active_work:
  - current_focus: null
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/state/paths.ts`
    - `tests/run-state.test.mjs`
  - attempted_commands: []
  - last_observation: `RunStatusSchema`, `RunPhaseSchema`, `RunStateSchema`, `.intent/runs` 경로 테스트가 포함된 105개 테스트가 모두 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-01-02 RunState runtime CRUD`를 시작한다.

### FG-01-02 RunState runtime CRUD

- status: `passing`
- phase: Phase 1
- objective: RunState를 생성, 조회, 갱신하는 순수 runtime 모듈을 추가한다.
- why: CLI와 hook이 직접 JSON을 만지지 않고 검증된 API를 사용하게 하기 위해.
- scope:
  - `src/runtime/runs.ts`
  - `src/runtime/schemas.ts`
  - `tests/runs.test.mjs`
- dependencies:
  - FG-01-01
- session_boundary: 파일 IO wrapper와 순수 update 함수까지만 구현한다.
- implementation_notes:
  - `writeJsonAtomic` 사용.
  - `nextRunId`는 `RUN-001` 형식을 사용한다.
  - immutable update 원칙을 지킨다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:09:29.0988831+09:00`
- active_work:
  - current_focus: `RunState runtime CRUD implemented`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/runs.ts`
    - `tests/runs.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `createRun`, `loadRuns`, `findRun`, `updateRun`, `activeRun`, `loadRunIndex`가 추가되었고 111개 테스트가 모두 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-01-03 Run CLI start/status/list/note`를 시작한다.

### FG-01-03 Run CLI start/status/list/note

- status: `passing`
- phase: Phase 1
- objective: `intent run` 하위 명령을 추가한다.
- why: 사용자가 RunState를 직접 확인하고 다음 행동을 기록할 수 있어야 한다.
- scope:
  - `src/cli/index.ts`
  - `src/runtime/runs.ts`
  - `tests/run-cli.test.mjs`
- dependencies:
  - FG-01-02
- session_boundary: `start`, `status`, `list`, `note`만 구현한다. pause/resume은 별도 기능으로 둔다.
- implementation_notes:
  - `intent run start <intentId> "<objective>"`
  - `intent run status`
  - `intent run list`
  - `intent run note "<text>"`
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:14:13.0297733+09:00`
- active_work:
  - current_focus: `Run CLI start/status/list/note`
  - touched_files:
    - `src/cli/index.ts`
    - `src/runtime/runs.ts`
    - `tests/run-cli.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `intent run start/status/list/note` CLI와 fixture 테스트가 추가되었고 116개 테스트가 모두 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-01-04 SessionStart includes active run context`를 시작한다.

### FG-01-04 SessionStart includes active run context

- status: `passing`
- phase: Phase 1
- objective: SessionStart memory에 active run의 objective, status, nextAction을 포함한다.
- why: 새 세션의 Agent가 무엇을 하던 중이었는지 즉시 파악해야 한다.
- scope:
  - `src/runtime/memory.ts`
  - `src/runtime/runs.ts`
  - `hooks/session-start.ts`
  - `tests/memory.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-01-02
- session_boundary: active run 요약 출력만 추가한다. 전체 run history 출력은 포함하지 않는다.
- implementation_notes:
  - progressive disclosure를 유지한다.
  - 긴 evidence/log 내용은 주입하지 않는다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:16:32.5939870+09:00`
- active_work:
  - current_focus: `SessionStart active run context`
  - touched_files:
    - `src/runtime/memory.ts`
    - `src/runtime/runs.ts`
    - `hooks/session-start.ts`
    - `tests/memory.test.mjs`
    - `tests/codex-hooks.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: SessionStart memory가 active run 요약과 최근 note를 포함하고, Codex SessionStart hook fixture까지 포함해 118개 테스트가 모두 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-01-05 Handoff includes active run`을 시작한다.

### FG-01-05 Handoff includes active run

- status: `passing`
- phase: Phase 1
- objective: PreCompact handoff에 active run 상태와 next action을 포함한다.
- why: 압축 이후에도 실제 작업 중이던 기능과 남은 행동을 잃지 않기 위해.
- scope:
  - `src/runtime/handoff.ts`
  - `src/runtime/runs.ts`
  - `hooks/pre-compact.ts`
  - `tests/handoff.test.mjs`
- dependencies:
  - FG-01-02
- session_boundary: handoff 문서에 run summary section만 추가한다.
- implementation_notes:
  - scratch note와 중복되지 않게 "Active Run" 섹션을 둔다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:22:16.3889021+09:00`
- active_work:
  - current_focus: `Handoff active run context`
  - touched_files:
    - `src/runtime/handoff.ts`
    - `src/runtime/runs.ts`
    - `hooks/pre-compact.ts`
    - `tests/handoff.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Handoff 문서에 Active Run 섹션이 추가되어 active run 요약, next action, 최근 note를 남기며 119개 테스트가 모두 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-02-01 VerificationEvidence schema and raw paths`를 시작한다.

## Phase 2: Verification Evidence MVP

목표: 완료 판단을 self-report가 아니라 실행된 검증 명령과 로그에 연결한다.

이 phase가 끝나면 Agent는 검증 명령을 Harness를 통해 실행하고, 결과를 RunState에 evidence로 남길 수 있어야 한다.

### FG-02-01 VerificationEvidence schema and raw paths

- status: `passing`
- phase: Phase 2
- objective: verification evidence schema와 `.intent/raw/*-results` 경로를 추가한다.
- why: 검증 결과를 구조화해 완료 판단의 근거로 쓰기 위해.
- scope:
  - `src/runtime/schemas.ts`
  - `src/state/paths.ts`
  - `tests/verification.test.mjs`
- dependencies:
  - FG-01-01
- session_boundary: schema와 path만 추가한다. command 실행은 다음 기능에서 한다.
- implementation_notes:
  - evidence type은 `typecheck`, `build`, `lint`, `unit_test`, `integration_test`, `e2e_test`, `custom`으로 시작한다.
  - status는 `passed`, `failed`로 시작한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:25:40.0096623+09:00`
- active_work:
  - current_focus: `VerificationEvidence schema and raw paths`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/state/paths.ts`
    - `tests/verification.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: VerificationEvidence type/status/schema, RunState evidence fields, and raw result path helper were added; 125 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-02-02 Verification command runner`를 시작한다.

### FG-02-02 Verification command runner

- status: `passing`
- phase: Phase 2
- objective: 검증 명령을 실행하고 stdout/stderr, exitCode, logPath를 저장하는 runtime을 추가한다.
- why: passing 상태 전이를 실제 명령 실행 결과와 연결하기 위해.
- scope:
  - `src/runtime/verification.ts`
  - `src/runtime/runs.ts`
  - `tests/verification.test.mjs`
- dependencies:
  - FG-02-01
  - FG-01-02
- session_boundary: runtime command runner만 구현한다. CLI는 다음 기능에서 한다.
- implementation_notes:
  - `child_process.spawnSync` 또는 `spawn` 중 기존 테스트 안정성이 높은 쪽을 선택한다.
  - log file은 `.intent/raw/<type>-results/<runId>-<timestamp>.log` 형식으로 저장한다.
  - command string과 args를 구조화해 저장한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:35:13.7597741+09:00`
- active_work:
  - current_focus: `Verification command runner`
  - touched_files:
    - `src/runtime/verification.ts`
    - `src/runtime/runs.ts`
    - `tests/verification.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: runVerification executes commands, writes raw stdout/stderr logs, appends passed/failed VerificationEvidence to RunState, and 127 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-02-03 Verify CLI`를 시작한다.

### FG-02-03 Verify CLI

- status: `passing`
- phase: Phase 2
- objective: `intent verify <type> -- <command...>` CLI를 추가한다.
- why: Agent와 사용자가 동일한 방식으로 검증 증거를 남기게 하기 위해.
- scope:
  - `src/cli/index.ts`
  - `src/runtime/verification.ts`
  - `tests/verify-cli.test.mjs`
- dependencies:
  - FG-02-02
- session_boundary: `verify`와 `verify list`만 구현한다.
- implementation_notes:
  - active run이 없으면 명확한 오류를 낸다.
  - 검증 command exitCode를 CLI exitCode와 일치시킬지 정책을 테스트로 고정한다.
  - Windows 예시는 `npm.cmd`를 사용한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:37:58.2850183+09:00`
- active_work:
  - current_focus: `Verify CLI`
  - touched_files:
    - `src/cli/index.ts`
    - `src/runtime/verification.ts`
    - `tests/verify-cli.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `intent verify <type> -- <command...>` records evidence for the active run, preserves args after `--`, returns checked command failures as CLI exit codes, and 132 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-02-04 Completion gate uses required verification evidence`를 시작한다.

### FG-02-04 Completion gate uses required verification evidence

- status: `passing`
- phase: Phase 2
- objective: 완료 판정에서 required verification evidence 존재와 성공 여부를 확인한다.
- why: 검증 없는 완료 선언을 막기 위해.
- scope:
  - `src/runtime/stop-gate.ts`
  - `src/runtime/runs.ts`
  - `src/runtime/verification.ts`
  - `src/cli/index.ts`
  - `tests/stop-gate.test.mjs`
  - `tests/verification.test.mjs`
- dependencies:
  - FG-02-03
- session_boundary: active run 기준의 required evidence 검사만 추가한다. Test Matrix default는 Phase 3에서 세분화한다.
- implementation_notes:
  - 초기 required checks는 RunState의 `requiredEvidenceTypes` 같은 단순 필드로 시작해도 된다.
  - 기존 intent DoD/learning gate를 제거하지 않는다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:42:07.0634463+09:00`
- active_work:
  - current_focus: `Completion gate required evidence`
  - touched_files:
    - `src/runtime/stop-gate.ts`
    - `src/runtime/runs.ts`
    - `src/runtime/verification.ts`
    - `src/cli/index.ts`
    - `tests/stop-gate.test.mjs`
    - `tests/verification.test.mjs`
    - `src/runtime/intents.ts`
    - `tests/verify-cli.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Completion/stop gates now require passed evidence for active run `requiredEvidenceTypes`, ignore mismatched linked runs, preserve DoD/learning checks, and 137 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-02-05 Setup creates run and raw directories`를 시작한다.

### FG-02-05 Setup creates run and raw directories

- status: `passing`
- phase: Phase 2
- objective: `intent setup`이 runs/raw 관련 디렉터리를 생성한다.
- why: 새 프로젝트에 설치했을 때 RunState와 evidence 저장 경로가 항상 준비되어야 한다.
- scope:
  - `src/cli/index.ts`
  - `src/state/paths.ts`
  - `tests/install.test.mjs`
- dependencies:
  - FG-02-01
- session_boundary: setup 디렉터리 생성과 테스트만 포함한다.
- implementation_notes:
  - 기존 `.intent/` 구조와 호환성을 유지한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:44:36.6771888+09:00`
- active_work:
  - current_focus: `Setup creates run/raw directories`
  - touched_files:
    - `src/cli/index.ts`
    - `src/state/paths.ts`
    - `tests/install.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `intent setup` now creates `.intent/runs`, `.intent/raw`, and type-specific raw result dirs; Phase 2 is passing with 137 tests.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-03-01 TestMatrix schema`를 시작한다.

## Phase 3: Sprint Contract and Test Matrix

목표: 각 Run이 어떤 범위와 어떤 검증 기준으로 평가되는지 명시한다.

### FG-03-01 TestMatrix schema

- status: `passing`
- phase: Phase 3
- objective: 작업 유형별 required/optional 검증 matrix를 schema로 정의한다.
- why: 모든 작업에 같은 테스트를 요구하지 않고, 필요한 검증 수준을 명확히 하기 위해.
- scope:
  - `src/runtime/schemas.ts`
  - `tests/test-matrix.test.mjs`
- dependencies:
  - FG-02-01
- session_boundary: schema와 default matrix 함수만 구현한다.
- implementation_notes:
  - `required`, `optional`, `skipped` 세 값으로 시작한다.
  - intent type 기반 default를 제공한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:47:39.8047078+09:00`
- active_work:
  - current_focus: `TestMatrix schema`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `tests/test-matrix.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: TestMatrix schema/defaults now map VerificationEvidenceType keys to required/optional/skipped dispositions, and 142 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-03-02 SprintContract schema and runtime`을 시작한다.

### FG-03-02 SprintContract schema and runtime

- status: `passing`
- phase: Phase 3
- objective: SprintContract schema와 생성/조회 runtime을 추가한다.
- why: Run의 평가 기준, 금지 범위, required checks를 별도 계약으로 보존하기 위해.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/contracts.ts`
  - `src/state/paths.ts`
  - `tests/contracts.test.mjs`
- dependencies:
  - FG-03-01
  - FG-01-02
- session_boundary: contract CRUD만 구현한다. CLI는 다음 기능에서 한다.
- implementation_notes:
  - `allowedScope` 기본값은 연결된 Intent scope에서 가져올 수 있다.
  - `forbiddenScope`, `architectureBoundaries`, `requiredChecks`, `definitionOfDone`을 포함한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:50:23.0351681+09:00`
- active_work:
  - current_focus: `SprintContract schema and runtime`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/contracts.ts`
    - `src/state/paths.ts`
    - `tests/contracts.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: SprintContract schema/runtime now persists draft contracts with defaults from Intent scope, DoD, and TestMatrix required checks; 147 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-03-03 Contract CLI`를 시작한다.

### FG-03-03 Contract CLI

- status: `passing`
- phase: Phase 3
- objective: `intent contract draft/show/list` 명령을 추가한다.
- why: 사람이 Run의 평가 계약을 확인하고 승인 전에 조정할 수 있어야 한다.
- scope:
  - `src/cli/index.ts`
  - `src/runtime/contracts.ts`
  - `tests/contract-cli.test.mjs`
- dependencies:
  - FG-03-02
- session_boundary: draft/show/list만 구현한다. approve flow는 기존 human-only 패턴을 따르는 별도 기능으로 둔다.
- implementation_notes:
  - 초기에는 draft contract를 run start 시 자동 생성하지 않아도 된다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:53:18.6984758+09:00`
- active_work:
  - current_focus: `Contract CLI`
  - touched_files:
    - `src/cli/index.ts`
    - `src/runtime/contracts.ts`
    - `tests/contract-cli.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `intent contract draft/show/list` now creates active-run contracts, links contractId back to RunState, prints scope/checks/DoD, and 151 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-03-04 Forbidden scope gate`를 시작한다.

### FG-03-04 Forbidden scope gate

- status: `passing`
- phase: Phase 3
- objective: SprintContract의 forbiddenScope를 pre-write guard에서 차단한다.
- why: 문서에만 있는 수정 금지 영역을 실제 파일 변경 gate로 강제하기 위해.
- scope:
  - `src/runtime/contracts.ts`
  - `src/runtime/scope.ts`
  - `hooks/pre-write-guard.ts`
  - `tests/contracts.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-03-02
- session_boundary: forbiddenScope path 차단만 구현한다. architecture boundary lint는 별도 기능으로 둔다.
- implementation_notes:
  - approved/active contract 정책을 먼저 정해야 한다.
  - rule `forbid-path`와 중복될 수 있으므로 error message에 source를 명확히 표시한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:56:21.2139911+09:00`
- active_work:
  - current_focus: `Forbidden scope gate`
  - touched_files:
    - `src/runtime/contracts.ts`
    - `src/runtime/scope.ts`
    - `hooks/pre-write-guard.ts`
    - `tests/contracts.test.mjs`
    - `tests/codex-hooks.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Pre-write guard now enforces active-run contract forbiddenScope before the intent gate, forbidden beats allowed, contract-specific denial is tested, and 154 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-04-01 Trace and span schema`를 시작한다.

## Phase 4: Observability MVP

목표: Agent가 무엇을 했는지 trace/span으로 남긴다.

### FG-04-01 Trace and span schema

- status: `passing`
- phase: Phase 4
- objective: trace/span schema와 raw observability 경로를 추가한다.
- why: 행동 증거를 구조화해 thrashing 탐지 기반으로 쓰기 위해.
- scope:
  - `src/runtime/schemas.ts`
  - `src/state/paths.ts`
  - `tests/observability.test.mjs`
- dependencies:
  - FG-01-01
- session_boundary: schema와 path만 구현한다.
- implementation_notes:
  - OpenTelemetry 호환 가능성을 고려하되 초기 구현은 단순 JSON으로 시작한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T14:59:43.9356840+09:00`
- active_work:
  - current_focus: `Trace and span schema`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/state/paths.ts`
    - `tests/observability.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Trace/Span schemas and raw observability trace/span paths were added; 160 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-04-02 Span writer runtime`을 시작한다.

### FG-04-02 Span writer runtime

- status: `passing`
- phase: Phase 4
- objective: active run에 span을 append하는 runtime을 추가한다.
- why: hook과 verify command가 동일한 방식으로 관측 데이터를 기록하게 하기 위해.
- scope:
  - `src/runtime/observability.ts`
  - `src/runtime/runs.ts`
  - `tests/observability.test.mjs`
- dependencies:
  - FG-04-01
  - FG-01-02
- session_boundary: span append와 list만 구현한다.
- implementation_notes:
  - hook failure가 작업을 막지 않도록 writer는 실패에 안전해야 한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`; `npm.cmd test`
  - exit_code: `0`; `0`
  - log_path: terminal output
  - verified_at: `2026-07-06T15:03:03.0539434+09:00`
- active_work:
  - current_focus: `Span writer runtime`
  - touched_files:
    - `src/runtime/observability.ts`
    - `tests/observability.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Span writer runtime now appends active-run spans, updates trace spanIds, lists spans, provides failure-safe append, and 163 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-04-03 Pre-write hook records edit spans`를 시작한다.

### FG-04-03 Pre-write hook records edit spans

- status: `passing`
- phase: Phase 4
- objective: `pre-write-guard`가 검사한 파일 변경을 edit/apply_patch span으로 기록한다.
- why: 반복 파일 수정과 scope 시도를 이후 monitor가 분석할 수 있어야 한다.
- scope:
  - `hooks/pre-write-guard.ts`
  - `src/runtime/observability.ts`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-04-02
- session_boundary: span 기록만 추가한다. 탐지는 Phase 5에서 한다.
- implementation_notes:
  - hook internal error는 계속 silent-fail이어야 한다.
  - `.intent/` 직접 편집 차단 정책은 유지한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:08:12.1763659+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 164 tests passed
    verified_at: `2026-07-06T15:08:12.1763659+09:00`
- active_work:
  - current_focus: `Pre-write hook edit spans`
  - touched_files:
    - `hooks/pre-write-guard.ts`
    - `tests/codex-hooks.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Pre-write guard now records checked edit/apply_patch spans with ok/blocked status through the failure-safe writer; Codex apply_patch fixture confirms a blocked edit creates a span, and 164 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-04-04 Verify command records command spans`를 시작한다.

### FG-04-04 Verify command records command spans

- status: `passing`
- phase: Phase 4
- objective: `intent verify` 실행이 run_command/run_check span을 기록한다.
- why: 검증 증거와 행동 증거를 연결하기 위해.
- scope:
  - `src/runtime/verification.ts`
  - `src/runtime/observability.ts`
  - `tests/verification.test.mjs`
- dependencies:
  - FG-04-02
  - FG-02-03
- session_boundary: verify command span만 기록한다. 일반 shell command 전체 추적은 포함하지 않는다.
- implementation_notes:
  - span에는 command, status, exitCode, logPath를 포함한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:12:03.9182305+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 166 tests passed
    verified_at: `2026-07-06T15:12:03.9182305+09:00`
- active_work:
  - current_focus: `Verify command spans`
  - touched_files:
    - `src/runtime/verification.ts`
    - `src/runtime/observability.ts`
    - `tests/verification.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: runVerification now records passed commands as ok run_check spans and failed commands as error run_check spans with command, args, exitCode, evidence status, and logPath attributes; 166 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-04-05 Error signature extraction`을 시작한다.

### FG-04-05 Error signature extraction

- status: `passing`
- phase: Phase 4
- objective: 검증 로그에서 반복 비교 가능한 error signature를 추출한다.
- why: thrashing 감지에서 "같은 실패"를 구조적으로 찾기 위해.
- scope:
  - `src/runtime/verification.ts`
  - `src/runtime/observability.ts`
  - `tests/verification.test.mjs`
- dependencies:
  - FG-02-02
  - FG-04-02
- session_boundary: 단순 deterministic signature 추출만 구현한다.
- implementation_notes:
  - 첫 버전은 마지막 비어 있지 않은 stderr line 또는 TAP failure headline 정도로 제한한다.
  - LLM/embedding은 사용하지 않는다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:15:04.8318239+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 169 tests passed
    verified_at: `2026-07-06T15:15:04.8318239+09:00`
- active_work:
  - current_focus: `Error signature extraction`
  - touched_files:
    - `src/runtime/verification.ts`
    - `tests/verification.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: extractErrorSignature now prefers the last non-empty stderr line, falls back to TAP not-ok headlines, and failed run_check spans include errorSignature when available; 169 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-05-01 DetectionRecord schema and paths`를 시작한다.

## Phase 5: Monitor and Detection Record

목표: false_success와 thrashing 후보를 deterministic 구조 게이트로 탐지한다.

### FG-05-01 DetectionRecord schema and paths

- status: `passing`
- phase: Phase 5
- objective: DetectionRecord schema와 `.intent/detections` 경로를 추가한다.
- why: 탐지 결과를 wiki/rule/eval로 넘길 수 있는 구조화 데이터로 남기기 위해.
- scope:
  - `src/runtime/schemas.ts`
  - `src/state/paths.ts`
  - `tests/detection.test.mjs`
- dependencies:
  - FG-04-01
  - FG-02-01
- session_boundary: schema와 path만 구현한다.
- implementation_notes:
  - type은 `thrashing`, `false_success`로 시작한다.
  - result는 `candidate`, `confirmed`, `dismissed`로 시작한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:18:37.7430611+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 173 tests passed
    verified_at: `2026-07-06T15:18:37.7430611+09:00`
- active_work:
  - current_focus: `DetectionRecord schema and paths`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/state/paths.ts`
    - `tests/detection.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: DetectionRecord schema now validates thrashing/false_success records with candidate/confirmed/dismissed results, flexible evidenceRefs/attributes, and .intent/detections paths; 173 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-05-02 False success structural monitor`를 시작한다.

### FG-05-02 False success structural monitor

- status: `passing`
- phase: Phase 5
- objective: required evidence 없이 complete를 시도한 경우 false_success candidate를 만든다.
- why: 완료 선언을 검증 증거 없이 통과시키지 않기 위해.
- scope:
  - `src/runtime/monitor.ts`
  - `src/runtime/detections.ts`
  - `src/runtime/stop-gate.ts`
  - `tests/monitor.test.mjs`
- dependencies:
  - FG-05-01
  - FG-02-04
- session_boundary: evidence 누락 기반 false_success 후보만 구현한다.
- implementation_notes:
  - LLM Judge는 호출하지 않는다.
  - detection에는 missing check 목록을 포함한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:22:06.6589100+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 176 tests passed
    verified_at: `2026-07-06T15:22:06.6589100+09:00`
- active_work:
  - current_focus: `False success structural monitor`
  - touched_files:
    - `src/runtime/monitor.ts`
    - `src/runtime/detections.ts`
    - `src/runtime/stop-gate.ts`
    - `tests/monitor.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: missingRequiredEvidenceTypes is exported from stop-gate, detections runtime persists candidate JSON, and detectFalseSuccessOnCompletionAttempt writes a false_success candidate with missingEvidenceTypes; 176 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-05-03 Repeated command failure monitor`를 시작한다.

### FG-05-03 Repeated command failure monitor

- status: `passing`
- phase: Phase 5
- objective: 같은 command가 같은 exitCode로 반복 실패하면 thrashing candidate를 만든다.
- why: 같은 검증 명령을 반복 실패하며 진전 없는 상태를 감지하기 위해.
- scope:
  - `src/runtime/monitor.ts`
  - `src/runtime/detections.ts`
  - `tests/monitor.test.mjs`
- dependencies:
  - FG-05-01
  - FG-04-04
- session_boundary: command+exitCode 반복만 탐지한다.
- implementation_notes:
  - 기본 threshold는 3회로 시작한다.
  - threshold는 config로 뺄 수 있지만 초기에는 상수여도 된다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:25:14.3354892+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 178 tests passed
    verified_at: `2026-07-06T15:25:14.3354892+09:00`
- active_work:
  - current_focus: `Repeated command failure monitor`
  - touched_files:
    - `src/runtime/monitor.ts`
    - `src/runtime/detections.ts`
    - `tests/monitor.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: detectRepeatedCommandFailures groups error run_check spans by command+args+exitCode, creates thrashing candidates at threshold 3, and ignores below-threshold or mismatched exitCode spans; 178 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-05-04 Repeated error signature monitor`를 시작한다.

### FG-05-04 Repeated error signature monitor

- status: `passing`
- phase: Phase 5
- objective: 같은 error signature가 반복되면 thrashing candidate를 만든다.
- why: 명령이 달라도 같은 실패가 반복되는 상황을 찾기 위해.
- scope:
  - `src/runtime/monitor.ts`
  - `src/runtime/detections.ts`
  - `tests/monitor.test.mjs`
- dependencies:
  - FG-04-05
  - FG-05-01
- session_boundary: errorSignature 반복 탐지만 구현한다.
- implementation_notes:
  - signature가 비어 있으면 탐지에서 제외한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:28:25.5193045+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 180 tests passed
    verified_at: `2026-07-06T15:28:25.5193045+09:00`
- active_work:
  - current_focus: `Repeated error signature monitor`
  - touched_files:
    - `src/runtime/monitor.ts`
    - `src/runtime/detections.ts`
    - `tests/monitor.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: detectRepeatedErrorSignatures groups non-empty errorSignature values across error run_check spans, creates thrashing candidates at threshold 3 even when commands differ, and ignores blank/below-threshold signatures; 180 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-05-05 Detection CLI list/show/resolve`를 시작한다.

### FG-05-05 Detection CLI list/show/resolve

- status: `passing`
- phase: Phase 5
- objective: detection을 조회하고 dismiss/resolve할 수 있는 CLI를 추가한다.
- why: 탐지 결과를 사람이 검토하고 다음 조치를 결정할 수 있어야 한다.
- scope:
  - `src/cli/index.ts`
  - `src/runtime/detections.ts`
  - `tests/detection-cli.test.mjs`
- dependencies:
  - FG-05-01
- session_boundary: `list`, `show`, `resolve`만 구현한다.
- implementation_notes:
  - resolve는 사람 판단이므로 AI 환경에서 제한할지 정책이 필요하다. 초기에는 complete/approve와 같은 human-only 후보로 본다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:44:31.3579019+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 184 tests passed
    verified_at: `2026-07-06T15:44:31.3579019+09:00`
- active_work:
  - current_focus: `Detection CLI`
  - touched_files:
    - `src/cli/index.ts`
    - `src/runtime/detections.ts`
    - `tests/detection-cli.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: intent detection list/show/resolve now prints and updates detection records; resolve accepts confirmed/dismissed with a resolution note and is human-only; 184 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-06-01 Detection to failure wiki page`를 시작한다.

## Phase 6: LLM-Wiki ingest and rule candidate automation

목표: Detection Record를 장기 기억과 재발 방지 후보로 전환한다.

### FG-06-01 Detection to failure wiki page

- status: `passing`
- phase: Phase 6
- objective: Detection Record를 failure/issue wiki page로 변환한다.
- why: 반복 실패를 단순 JSON이 아니라 다음 세션에서 읽히는 지식으로 축적하기 위해.
- scope:
  - `src/runtime/wiki.ts`
  - `src/runtime/postmortem.ts`
  - `src/runtime/detections.ts`
  - `tests/wiki.test.mjs`
  - `tests/postmortem.test.mjs`
- dependencies:
  - FG-05-01
- session_boundary: detection 하나를 wiki page 하나로 변환하는 기능만 구현한다.
- implementation_notes:
  - 기존 `recordPostmortem`을 재사용하거나 detection 전용 wrapper를 둔다.
  - raw log path와 trace/span ids를 본문에 포함한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:47:28.1309762+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 186 tests passed
    verified_at: `2026-07-06T15:47:28.1309762+09:00`
- active_work:
  - current_focus: `Detection to wiki page`
  - touched_files:
    - `src/runtime/wiki.ts`
    - `src/runtime/postmortem.ts`
    - `src/runtime/detections.ts`
    - `tests/wiki.test.mjs`
    - `tests/postmortem.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: recordDetectionWikiPage now converts a detection into one problem wiki page, candidate detections become open issues, body includes evidence refs and attributes, and 186 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-06-02 Rule candidate links to detection`을 시작한다.

### FG-06-02 Rule candidate links to detection

- status: `passing`
- phase: Phase 6
- objective: detection에서 만든 rule draft가 `sourceDetectionId`를 가진다.
- why: 규칙 후보가 어떤 실패에서 왔는지 추적 가능해야 한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/rules.ts`
  - `src/runtime/postmortem.ts`
  - `tests/rules.test.mjs`
- dependencies:
  - FG-05-01
  - FG-06-01
- session_boundary: rule schema와 draft 생성만 확장한다.
- implementation_notes:
  - 기존 rule JSON과 호환되도록 optional field로 추가한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:49:56.2246510+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 188 tests passed
    verified_at: `2026-07-06T15:49:56.2246510+09:00`
- active_work:
  - current_focus: `Rule sourceDetectionId`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/rules.ts`
    - `src/runtime/postmortem.ts`
    - `tests/rules.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Rule schema now defaults sourceDetectionId to null for old JSON, draftRule can persist sourceDetectionId, recordPostmortem forwards it to rule drafts, and 188 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-06-03 Wiki lint reports un-ingested detections`를 시작한다.

### FG-06-03 Wiki lint reports un-ingested detections

- status: `passing`
- phase: Phase 6
- objective: wiki lint가 아직 wiki로 ingest되지 않은 detection을 보고한다.
- why: 실패 기록이 장기 기억으로 전환되지 않고 방치되는 것을 막기 위해.
- scope:
  - `src/runtime/wiki.ts`
  - `src/runtime/detections.ts`
  - `src/cli/index.ts`
  - `tests/wiki.test.mjs`
- dependencies:
  - FG-06-01
- session_boundary: lint report에 un-ingested detection 목록만 추가한다.
- implementation_notes:
  - 기존 `lintWiki(articles)` 순수 함수는 유지하고, fs wrapper를 별도로 둘 수 있다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:53:14.1745030+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 189 tests passed
    verified_at: `2026-07-06T15:53:14.1745030+09:00`
- active_work:
  - current_focus: `Wiki lint un-ingested detections`
  - touched_files:
    - `src/runtime/detections.ts`
    - `src/cli/index.ts`
    - `tests/wiki.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `unIngestedDetections` reports detections without detection wiki pages, `intent wiki lint` prints un-ingested detection IDs, `lintWiki` remains pure, and 189 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-07-01 Judge input bundle builder`를 시작한다.

## Phase 7: Reviewer, Eval, and LLM Judge

목표: deterministic evidence 위에 선택적 의미 판정과 리뷰 자동화를 얹는다.

이 phase는 가장 뒤로 둔다. 구조 evidence가 충분히 쌓이기 전에는 LLM Judge의 품질도 낮고 비용 통제도 어렵다.

### FG-07-01 Judge input bundle builder

- status: `passing`
- phase: Phase 7
- objective: LLM Judge에 넘길 deterministic input bundle을 만든다.
- why: LLM Judge가 전체 로그를 무작정 읽지 않고 구조화된 후보만 판단하게 하기 위해.
- scope:
  - `src/runtime/judge.ts`
  - `src/runtime/detections.ts`
  - `tests/judge.test.mjs`
- dependencies:
  - FG-05-01
  - FG-04-05
- session_boundary: bundle 생성만 구현한다. 실제 LLM 호출은 하지 않는다.
- implementation_notes:
  - hook 안에서 LLM을 호출하지 않는 원칙을 유지한다.
  - bundle에는 detection, evidence summary, related log paths, trace/span ids를 포함한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T15:58:10.4130036+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 191 tests passed
    verified_at: `2026-07-06T15:58:10.4130036+09:00`
- active_work:
  - current_focus: `Judge input bundle builder`
  - touched_files:
    - `src/runtime/judge.ts`
    - `tests/judge.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `buildJudgeInputBundle` builds compact deterministic context from a detection, linked run evidence, related log paths, and run spans without adding any LLM call path; 191 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-07-02 Reviewer checklist generator`를 시작한다.

### FG-07-02 Reviewer checklist generator

- status: `passing`
- phase: Phase 7
- objective: RunState, SprintContract, evidence를 바탕으로 reviewer checklist를 생성한다.
- why: 사람이 검토할 때 요구사항, 검증, 위험을 빠르게 확인하게 하기 위해.
- scope:
  - `src/runtime/reviewer.ts`
  - `tests/reviewer.test.mjs`
- dependencies:
  - FG-03-02
  - FG-02-04
  - FG-05-01
- session_boundary: markdown checklist 생성만 구현한다.
- implementation_notes:
  - 자동 승인하지 않는다.
  - reviewer output은 read-only report로 시작한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T16:02:01.1746868+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 194 tests passed
    verified_at: `2026-07-06T16:02:01.1746868+09:00`
- active_work:
  - current_focus: `Reviewer checklist generator`
  - touched_files:
    - `src/runtime/reviewer.ts`
    - `tests/reviewer.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `buildReviewerChecklist` creates a deterministic read-only markdown checklist from RunState, linked SprintContract, verification evidence, and run detections; passing, failed, and blocked fixtures are covered and 194 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-07-03 Eval case schema`를 시작한다.

### FG-07-03 Eval case schema

- status: `passing`
- phase: Phase 7
- objective: 반복 실패를 eval case로 저장하는 schema를 추가한다.
- why: 같은 실패 패턴을 미래 모델/하네스 변경에서 재검증하기 위해.
- scope:
  - `src/runtime/schemas.ts`
  - `src/state/paths.ts`
  - `tests/evals.test.mjs`
- dependencies:
  - FG-05-01
- session_boundary: schema와 path만 구현한다.
- implementation_notes:
  - 초기에는 `.intent/evals/*.json`로 저장한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T16:06:39.2921147+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 197 tests passed
    verified_at: `2026-07-06T16:06:39.2921147+09:00`
- active_work:
  - current_focus: `Eval case schema`
  - touched_files:
    - `src/runtime/schemas.ts`
    - `src/state/paths.ts`
    - `tests/evals.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: EvalCase schema/status and `.intent/evals/*.json` path helpers were added for detection-derived regression drafts; 197 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-07-04 Detection to eval case`를 시작한다.

### FG-07-04 Detection to eval case

- status: `passing`
- phase: Phase 7
- objective: Detection Record를 eval case draft로 변환한다.
- why: 실패 패턴을 regression suite 후보로 축적하기 위해.
- scope:
  - `src/runtime/evals.ts`
  - `src/runtime/detections.ts`
  - `tests/evals.test.mjs`
- dependencies:
  - FG-07-03
  - FG-05-01
- session_boundary: detection 하나를 eval draft 하나로 변환한다.
- implementation_notes:
  - eval 실행 엔진은 포함하지 않는다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T16:10:59.6895177+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 199 tests passed
    verified_at: `2026-07-06T16:10:59.6895177+09:00`
- active_work:
  - current_focus: `Detection to eval case`
  - touched_files:
    - `src/runtime/evals.ts`
    - `tests/evals.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: Eval runtime now persists draft eval cases and `draftEvalCaseFromDetection` converts false_success and thrashing detections into regression drafts without adding an eval runner; 199 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-H-01 Immutable scratch update cleanup`를 시작한다.

## Cross-phase hardening backlog

아래 기능은 특정 phase 중간에 끼워 넣을 수 있지만, 각각 하나의 세션 단위로 다룬다.

### FG-H-01 Immutable scratch update cleanup

- status: `passing`
- phase: Hardening
- objective: `handoff.appendScratch`의 배열 mutation을 immutable update로 바꾼다.
- why: AGENT 원칙의 "Immutable updates"와 실제 구현을 맞추기 위해.
- scope:
  - `src/runtime/handoff.ts`
  - `tests/handoff.test.mjs`
- dependencies: []
- session_boundary: handoff scratch update만 고친다.
- implementation_notes:
  - 동작 변경 없이 구현 스타일만 정리한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T16:15:15.2009722+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 200 tests passed
    verified_at: `2026-07-06T16:15:15.2009722+09:00`
- active_work:
  - current_focus: `Immutable scratch update cleanup`
  - touched_files:
    - `src/runtime/handoff.ts`
    - `tests/handoff.test.mjs`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: `appendScratch` now writes a new Scratch object without array push mutation, handoff scratch coverage was added, and 200 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-H-02 Windows command guidance`를 시작한다.

### FG-H-02 Windows command guidance

- status: `passing`
- phase: Hardening
- objective: README/AGENT/docs에 Windows PowerShell의 `npm.ps1` 실행 정책과 `npm.cmd` 사용 예시를 명확히 기록한다.
- why: 실제 검증 명령이 셸 정책 때문에 실패하는 혼란을 줄이기 위해.
- scope:
  - `README.md`
  - `AGENT.md`
  - `docs/final-goal-phase-feature-spec.md`
- dependencies: []
- session_boundary: 문서 갱신만 한다.
- implementation_notes:
  - 코드 변경은 포함하지 않는다.
  - Windows PowerShell에서 `npm.ps1` 실행 정책 오류가 나면 `npm.cmd run typecheck`, `npm.cmd test`를 사용한다고 명시한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm.cmd run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-06T16:20:03.8232989+09:00`
  - command: `npm.cmd test`
    exit_code: 0
    log_path: terminal output, 200 tests passed
    verified_at: `2026-07-06T16:20:03.8232989+09:00`
- active_work:
  - current_focus: `Windows command guidance`
  - touched_files:
    - `README.md`
    - `AGENT.md`
    - `docs/final-goal-phase-feature-spec.md`
  - attempted_commands:
    - `npm.cmd run typecheck`
    - `npm.cmd test`
  - last_observation: README, AGENT, and this roadmap now document `npm.cmd` equivalents for Windows PowerShell when `npm.ps1` is blocked by execution policy; 200 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: null

## Phase dependency map

```text
Phase 0
  -> Phase 1 RunState
    -> Phase 2 Verification Evidence
      -> Phase 3 Sprint Contract / Test Matrix
      -> Phase 4 Observability
        -> Phase 5 Monitor / Detection
          -> Phase 6 Wiki ingest / Rule candidate
            -> Phase 7 Reviewer / Eval / LLM Judge
```

Phase 3과 Phase 4는 Phase 2 이후 일부 병렬 진행이 가능하다. 다만 Phase 5는 Phase 2와 Phase 4의 evidence가 있어야 의미가 있다.

## 다음 작업 선택 기준

다음 세션에서 Agent가 작업을 시작할 때는 아래 순서를 따른다.

1. 이 문서에서 `active` 항목이 있는지 확인한다.
2. `active` 항목이 있으면 그 항목의 `active_work`, `attempted_commands`, `last_observation`, `next_action`을 읽고 이어간다.
3. `active` 항목이 없으면 가장 앞 phase의 `not_started` 항목 중 dependencies가 모두 `passing`인 항목을 하나 고른다.
4. 선택한 항목을 `active`로 바꾸고 작업한다.
5. 작업이 끝났다고 판단되면 `verification_commands`를 실행한다.
6. 모든 검증 명령이 성공하면 `passing_evidence`를 채우고 `status`를 `passing`으로 바꾼다.
7. 검증 실패가 반복되거나 외부 판단이 필요하면 `blocked`로 바꾸고 `blocked_reason`, `unblock_condition`, `next_action`을 기록한다.

## Phase 완료 기록 규칙

각 phase가 끝나면 `docs/phase/`에 완료 기록을 남긴다.

완료 기록은 phase 단위 handoff다. 다음 세션의 Agent가 "이 phase에서 실제로 무엇을 했고, 어떤 검증으로 끝났고, 다음 phase는 어디서 시작해야 하는지"를 바로 파악할 수 있어야 한다.

기록 파일은 `docs/phase/phase-<number>-<short-name>.md` 형식을 사용한다. 새 phase 기록을 작성할 때는 `docs/phase/_template.md`를 기준으로 한다.

phase 완료 기록에는 최소한 다음을 포함한다.

- 완료된 기능 항목과 상태
- 실제 수행한 작업
- 성공한 검증 명령과 exit code
- 변경 파일
- phase 중 결정한 사항
- 남은 위험
- 다음 phase의 시작 기능 항목

현재 완료된 phase 기록:

- `docs/phase/phase-0-roadmap-and-operating-rules.md`
- `docs/phase/phase-1-runstate-schema-and-paths.md`
- `docs/phase/phase-1-runstate-runtime-crud.md`
- `docs/phase/phase-1-run-cli.md`
- `docs/phase/phase-1-sessionstart-active-run.md`
- `docs/phase/phase-1-handoff-active-run.md`
- `docs/phase/phase-2-verification-evidence-schema-and-paths.md`
- `docs/phase/phase-2-verification-command-runner.md`
- `docs/phase/phase-2-verify-cli.md`
- `docs/phase/phase-2-completion-gate-required-evidence.md`
- `docs/phase/phase-2-setup-run-raw-directories.md`
- `docs/phase/phase-3-test-matrix-schema.md`
- `docs/phase/phase-3-sprint-contract-schema-runtime.md`
- `docs/phase/phase-3-contract-cli.md`
- `docs/phase/phase-3-forbidden-scope-gate.md`
- `docs/phase/phase-4-trace-span-schema.md`
- `docs/phase/phase-4-span-writer-runtime.md`
- `docs/phase/phase-4-pre-write-hook-edit-spans.md`
- `docs/phase/phase-4-verify-command-spans.md`
- `docs/phase/phase-4-error-signature-extraction.md`
- `docs/phase/phase-5-detection-record-schema-paths.md`
- `docs/phase/phase-5-false-success-structural-monitor.md`
- `docs/phase/phase-5-repeated-command-failure-monitor.md`
- `docs/phase/phase-5-repeated-error-signature-monitor.md`
- `docs/phase/phase-5-detection-cli-list-show-resolve.md`
- `docs/phase/phase-6-detection-to-failure-wiki-page.md`
- `docs/phase/phase-6-rule-candidate-links-to-detection.md`
- `docs/phase/phase-6-wiki-lint-un-ingested-detections.md`
- `docs/phase/phase-7-judge-input-bundle-builder.md`
- `docs/phase/phase-7-reviewer-checklist-generator.md`
- `docs/phase/phase-7-eval-case-schema.md`
- `docs/phase/phase-7-detection-to-eval-case.md`
- `docs/phase/phase-hardening-immutable-scratch-update-cleanup.md`
- `docs/phase/phase-hardening-windows-command-guidance.md`

## 현재 추천 시작점

구현할 다음 기능 항목은 없다. `docs/final-goal-phase-feature-spec.md`의 정규 phase와 hardening backlog는 모두 passing이다.

이유:

- `FG-01-01`에서 RunState schema와 `.intent/runs` 경로가 검증 완료되었다.
- `FG-01-02`에서 CLI와 hook이 사용할 검증된 runtime CRUD가 추가되었다.
- `FG-01-03`에서 사용자가 RunState를 직접 시작, 조회, 기록할 수 있는 `intent run` 명령이 추가되었다.
- `FG-01-04`에서 새 세션이 active run의 objective, status, nextAction, 최근 note를 즉시 볼 수 있게 SessionStart memory가 확장되었다.
- `FG-01-05`에서 압축 직전 handoff에도 active run 상태, 다음 행동, 최근 note가 남도록 확장되었다.
- `FG-02-01`에서 VerificationEvidence schema, RunState evidence 필드, `.intent/raw/<type>-results` 경로 helper가 추가되었다.
- `FG-02-02`에서 실제 검증 명령을 실행해 stdout/stderr raw log와 exit code를 RunState evidence에 연결하는 runtime이 추가되었다.
- `FG-02-03`에서 Agent와 사용자가 동일하게 사용할 수 있는 `intent verify <type> -- <command...>` CLI와 `intent verify list`가 추가되었다.
- `FG-02-04`에서 active run의 `requiredEvidenceTypes`가 completion/stop gate에 연결되어 필수 검증 evidence가 없거나 실패하면 완료를 막는다.
- `FG-02-05`에서 새 프로젝트 setup 때 runs/raw 관련 디렉터리가 준비되도록 했다.
- Phase 2는 모두 passing이다.
- `FG-03-01`에서 작업 유형별 TestMatrix schema와 intent type 기반 default matrix 함수가 추가되었다.
- `FG-03-02`에서 Run의 평가 기준과 allowed/forbidden scope, required checks, DoD를 보존하는 SprintContract schema/runtime이 추가되었다.
- `FG-03-03`에서 사람이 contract를 생성/조회/목록화할 수 있는 `intent contract draft/show/list` CLI가 추가되었다.
- `FG-03-04`에서 active run에 연결된 contract의 `forbiddenScope`가 pre-write guard에 연결되어 문서상 금지 범위를 실제 변경 gate로 강제한다.
- Phase 3은 모두 passing이다.
- `FG-04-01`에서 Trace/Span schema와 raw observability trace/span paths가 추가되었다.
- `FG-04-02`에서 active run에 span을 append하고 조회하는 writer runtime이 추가되었다.
- `FG-04-03`에서 pre-write guard가 검사한 edit/apply_patch 변경을 failure-safe span으로 남기도록 연결되었다.
- `FG-04-04`에서 `intent verify`가 passed/failed command를 run_check span으로 남기도록 연결되었다.
- `FG-04-05`에서 stderr/TAP 기반 deterministic error signature 추출과 failed span attribute 연결이 추가되었다.
- Phase 4는 모두 passing이다.
- `FG-05-01`에서 DetectionRecord schema와 `.intent/detections` 경로가 추가되었다.
- `FG-05-02`에서 completion attempt 컨텍스트의 missing required evidence를 false_success candidate로 저장하는 structural monitor가 추가되었다.
- `FG-05-03`에서 같은 command+args+exitCode가 3회 반복 실패하면 thrashing candidate를 만드는 monitor가 추가되었다.
- `FG-05-04`에서 command가 달라도 같은 errorSignature가 3회 반복되면 thrashing candidate를 만드는 monitor가 추가되었다.
- `FG-05-05`에서 detection list/show/resolve CLI가 추가되었고 resolve는 human-only로 제한되었다.
- Phase 5는 모두 passing이다.
- `FG-06-01`에서 Detection Record를 failure/issue wiki page로 변환하는 runtime이 추가되었다.
- `FG-06-02`에서 rule draft가 sourceDetectionId를 보존하도록 schema/runtime이 확장되었다.
- `FG-06-03`에서 wiki lint가 아직 wiki로 ingest되지 않은 detection id를 보고하도록 확장되었다.
- Phase 6은 모두 passing이다.
- `FG-07-01`에서 detection, evidence, trace/span 정보를 LLM Judge에 넘길 deterministic bundle로 묶는 runtime이 추가되었다.
- `FG-07-02`에서 RunState, SprintContract, evidence, detection 정보를 사람이 읽을 수 있는 reviewer checklist로 변환하는 runtime이 추가되었다.
- `FG-07-03`에서 반복 실패를 미래 회귀 검증에 쓸 eval case schema/path 기반이 추가되었다.
- `FG-07-04`에서 Detection Record 하나를 eval draft 하나로 변환하는 runtime이 추가되었다.
- Phase 7은 모두 passing이다.
- `FG-H-01`에서 handoff scratch update의 배열 mutation을 immutable update로 정리했다.
- `FG-H-02`에서 Windows PowerShell의 `npm.cmd` 사용 guidance를 README/AGENT/docs에 문서화했다.
- 모든 정규 phase와 hardening backlog가 passing이다.

그 다음 기능 항목은 없다.
