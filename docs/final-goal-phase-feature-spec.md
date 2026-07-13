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

## Phase 8: Goal-aligned workflow

목표: `hyohyeon-harness-최종목표.md`의 `Interview -> Plan -> Sprint Contract -> RunState` 흐름을 실제 state와 CLI로 연결한다.

Phase 1-7은 기반 데이터 레이어를 만든 MVP다. Phase 8부터는 최종목표 문서가 요구하는 운영 흐름을 묶는다.

### FG-08-01 Plan schema and paths

- status: `passing`
- phase: Phase 8
- objective: Plan artifact의 schema와 `.intent/plans` 경로를 추가한다.
- why: 최종목표의 Plan은 작업 목표, 문제 정의, 범위, 금지 영역, 테스트 전략, 검증 명령, 완료 조건, 남은 위험을 보존해야 한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/state/paths.ts`
  - `tests/plan.test.mjs`
- dependencies:
  - FG-01-01
  - FG-03-01
- session_boundary: schema, default object, path helper, 단위 테스트까지만 포함한다. CLI는 다음 기능에서 한다.
- implementation_notes:
  - `RunState.planId`와 연결 가능한 `PLAN-001` 형식을 사용한다.
  - Plan은 Intent를 대체하지 않는다. Intent는 승인된 무엇/왜/범위, Plan은 실행 전략이다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-09T00:18:08Z`
  - command: `npm test`
    exit_code: 0
    log_path: terminal output, 223 tests passed
    verified_at: `2026-07-09T00:18:08Z`
- active_work:
  current_focus: `Plan schema and paths`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/state/paths.ts`
    - `tests/plan.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `PlanStatusSchema`, `PlanVerificationCommandSchema`, `PlanSchema`, `.intent/plans`, `PLAN-001` persistence tests were added and the full suite passed.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-08-02 Plan runtime and CLI`를 시작한다.

### FG-08-02 Plan runtime and CLI

- status: `passing`
- phase: Phase 8
- objective: Plan을 생성, 조회, 목록화하고 active run에 연결하는 CLI를 추가한다.
- why: Interview/spec 이후 구현 계획을 RunState의 근거로 남기기 위해.
- scope:
  - `src/runtime/plans.ts`
  - `src/cli/index.ts`
  - `tests/plan-cli.test.mjs`
- dependencies:
  - FG-08-01
- session_boundary: `intent plan draft/show/list/link`까지만 구현한다. 자동 plan 생성은 포함하지 않는다.
- implementation_notes:
  - `intent plan draft "<title>" --scope ... --forbid ... --check ...` 형태를 검토한다.
  - `intent plan link <planId> [runId]`는 RunState의 `planId`를 갱신한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-09T00:18:08Z`
  - command: `npm test`
    exit_code: 0
    log_path: terminal output, 223 tests passed
    verified_at: `2026-07-09T00:18:08Z`
- active_work:
  current_focus: `Plan runtime and CLI`
  touched_files:
    - `src/runtime/plans.ts`
    - `src/cli/index.ts`
    - `tests/plan-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent plan draft/show/list/link` creates plan artifacts, prints strategy fields, and links plans to active runs.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-09-01 Run phase transition CLI`를 시작한다.

## Phase 9: Execution loop and monitor CLI

목표: 실행 중 상태 전이와 반복 실패 탐지를 사용자가 명령으로 실행할 수 있게 한다.

### FG-09-01 Run phase transition CLI

- status: `passing`
- phase: Phase 9
- objective: RunState의 phase/status/nextAction을 명시적으로 갱신하는 CLI를 추가한다.
- why: 최종목표의 Execution Loop는 Agent가 지금 interview/plan/contract/act/verify 중 어디에 있는지 추적해야 한다.
- scope:
  - `src/runtime/runs.ts`
  - `src/cli/index.ts`
  - `tests/run-cli.test.mjs`
- dependencies:
  - FG-01-03
- session_boundary: phase/status/nextAction 갱신만 포함한다. budget 정책은 별도 기능으로 둔다.
- implementation_notes:
  - 허용 phase/status 값은 기존 zod enum을 사용한다.
  - 잘못된 전이는 처음에는 경고 없이 schema validation만 적용한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-09T00:18:08Z`
  - command: `npm test`
    exit_code: 0
    log_path: terminal output, 223 tests passed
    verified_at: `2026-07-09T00:18:08Z`
- active_work:
  current_focus: `Run phase/status/nextAction CLI`
  touched_files:
    - `src/cli/index.ts`
    - `tests/run-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent run phase`, `intent run status-set`, and `intent run next` update active or specified runs through existing RunState validation.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-09-02 Monitor CLI`를 시작한다.

### FG-09-02 Monitor CLI

- status: `passing`
- phase: Phase 9
- objective: 기존 monitor runtime을 호출하는 `intent monitor` CLI를 추가한다.
- why: 현재 repeated failure와 false_success 탐지는 runtime에만 있고 운영자가 직접 실행할 표면이 없다.
- scope:
  - `src/runtime/monitor.ts`
  - `src/cli/index.ts`
  - `tests/monitor-cli.test.mjs`
- dependencies:
  - FG-05-03
  - FG-05-04
  - FG-05-05
- session_boundary: `intent monitor active`와 `intent monitor run <runId>`만 구현한다.
- implementation_notes:
  - 동일 detection이 반복 생성되지 않도록 idempotency 정책을 함께 정의한다.
  - LLM Judge는 포함하지 않는다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-09T00:18:08Z`
  - command: `npm test`
    exit_code: 0
    log_path: terminal output, 223 tests passed
    verified_at: `2026-07-09T00:18:08Z`
- active_work:
  current_focus: `Monitor CLI`
  touched_files:
    - `src/runtime/monitor.ts`
    - `src/cli/index.ts`
    - `tests/monitor-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent monitor active` and `intent monitor run <runId>` call deterministic repeated failure detectors and do not duplicate existing matching detections.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-10-01 Contract requiredChecks completion gate`를 시작한다.

## Phase 10: Contract-centered completion gate

목표: SprintContract가 완료 기준의 중심이 되도록 Stop/complete gate와 reviewer 기준을 통일한다.

### FG-10-01 Contract requiredChecks completion gate

- status: `passing`
- phase: Phase 10
- objective: active run의 contract `requiredChecks`가 complete/stop gate에서 평가되게 한다.
- why: 최종목표에서 Sprint Contract는 작업의 완료 기준이다. 현재는 RunState의 `requiredEvidenceTypes`만 completion gate에 직접 연결되어 있다.
- scope:
  - `src/runtime/stop-gate.ts`
  - `src/runtime/contracts.ts`
  - `src/runtime/intents.ts`
  - `src/cli/index.ts`
  - `tests/stop-gate.test.mjs`
  - `tests/verify-cli.test.mjs`
- dependencies:
  - FG-03-02
  - FG-02-04
- session_boundary: contract requiredChecks 평가만 포함한다. contract approve/edit lifecycle은 별도 기능으로 둔다.
- implementation_notes:
  - RunState에 checks를 복사하기보다, active run의 `contractId`를 따라가 contract를 읽는 방식이 SSOT에 가깝다.
  - 기존 `requiredEvidenceTypes`는 contract가 없을 때의 fallback으로 유지한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  - command: `npm run typecheck`
    exit_code: 0
    log_path: terminal output
    verified_at: `2026-07-09T00:18:08Z`
  - command: `npm test`
    exit_code: 0
    log_path: terminal output, 223 tests passed
    verified_at: `2026-07-09T00:18:08Z`
- active_work:
  current_focus: `Contract requiredChecks completion gate`
  touched_files:
    - `src/runtime/stop-gate.ts`
    - `src/runtime/intents.ts`
    - `src/cli/index.ts`
    - `tests/stop-gate.test.mjs`
    - `tests/verify-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `complete` and `stop-check` now evaluate active contract `requiredChecks`; run-level `requiredEvidenceTypes` remains the fallback only when no matching contract is present.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-11-01 Judge/reviewer/eval read-only CLI`를 시작한다.

## Phase 11: Judge, reviewer, and eval CLI

목표: Phase 7에서 만든 runtime을 사용자 workflow로 노출한다.

### FG-11-01 Judge/reviewer/eval read-only CLI

- status: `passing`
- phase: Phase 11
- objective: `judge`, `reviewer`, `eval` runtime을 read-only 또는 draft 생성 CLI로 노출한다.
- why: 최종목표의 Reviewer/Eval/Judge 흐름은 현재 runtime 함수로만 존재한다.
- scope:
  - `src/cli/index.ts`
  - `src/runtime/judge.ts`
  - `src/runtime/reviewer.ts`
  - `src/runtime/evals.ts`
  - `tests/judge-cli.test.mjs`
  - `tests/reviewer-cli.test.mjs`
  - `tests/eval-cli.test.mjs`
- dependencies:
  - FG-07-01
  - FG-07-02
  - FG-07-04
- session_boundary: `intent judge bundle`, `intent reviewer checklist`, `intent eval draft-from-detection`만 구현한다. 외부 LLM 호출과 eval runner는 포함하지 않는다.
- implementation_notes:
  - hook 안에서 LLM 호출을 하지 않는 deterministic 원칙을 유지한다.
  - CLI 출력은 파일 저장보다 stdout 우선으로 시작한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:35:23+09:00`
- active_work:
  current_focus: `Judge/reviewer/eval read-only CLI`
  touched_files:
    - `src/cli/index.ts`
    - `tests/judge-cli.test.mjs`
    - `tests/reviewer-cli.test.mjs`
    - `tests/eval-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent judge bundle`, `intent reviewer checklist`, `intent eval draft-from-detection` CLI가 추가되었고 전체 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-12-01 Detection ingest and rule draft CLI`를 시작한다.

## Phase 12: Rule feedback loop

목표: Detection이 wiki, rule, eval, AGENTS candidate로 환류되는 흐름을 만든다.

### FG-12-01 Detection ingest and rule draft CLI

- status: `passing`
- phase: Phase 12
- objective: detection을 wiki page와 rule draft로 전환하는 CLI를 추가한다.
- why: 최종목표는 실패 기록이 단순 로그가 아니라 재발 방지 규칙으로 전환되는 구조를 요구한다.
- scope:
  - `src/cli/index.ts`
  - `src/runtime/detections.ts`
  - `src/runtime/rules.ts`
  - `tests/detection-cli.test.mjs`
  - `tests/wiki.test.mjs`
- dependencies:
  - FG-06-01
  - FG-06-02
- session_boundary: `intent wiki ingest detection <id>`와 `intent rule draft-from-detection <id> ...`만 구현한다.
- implementation_notes:
  - rule approval은 계속 human-only로 유지한다.
  - AGENTS.md patch generation은 다음 기능으로 둔다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:35:23+09:00`
- active_work:
  current_focus: `Detection ingest and rule draft CLI`
  touched_files:
    - `src/cli/index.ts`
    - `tests/feedback-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent wiki ingest detection <id>`와 `intent rule draft-from-detection <id> ...`가 추가되었고 전체 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-13-01 Execution loop budget and blocked policy`를 시작한다.

## Phase 13: Execution loop blocked policy

목표: 반복 실패와 예산 초과가 RunState의 blocked 전이와 nextAction으로 남게 한다.

### FG-13-01 Execution loop budget and blocked policy

- status: `passing`
- phase: Phase 13
- objective: run attempt budget, attempt 기록 CLI, monitor detection 기반 blocked 전이 정책을 추가한다.
- why: 최종목표의 Execution Loop는 실패를 계속 반복하기보다 명시적으로 멈추고 다음 판단을 남겨야 한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/runs.ts`
  - `src/cli/index.ts`
  - `tests/run-state.test.mjs`
  - `tests/run-cli.test.mjs`
  - `tests/monitor-cli.test.mjs`
- dependencies:
  - FG-09-01
  - FG-09-02
- session_boundary: budget/attempt와 monitor blocked 전이만 포함한다. 일반 shell command tracing은 포함하지 않는다.
- implementation_notes:
  - `RunState.budget`은 `{ maxAttempts, attemptsUsed }`로 기본 3회다.
  - `intent run budget <maxAttempts> [runId]`, `intent run attempt ["note"] [runId]`를 제공한다.
  - monitor가 detection을 만들면 run을 `blocked`로 바꾸고 `nextAction`을 기록한다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:35:23+09:00`
- active_work:
  current_focus: `Execution loop budget and blocked policy`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/runs.ts`
    - `src/cli/index.ts`
    - `tests/run-state.test.mjs`
    - `tests/run-cli.test.mjs`
    - `tests/monitor-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: run budget/attempt CLI와 monitor blocked 전이 테스트가 추가되었고 전체 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-14-01 Contract lifecycle, rubric, and report CLI`를 시작한다.

## Phase 14: Contract lifecycle and report

목표: SprintContract가 승인, 보강, 리포트 가능한 완료 기준 artifact가 되게 한다.

### FG-14-01 Contract lifecycle, rubric, and report CLI

- status: `passing`
- phase: Phase 14
- objective: contract approve/edit/report CLI와 rubric, stopConditions, requiresUserDecision 필드를 추가한다.
- why: Contract가 단순 생성물이 아니라 사람이 승인하고 실행 중 판단 기준으로 확인하는 SSOT가 되어야 한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/contracts.ts`
  - `src/cli/index.ts`
  - `tests/contracts.test.mjs`
  - `tests/contract-cli.test.mjs`
- dependencies:
  - FG-10-01
- session_boundary: contract lifecycle과 requiredChecks report만 포함한다. Reviewer 자동 승인이나 CI 연동은 포함하지 않는다.
- implementation_notes:
  - contract approval은 human-only CLI로 유지한다.
  - report는 contract `requiredChecks`를 linked run evidence와 비교해 `passed`, `failed`, `missing`으로 보여준다.
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:35:23+09:00`
- active_work:
  current_focus: `Contract lifecycle, rubric, and report CLI`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/contracts.ts`
    - `src/cli/index.ts`
    - `tests/contracts.test.mjs`
    - `tests/contract-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: contract approve/edit/report CLI와 rubric/stop/user-decision 필드가 추가되었고 전체 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-15-01 Judge/eval/rule follow-up persistence`를 시작한다.

## Phase 15: Judge, eval, and rule follow-up persistence

목표: 판정과 회귀 케이스, AGENTS 후보가 Detection/Rule/Eval artifact에 남도록 한다.

### FG-15-01 Judge/eval/rule follow-up persistence

- status: `passing`
- phase: Phase 15
- objective: judge result 저장, eval runner, rule AGENTS candidate 출력 CLI를 추가한다.
- why: 최종목표의 feedback loop는 탐지를 사람이 판단하고, 회귀 eval과 운영 문서 후보로 남기는 흐름까지 포함한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/detections.ts`
  - `src/runtime/evals.ts`
  - `src/runtime/rules.ts`
  - `src/cli/index.ts`
  - `tests/detection.test.mjs`
  - `tests/judge-cli.test.mjs`
  - `tests/evals.test.mjs`
  - `tests/eval-cli.test.mjs`
  - `tests/rules.test.mjs`
  - `tests/feedback-cli.test.mjs`
- dependencies:
  - FG-11-01
  - FG-12-01
- session_boundary: deterministic 저장/runner/candidate 출력만 포함한다. 외부 LLM judge adapter와 AGENTS.md 자동 편집은 포함하지 않는다.
- implementation_notes:
  - `intent judge record <detectionId> <pass|fail|uncertain> "<judgement>" [--confidence N]`
  - `intent eval run [evalId]`
  - `intent rule agents-candidate <ruleId>`
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:35:23+09:00`
- active_work:
  current_focus: `Judge/eval/rule follow-up persistence`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/detections.ts`
    - `src/runtime/evals.ts`
    - `src/runtime/rules.ts`
    - `src/cli/index.ts`
    - `tests/detection.test.mjs`
    - `tests/judge-cli.test.mjs`
    - `tests/evals.test.mjs`
    - `tests/eval-cli.test.mjs`
    - `tests/rules.test.mjs`
    - `tests/feedback-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: judge result persists on detections, eval runner stores `lastRun`, rule AGENTS candidate output is available, and the full suite passed at Phase 15 closure.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-16-01 Completion/Stop monitor automation`를 시작한다.

## Phase 16: Automation loop closure

목표: Phase 15까지의 수동 운영 루프를 complete/stop, judge adapter, rule impact, monitor 확장, spec/plan 연결, AGENTS/CI 반영 추적으로 닫는다.

### FG-16-01 Completion/Stop monitor automation

- status: `passing`
- phase: Phase 16
- objective: `intent complete`, `intent stop-check`, Stop hook에서 completion/monitor detection을 자동 생성하고 run을 blocked로 전환한다.
- why: 운영자가 별도로 `intent monitor`를 실행하지 않아도 false_success와 thrashing 후보가 남아야 한다.
- scope:
  - `src/runtime/monitor.ts`
  - `src/cli/index.ts`
  - `hooks/stop-continue.ts`
  - `tests/verify-cli.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-13-01
  - FG-15-01
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:53:33+09:00`
- active_work:
  current_focus: `Completion/Stop monitor automation`
  touched_files:
    - `src/runtime/monitor.ts`
    - `src/cli/index.ts`
    - `hooks/stop-continue.ts`
    - `tests/verify-cli.test.mjs`
    - `tests/codex-hooks.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `complete`, `stop-check`, Stop hook now create false_success detections from required evidence gaps and block runs; repeated monitor detections also block completion.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-16-02 External Judge adapter CLI`를 시작한다.

### FG-16-02 External Judge adapter CLI

- status: `passing`
- phase: Phase 16
- objective: 외부 judge command adapter를 추가해 `JudgeInputBundle`을 stdin으로 넘기고 JSON 판정을 `DetectionRecord.judge`에 저장한다.
- why: LLM Judge는 hook 밖에서 후보 detection에 대해서만 실행되어야 한다.
- scope:
  - `src/runtime/judge-adapter.ts`
  - `src/cli/index.ts`
  - `tests/judge-cli.test.mjs`
- dependencies:
  - FG-15-01
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:53:33+09:00`
- active_work:
  current_focus: `External Judge adapter CLI`
  touched_files:
    - `src/runtime/judge-adapter.ts`
    - `src/cli/index.ts`
    - `tests/judge-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent judge run <detectionId> -- <command...>` passes the bundle over stdin and records pass/fail/uncertain JSON output.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-16-03 Approved rule impact report`를 시작한다.

### FG-16-03 Approved rule impact report

- status: `passing`
- phase: Phase 16
- objective: approved/draft rule의 hook enforcement와 AGENTS/CI reflection 상태를 report로 확인한다.
- why: rule이 draft로 남았는지, hook에서 강제되는지, 운영 문서/CI에 반영됐는지 추적해야 한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/rules.ts`
  - `src/cli/index.ts`
  - `tests/rules.test.mjs`
  - `tests/feedback-cli.test.mjs`
- dependencies:
  - FG-15-01
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:53:33+09:00`
- active_work:
  current_focus: `Approved rule impact report`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/rules.ts`
    - `src/cli/index.ts`
    - `tests/rules.test.mjs`
    - `tests/feedback-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent rule impact <ruleId>` reports hook enforcement and reflection state.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-16-04 Monitor repeated file edits`를 시작한다.

### FG-16-04 Monitor repeated file edits

- status: `passing`
- phase: Phase 16
- objective: edit/apply_patch spans에서 같은 파일 반복 수정 thrashing 후보를 탐지한다.
- why: 반복 명령 실패 외에도 같은 파일을 계속 고치는 패턴은 실행 루프의 thrashing 신호다.
- scope:
  - `src/runtime/monitor.ts`
  - `tests/monitor.test.mjs`
- dependencies:
  - FG-05-03
  - FG-04-03
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:53:33+09:00`
- active_work:
  current_focus: `Monitor repeated file edits`
  touched_files:
    - `src/runtime/monitor.ts`
    - `tests/monitor.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `detectRepeatedFileEdits` creates deterministic thrashing detections from repeated edit/apply_patch spans.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-16-05 Spec/Plan automatic run linking`를 시작한다.

### FG-16-05 Spec/Plan automatic run linking

- status: `passing`
- phase: Phase 16
- objective: spec draft/link와 plan draft가 active run의 `specSlug`/`planId`/`runId`를 자동 연결한다.
- why: Interview Summary -> Plan -> RunState 연결을 수동 후처리 없이 보존하기 위해.
- scope:
  - `src/runtime/spec.ts`
  - `src/cli/index.ts`
  - `tests/spec-cli.test.mjs`
  - `tests/plan-cli.test.mjs`
- dependencies:
  - FG-08-02
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:53:33+09:00`
- active_work:
  current_focus: `Spec/Plan automatic run linking`
  touched_files:
    - `src/runtime/spec.ts`
    - `src/cli/index.ts`
    - `tests/spec-cli.test.mjs`
    - `tests/plan-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent spec draft` links the active run, `intent spec link` links explicit runs, and `intent plan draft` auto-links to the active run.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-16-06 Rule AGENTS/CI reflection loop`를 시작한다.

### FG-16-06 Rule AGENTS/CI reflection loop

- status: `passing`
- phase: Phase 16
- objective: rule AGENTS/CI candidate 출력과 reflection 상태 기록을 추가한다.
- why: 실패 -> rule -> AGENTS/CI 반영이 후보 출력으로 끝나지 않고 추적 가능한 loop가 되어야 한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/rules.ts`
  - `src/cli/index.ts`
  - `tests/rules.test.mjs`
  - `tests/feedback-cli.test.mjs`
- dependencies:
  - FG-16-03
- verification_commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-09T11:53:33+09:00`
- active_work:
  current_focus: `Rule AGENTS/CI reflection loop`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/rules.ts`
    - `src/cli/index.ts`
    - `tests/rules.test.mjs`
    - `tests/feedback-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent rule ci-candidate`, `intent rule reflect`, and `intent rule impact` close the manual reflection loop; 249 tests passed.
- blocked_reason: null
- unblock_condition: null
- next_action: 다음 큰 축은 structured InterviewSummary artifact, plan approval lifecycle, general shell command tracing, semantic monitor 중 하나를 별도 intent로 쪼개는 것이다.

## Phase 17: Governed completion integrity

목표: 완료 판정이 active run의 유무나 과거 통과 evidence에 의해 우회되지 않도록, Intent별 governed run과 최신 evidence를 기준으로 CLI와 Stop hook을 통합한다.

### FG-17-01 Governed completion and latest evidence

- status: `passing`
- phase: Phase 17
- objective: feature/fix completion에 동일 Intent의 최신 governed run을 요구하고, required evidence와 contract report를 각 유형의 최신 결과로 판정한다.
- why: blocked 전이로 active run이 사라진 뒤 두 번째 완료 시도가 통과하거나, 과거 pass 뒤의 최신 fail이 무시되는 완료 우회를 막아야 한다.
- scope:
  - `src/runtime/runs.ts`
  - `src/runtime/stop-gate.ts`
  - `src/runtime/completion.ts`
  - `src/runtime/contracts.ts`
  - `src/cli/index.ts`
  - `hooks/stop-continue.ts`
  - `tests/runs.test.mjs`
  - `tests/stop-gate.test.mjs`
  - `tests/run-cli.test.mjs`
  - `tests/verify-cli.test.mjs`
  - `tests/contract-cli.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-10-01
  - FG-16-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Governed completion and latest evidence`
  touched_files:
    - `src/runtime/runs.ts`
    - `src/runtime/stop-gate.ts`
    - `src/runtime/completion.ts`
    - `src/runtime/contracts.ts`
    - `src/cli/index.ts`
    - `hooks/stop-continue.ts`
    - `tests/runs.test.mjs`
    - `tests/stop-gate.test.mjs`
    - `tests/run-cli.test.mjs`
    - `tests/verify-cli.test.mjs`
    - `tests/contract-cli.test.mjs`
    - `tests/codex-hooks.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: active run과 governed run이 분리됐고 blocked/paused/passing Run도 완료 판정에 남는다. 각 evidence type의 최신 결과가 completion과 contract report를 결정하며 전체 258개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: Plan/Contract approval lifecycle과 Run phase transition을 강화한다.

## Phase 18: Approval lifecycle and Run FSM

목표: 승인 전후 artifact의 의미를 분리하고, 승인된 실행 계약과 completion gate만이 실제 scope 정책과 Run terminal 상태를 바꾸게 한다.

### FG-18-01 Plan/Contract approval integrity

- status: `passing`
- phase: Phase 18
- objective: Plan/Contract 승인 메타데이터와 승인 후 불변성을 추가하고 approved Contract만 scope/completion policy에 적용한다.
- why: draft가 승인 없이 실행 정책을 바꾸거나 승인된 계약이 사후 수정되면 사람 승인이 이해의 증거가 될 수 없다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/plans.ts`
  - `src/runtime/contracts.ts`
  - `src/runtime/stop-gate.ts`
  - `src/runtime/completion.ts`
  - `src/cli/index.ts`
  - `hooks/pre-write-guard.ts`
  - `tests/plan.test.mjs`
  - `tests/plan-cli.test.mjs`
  - `tests/contracts.test.mjs`
  - `tests/contract-cli.test.mjs`
  - `tests/stop-gate.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-14-01
  - FG-17-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Plan/Contract approval integrity`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/plans.ts`
    - `src/runtime/contracts.ts`
    - `src/runtime/stop-gate.ts`
    - `src/runtime/completion.ts`
    - `src/cli/index.ts`
    - `hooks/pre-write-guard.ts`
    - `tests/plan.test.mjs`
    - `tests/plan-cli.test.mjs`
    - `tests/contracts.test.mjs`
    - `tests/contract-cli.test.mjs`
    - `tests/stop-gate.test.mjs`
    - `tests/codex-hooks.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: Plan/Contract는 사람 승인자와 시각을 저장하고 승인 후 불변이다. Draft Contract는 강제되지 않으며 approved Contract만 allowed/forbidden scope와 completion checks에 적용된다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-18-02 Run phase FSM and completion terminal`을 시작한다.

### FG-18-02 Run phase FSM and completion terminal

- status: `passing`
- phase: Phase 18
- objective: Run phase 전이를 명시적 FSM으로 제한하고 `done/passing` terminal 상태를 completion evaluator 뒤에서만 설정한다.
- why: 임의 `run phase done`이 완료 증거 없이 terminal 상태를 만들면 governed completion 정책과 Run 기록이 서로 모순된다.
- scope:
  - `src/runtime/runs.ts`
  - `src/cli/index.ts`
  - `tests/runs.test.mjs`
  - `tests/run-cli.test.mjs`
  - `tests/verify-cli.test.mjs`
- dependencies:
  - FG-09-01
  - FG-17-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Run phase FSM and completion terminal`
  touched_files:
    - `src/runtime/runs.ts`
    - `src/cli/index.ts`
    - `tests/runs.test.mjs`
    - `tests/run-cli.test.mjs`
    - `tests/verify-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: 순방향 phase와 `verify -> act` 재작업만 허용되고 direct done은 거부된다. 성공한 complete는 governed Run을 `passing/done`으로 정규화하며 전체 268개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: structured InterviewSummary artifact와 spec/plan/run lineage를 구현한다.

## Phase 19: Structured InterviewSummary and lineage

목표: Interview 결과를 schema-validated first-class artifact로 보존하고 User Goal에서 Spec/Plan/Run까지의 근거 사슬을 자동 연결한다.

### FG-19-01 Structured InterviewSummary artifact

- status: `passing`
- phase: Phase 19
- objective: Interview의 목표·맥락·제약·성공/실패 기준·검증·비목표·가정·질문을 JSON artifact와 CLI로 보존한다.
- why: 위키 spec만으로는 Interview 원본 구조와 승인 상태를 기계적으로 검증하거나 downstream lineage의 시작점을 식별할 수 없다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/interviews.ts`
  - `src/state/paths.ts`
  - `src/cli/index.ts`
  - `tests/interviews.test.mjs`
  - `tests/interview-cli.test.mjs`
- dependencies:
  - FG-16-05
  - FG-18-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Structured InterviewSummary artifact`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/interviews.ts`
    - `src/state/paths.ts`
    - `src/cli/index.ts`
    - `tests/interviews.test.mjs`
    - `tests/interview-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent interview draft/show/list/link/approve`가 structured summary를 저장하고, 사람 승인 뒤 본문은 불변이며 downstream 참조만 append-only로 갱신된다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-19-02 Interview-to-Run lineage propagation`을 시작한다.

### FG-19-02 Interview-to-Run lineage propagation

- status: `passing`
- phase: Phase 19
- objective: Interview 참조를 RunState와 Plan에 저장하고 Spec/Plan 생성 및 session context에 자동 전파한다.
- why: artifact가 존재해도 다음 단계가 그 근거를 참조하지 않으면 context compaction과 새 세션에서 목표 출처가 다시 끊긴다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/runs.ts`
  - `src/runtime/plans.ts`
  - `src/runtime/memory.ts`
  - `src/runtime/handoff.ts`
  - `src/cli/index.ts`
  - `skills/interview/SKILL.md`
  - `tests/interview-cli.test.mjs`
  - `tests/run-state.test.mjs`
  - `tests/plan.test.mjs`
  - `tests/memory.test.mjs`
  - `tests/handoff.test.mjs`
- dependencies:
  - FG-19-01
  - FG-16-05
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Interview-to-Run lineage propagation`
  touched_files:
    - `src/runtime/runs.ts`
    - `src/runtime/plans.ts`
    - `src/runtime/memory.ts`
    - `src/runtime/handoff.ts`
    - `src/cli/index.ts`
    - `skills/interview/SKILL.md`
    - `tests/interview-cli.test.mjs`
    - `tests/run-state.test.mjs`
    - `tests/plan.test.mjs`
    - `tests/memory.test.mjs`
    - `tests/handoff.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `run start --interview`, `spec draft --interview`, `plan draft`가 Interview -> Intent/Spec/Plan/Run lineage를 자동 보존하고 SessionStart/handoff에 노출한다. 전체 276개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: general shell command tracing을 Run observability에 연결한다.

## Phase 20: General command tracing

목표: `intent verify` 밖의 일반 shell command를 raw log와 Run span으로 보존하고 반복 실패 monitor의 입력으로 연결한다.

### FG-20-01 Command wrapper and observed command runtime

- status: `passing`
- phase: Phase 20
- objective: 실행 또는 관측된 일반 command의 cwd/output/exit code/log/error signature를 `run_command` span으로 저장한다.
- why: verification 명령만 추적하면 구현 중 실패·재시도·도구 행동의 대부분이 observability에서 사라진다.
- scope:
  - `src/runtime/commands.ts`
  - `src/state/paths.ts`
  - `src/cli/index.ts`
  - `tests/commands.test.mjs`
  - `tests/command-cli.test.mjs`
- dependencies:
  - FG-04-02
  - FG-04-05
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `General command wrapper and runtime`
  touched_files:
    - `src/runtime/commands.ts`
    - `src/state/paths.ts`
    - `src/cli/index.ts`
    - `tests/commands.test.mjs`
    - `tests/command-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: `intent command -- <command...>`가 stdout/stderr와 wrapped exit code를 전달하면서 raw log와 `run_command` span을 저장한다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-20-02 PostToolUse command hook and monitor input`을 시작한다.

### FG-20-02 PostToolUse command hook and monitor input

- status: `passing`
- phase: Phase 20
- objective: 지원되는 Agent Bash 결과를 PostToolUse에서 관측하고 일반 command 실패를 repeated command/error signature detection에 포함한다.
- why: agent가 wrapper를 명시적으로 선택하지 않아도 가능한 command 실행은 자동 관측되어야 하며, 같은 실패 반복은 verify 여부와 무관하게 thrashing 신호다.
- scope:
  - `hooks/post-command.ts`
  - `.codex/hooks.template.json`
  - `.claude/settings.template.json`
  - `src/runtime/monitor.ts`
  - `tests/codex-hooks.test.mjs`
  - `tests/install.test.mjs`
  - `tests/monitor.test.mjs`
- dependencies:
  - FG-20-01
  - FG-05-03
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `PostToolUse command hook and monitor input`
  touched_files:
    - `hooks/post-command.ts`
    - `.codex/hooks.template.json`
    - `.claude/settings.template.json`
    - `src/runtime/monitor.ts`
    - `tests/codex-hooks.test.mjs`
    - `tests/install.test.mjs`
    - `tests/monitor.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: PostToolUse(Bash)가 supported command output을 재실행 없이 기록하고 `run_command` 실패가 monitor detection에 포함된다. upstream Codex hook 문서상 unified/streaming shell interception은 불완전하므로 wrapper가 완전한 fallback이며 전체 283개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: 동일 파일 영역과 tool sequence 기반 semantic/structural monitor를 확장한다.

## Phase 21: Structural semantic monitor and feedback

목표: 동일 파일이라는 거친 신호를 edit region과 tool sequence로 정밀화하고, candidate 판정·regression eval·Wiki feedback의 의미를 일관되게 만든다.

### FG-21-01 Edit region and tool sequence candidates

- status: `passing`
- phase: Phase 21
- objective: pre-write edit를 line bucket region으로 기록하고 반복 region/실패 tool sequence를 thrashing candidate로 탐지한다.
- why: 같은 파일을 여러 영역에서 정상적으로 수정하는 행동과 같은 위치·실패 루프를 반복하는 행동을 구분해야 한다.
- scope:
  - `src/runtime/edit-region.ts`
  - `hooks/pre-write-guard.ts`
  - `src/runtime/monitor.ts`
  - `tests/edit-region.test.mjs`
  - `tests/monitor.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-16-04
  - FG-20-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Edit region and tool sequence candidates`
  touched_files:
    - `src/runtime/edit-region.ts`
    - `hooks/pre-write-guard.ts`
    - `src/runtime/monitor.ts`
    - `tests/edit-region.test.mjs`
    - `tests/monitor.test.mjs`
    - `tests/codex-hooks.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: exact old-text anchor가 20-line bucket regionKey로 기록되고 동일 region 3회 및 edit/error tool cycle 3회가 candidate detection을 만든다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-21-02 Candidate verdict separation`을 시작한다.

### FG-21-02 Candidate verdict separation

- status: `passing`
- phase: Phase 21
- objective: 구조 gate의 candidate와 confirmed verdict를 분리해 candidate만으로 Run/complete를 hard block하지 않는다.
- why: 최종목표는 1차 구조 게이트를 후보 추출 단계로 정의한다. 같은 파일/도구 반복만으로 실패를 확정하면 정상적인 TDD 루프가 오탐으로 중단된다.
- scope:
  - `src/runtime/monitor.ts`
  - `src/runtime/completion.ts`
  - `tests/monitor.test.mjs`
  - `tests/monitor-cli.test.mjs`
- dependencies:
  - FG-21-01
  - FG-16-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Candidate verdict separation`
  touched_files:
    - `src/runtime/monitor.ts`
    - `src/runtime/completion.ts`
    - `tests/monitor.test.mjs`
    - `tests/monitor-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: thrashing candidate는 기록/리뷰 대상으로 남고 confirmed detection만 blocked 전이를 만든다. 객관적인 missing evidence completion gate와 false_success 차단은 유지된다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-21-03 Span replay eval and resolve-to-Wiki feedback`을 시작한다.

### FG-21-03 Span replay eval and resolve-to-Wiki feedback

- status: `passing`
- phase: Phase 21
- objective: thrashing eval이 source detection을 자기 비교하지 않고 span fixture를 재생하며, resolve 결과를 Wiki에 자동 반영한다.
- why: regression eval은 detector의 입력-출력 행동을 검증해야 하고 사람 판정은 다음 세션의 지식으로 자동 보존되어야 한다.
- scope:
  - `src/runtime/evals.ts`
  - `src/cli/index.ts`
  - `tests/evals.test.mjs`
  - `tests/eval-cli.test.mjs`
  - `tests/detection-cli.test.mjs`
- dependencies:
  - FG-21-01
  - FG-15-02
  - FG-06-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Span replay eval and resolve-to-Wiki feedback`
  touched_files:
    - `src/runtime/evals.ts`
    - `src/cli/index.ts`
    - `tests/evals.test.mjs`
    - `tests/eval-cli.test.mjs`
    - `tests/detection-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: thrashing eval은 detection evidence span snapshot을 재생해 3개 fixture에서 통과하고 2개로 축소하면 실패한다. detection resolve는 Wiki problem page를 자동 갱신하며 전체 289개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: cross-artifact approval gate와 evidence freshness/state hardening을 최종목표 기준으로 감사한다.

## Phase 22: Governance integrity hardening

목표: 승인 artifact 사슬, evidence freshness, governance state 손상에서 completion/scope policy가 우회되지 않게 한다.

### FG-22-01 Approved Plan to Contract lineage gate

- status: `passing`
- phase: Phase 22
- objective: Contract 승인 시 같은 Run/Intent의 approved Plan과 선택적 Interview lineage를 검증한다.
- why: Contract를 먼저 승인하거나 다른 Run/Intent의 Plan을 연결하면 사람 승인의 실행 전략과 실제 계약이 분리된다.
- scope:
  - `src/runtime/contracts.ts`
  - `tests/contracts.test.mjs`
  - `tests/contract-cli.test.mjs`
- dependencies:
  - FG-18-01
  - FG-19-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Approved Plan to Contract lineage gate`
  touched_files:
    - `src/runtime/contracts.ts`
    - `tests/contracts.test.mjs`
    - `tests/contract-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: Contract approval rejects missing/draft/mismatched Plan lineage and validates approved Interview linkage when present.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-22-02 Post-edit evidence freshness`를 시작한다.

### FG-22-02 Post-edit evidence freshness

- status: `passing`
- phase: Phase 22
- objective: required pass evidence 이후 successful edit/apply_patch span이 있으면 completion에서 stale로 거부한다.
- why: 최신 결과 우선만으로는 검증 뒤 코드를 바꾼 다음 이전 pass를 재사용하는 우회를 막지 못한다.
- scope:
  - `src/runtime/completion.ts`
  - `src/runtime/stop-gate.ts`
  - `tests/completion.test.mjs`
  - `tests/stop-gate.test.mjs`
- dependencies:
  - FG-17-01
  - FG-04-03
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Post-edit evidence freshness`
  touched_files:
    - `src/runtime/completion.ts`
    - `src/runtime/stop-gate.ts`
    - `tests/completion.test.mjs`
    - `tests/stop-gate.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: required pass보다 최신인 successful edit span이 있으면 `required evidence stale after later edit`로 complete/Stop이 차단된다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-22-03 Governance state fail-closed and atomic temp isolation`을 시작한다.

### FG-22-03 Governance state fail-closed and atomic temp isolation

- status: `passing`
- phase: Phase 22
- objective: 손상된 Intent/linked Contract를 write/Stop에서 차단하고 atomic JSON temp 이름 충돌을 제거한다.
- why: schema-invalid governance record가 조용히 사라지면 승인·scope·completion policy가 fail-open되고, 고정 `.tmp`는 동시 writer가 서로 덮을 수 있다.
- scope:
  - `src/runtime/intents.ts`
  - `src/runtime/contracts.ts`
  - `src/utils/json.ts`
  - `hooks/pre-write-guard.ts`
  - `hooks/stop-continue.ts`
  - `tests/state-integrity.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-22-01
  - FG-17-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
  - `node --experimental-test-coverage --test tests/*.test.mjs`
- passing_evidence:
  command: `npm run typecheck`; `npm test`; coverage command
  exit_code: `0`; `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Governance state fail-closed and atomic temp isolation`
  touched_files:
    - `src/runtime/intents.ts`
    - `src/runtime/contracts.ts`
    - `src/utils/json.ts`
    - `hooks/pre-write-guard.ts`
    - `hooks/stop-continue.ts`
    - `tests/state-integrity.test.mjs`
    - `tests/codex-hooks.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
    - `node --experimental-test-coverage --test tests/*.test.mjs`
  last_observation: malformed/schema-invalid Intent와 손상/유실 linked Contract는 write/Stop에서 fail-closed다. atomic temp는 PID+UUID로 분리되며 296개 테스트, line 88.39%, function 89.96% coverage가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: feature/fix execution precondition과 broader state hardening을 계속 감사한다.

## Phase 23: Execution precondition

목표: 승인된 artifact 사슬과 실제 feature/fix write를 동일한 Run phase와 Contract에 묶는다.

### FG-23-01 Artifact-aware Run phase prerequisites

- status: `passing`
- phase: Phase 23
- objective: Interview/Plan/Contract 승인 상태를 Run phase 전이의 deterministic precondition으로 강제한다.
- why: 승인 artifact가 있어도 phase 전이가 이를 확인하지 않으면 agent가 계약 이전에 act로 진입할 수 있다.
- scope:
  - `src/runtime/execution-governance.ts`
  - `src/cli/index.ts`
  - `tests/execution-governance.test.mjs`
  - `tests/run-cli.test.mjs`
- dependencies:
  - FG-18-01
  - FG-19-02
  - FG-22-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Artifact-aware Run phase prerequisites`
  touched_files:
    - `src/runtime/execution-governance.ts`
    - `src/cli/index.ts`
    - `tests/execution-governance.test.mjs`
    - `tests/run-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: feature/fix Run은 plan에서 시작하고, linked Interview/Plan/Contract 승인이 다음 phase 전이 전에 검증된다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-23-02 Feature/fix write execution gate`를 시작한다.

### FG-23-02 Feature/fix write execution gate

- status: `passing`
- phase: Phase 23
- objective: feature/fix의 비사소 write에 같은 Intent의 active act/verify Run과 approved Contract를 요구한다.
- why: completion과 Contract 승인이 강해도 실제 write 시점이 계약 밖이면 승인 전 코드 변경 우회가 남는다.
- scope:
  - `src/runtime/execution-governance.ts`
  - `hooks/pre-write-guard.ts`
  - `tests/execution-governance.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-23-01
  - FG-22-03
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output, 300 tests passed
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Feature/fix write execution gate`
  touched_files:
    - `src/runtime/execution-governance.ts`
    - `hooks/pre-write-guard.ts`
    - `tests/execution-governance.test.mjs`
    - `tests/codex-hooks.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: feature/fix non-trivial write는 active Run의 act/verify phase와 approved matching Contract가 모두 있을 때만 허용되며 tidy/chore는 contract-optional이다. 전체 300개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: broader governance state corruption/concurrency hardening을 감사한다.

## Phase 24: State integrity and concurrent create

목표: governance record 손상이나 동시 생성 충돌이 정책을 약화시키거나 기존 state를 덮어쓰지 못하게 한다.

### FG-24-01 Strict governance artifact loaders

- status: `passing`
- phase: Phase 24
- objective: 주요 artifact collection이 malformed/schema-invalid record를 조용히 제거하지 않게 한다.
- why: invalid Rule/Run이 사라지면 write/Stop이 이전 상태로 fallback해 승인 정책을 우회할 수 있다.
- scope:
  - `src/runtime/rules.ts`
  - `src/runtime/runs.ts`
  - `src/runtime/plans.ts`
  - `src/runtime/interviews.ts`
  - `src/runtime/contracts.ts`
  - `src/runtime/detections.ts`
  - `src/runtime/evals.ts`
  - `hooks/pre-write-guard.ts`
  - `hooks/stop-continue.ts`
  - `tests/state-integrity.test.mjs`
  - `tests/codex-hooks.test.mjs`
- dependencies:
  - FG-22-03
  - FG-23-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Strict governance artifact loaders`
  touched_files:
    - runtime state modules
    - `hooks/pre-write-guard.ts`
    - `hooks/stop-continue.ts`
    - `tests/state-integrity.test.mjs`
    - `tests/codex-hooks.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: Rule/Run corruption은 write/Stop에서 차단되고 모든 주요 artifact loader가 invalid record를 명시적 state error로 보고한다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-24-02 Collision-safe sequential record creation`을 시작한다.

### FG-24-02 Collision-safe sequential record creation

- status: `passing`
- phase: Phase 24
- objective: 삭제된 번호와 동시 creator가 기존 record를 덮어쓰지 않게 한다.
- why: `record count + 1`과 overwrite rename은 hole 또는 race에서 이미 존재하는 governance state를 교체할 수 있다.
- scope:
  - `src/utils/id.ts`
  - `src/utils/json.ts`
  - primary artifact create functions
  - `tests/id.test.mjs`
- dependencies:
  - FG-24-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
  - `npm run build && node --test tests/id.test.mjs`
- passing_evidence:
  command: `npm run typecheck`; `npm test`; targeted concurrent create test
  exit_code: `0`; `0`; `0`
  log_path: terminal output, 309 tests passed
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Collision-safe sequential record creation`
  touched_files:
    - `src/utils/id.ts`
    - `src/utils/json.ts`
    - artifact create modules
    - `tests/id.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
    - `npm run build && node --test tests/id.test.mjs`
  last_observation: max-suffix allocation, 3+ digit loader support, atomic exclusive hard-link publish, collision retry가 적용됐고 8개 동시 Intent creator가 고유 record를 손실 없이 생성한다. 전체 309개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: scoped content fingerprint provenance를 verification evidence에 연결한다.

## Phase 25: Verification content provenance

목표: required verification evidence를 timestamp뿐 아니라 실제 승인 scope content digest에 결박한다.

### FG-25-01 Scoped content fingerprint capture

- status: `passing`
- phase: Phase 25
- objective: verification 종료 직후 approved Contract/Intent scope의 deterministic SHA-256 manifest를 evidence에 저장한다.
- why: hook span 시간만으로는 hook을 거치지 않은 direct filesystem write와 파일 삭제/추가를 증명하지 못한다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/provenance.ts`
  - `src/runtime/verification.ts`
  - `tests/provenance.test.mjs`
  - `tests/verification.test.mjs`
- dependencies:
  - FG-22-02
  - FG-24-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Scoped content fingerprint capture`
  touched_files:
    - `src/runtime/schemas.ts`
    - `src/runtime/provenance.ts`
    - `src/runtime/verification.ts`
    - `tests/provenance.test.mjs`
    - `tests/verification.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: manifest는 path/size/file SHA-256와 aggregate digest를 포함하고 Contract scope를 Intent scope보다 우선한다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-25-02 Completion digest revalidation`을 시작한다.

### FG-25-02 Completion digest revalidation

- status: `passing`
- phase: Phase 25
- objective: completion/Stop에서 current scoped digest와 latest required evidence provenance를 비교한다.
- why: 검증 후 direct write를 이전 pass로 완료할 수 있으면 evidence가 실제 checkout을 증명하지 못한다.
- scope:
  - `src/runtime/completion.ts`
  - `hooks/stop-continue.ts`
  - `tests/completion.test.mjs`
  - `tests/provenance.test.mjs`
- dependencies:
  - FG-25-01
  - FG-17-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
  - `npm run build && node --test tests/provenance.test.mjs`
- passing_evidence:
  command: `npm run typecheck`; `npm test`; targeted provenance test
  exit_code: `0`; `0`; `0`
  log_path: terminal output, 314 tests passed
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Completion digest revalidation`
  touched_files:
    - `src/runtime/completion.ts`
    - `hooks/stop-continue.ts`
    - `tests/completion.test.mjs`
    - `tests/provenance.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
    - `npm run build && node --test tests/provenance.test.mjs`
  last_observation: current digest가 다르거나 provenance가 없는 legacy required pass는 stale이며, unobserved direct write end-to-end 회귀가 통과한다. 전체 314개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: multi-record lineage/index reconciliation과 recovery를 구현한다.

## Phase 26: Lineage reconciliation

목표: crash로 일부만 반영된 Run index와 cross-artifact backlink를 안전하고 반복 가능하게 복구한다.

### FG-26-01 Derived Run index rebuild

- status: `passing`
- phase: Phase 26
- objective: Run index를 validated Run records에서 재구축 가능한 cache로 만든다.
- why: Run record publish와 index 갱신 사이에 종료되거나 index가 손상돼도 active/recent context를 복구할 수 있어야 한다.
- scope:
  - `src/runtime/runs.ts`
  - `src/utils/id.ts`
  - `tests/id.test.mjs`
  - `tests/reconcile.test.mjs`
- dependencies:
  - FG-24-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Derived Run index rebuild`
  touched_files:
    - `src/runtime/runs.ts`
    - `src/utils/id.ts`
    - `tests/id.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: index는 updatedAt/숫자 ID 순서로 재구축되며 1000+ sequential IDs도 numeric order를 유지한다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-26-02 Cross-artifact reconciliation CLI`를 시작한다.

### FG-26-02 Cross-artifact reconciliation CLI

- status: `passing`
- phase: Phase 26
- objective: missing backlink와 corrupt derived index를 dry-run/apply로 idempotent하게 복구한다.
- why: Interview/Plan/Contract/Run을 순차 기록하는 도중 종료되면 canonical record는 남아도 반대편 reference가 비어 있을 수 있다.
- scope:
  - `src/runtime/reconcile.ts`
  - `src/cli/index.ts`
  - `tests/reconcile.test.mjs`
  - `tests/reconcile-cli.test.mjs`
- dependencies:
  - FG-26-01
  - FG-19-02
  - FG-22-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output, 318 tests passed
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Cross-artifact reconciliation CLI`
  touched_files:
    - `src/runtime/reconcile.ts`
    - `src/cli/index.ts`
    - `tests/reconcile.test.mjs`
    - `tests/reconcile-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: dry-run은 planned repair/conflict를 보고하고, apply는 conflict가 없을 때만 missing backlink와 index를 복구한다. 재실행은 no-op이며 전체 318개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: bounded semantic similarity/Judge 대상·비용 정책을 구현한다.

## Phase 27: Semantic Judge and completion closure

목표: 2차 의미 판정 비용을 제한하고 feature/fix completion이 승인 execution chain을 끝까지 우회하지 못하게 한다.

### FG-27-01 Cached embedding similarity and bounded Judge queue

- status: `passing`
- phase: Phase 27
- objective: candidate thrashing에만 cached embedding/cosine similarity를 적용하고 Judge 호출량을 제한한다.
- why: 모든 로그를 LLM에 보내면 비용·컨텍스트가 폭증하고 deterministic hook 원칙을 깨뜨린다.
- scope:
  - `src/runtime/judge-policy.ts`
  - `src/runtime/similarity.ts`
  - `src/runtime/judge.ts`
  - `src/runtime/judge-adapter.ts`
  - `src/runtime/schemas.ts`
  - `src/cli/index.ts`
  - `tests/judge-policy.test.mjs`
  - `tests/judge-cli.test.mjs`
- dependencies:
  - FG-21-01
  - FG-15-01
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Cached embedding similarity and bounded Judge queue`
  touched_files:
    - Judge/Detection schema and runtime
    - CLI and tests
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: semantic vectors는 model/input digest로 캐시되고 cosine threshold, candidate/input/dimension/batch budgets를 통과한 후보만 Judge batch에 들어간다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-27-02 Behavior completion chain closure`를 시작한다.

### FG-27-02 Behavior completion chain closure

- status: `passing`
- phase: Phase 27
- objective: feature/fix complete/Stop에 approved matching Contract와 verify phase를 요구한다.
- why: write가 없거나 hook을 우회한 Run이 fallback evidence만으로 승인 artifact chain 없이 완료될 수 있었다.
- scope:
  - `src/runtime/stop-gate.ts`
  - `tests/stop-gate.test.mjs`
  - `tests/run-cli.test.mjs`
- dependencies:
  - FG-23-02
  - FG-25-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output, 324 tests passed
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Behavior completion chain closure`
  touched_files:
    - `src/runtime/stop-gate.ts`
    - `tests/stop-gate.test.mjs`
    - `tests/run-cli.test.mjs`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: approved Intent→Plan→Contract→act→verify→fresh evidence→complete 전체 CLI chain이 통과하고 Contract/verify 없는 feature/fix completion은 차단된다. 전체 324개 테스트가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: artifact revision/archive lifecycle을 마감 감사한다.

## Phase 28: Artifact lifecycle and final audit

목표: Approved artifact 변경을 revision lifecycle로 완성하고 최종목표 필수 gap을 종결한다.

### FG-28-01 Interview/Plan/Contract revision lifecycle

- status: `passing`
- phase: Phase 28
- objective: human archive 뒤 supersedes lineage를 가진 새 draft revision을 생성한다.
- why: approved content를 수정하지 않는다는 원칙만으로는 변경 필요 시 안전한 다음 revision 경로가 없다.
- scope:
  - `src/runtime/schemas.ts`
  - `src/runtime/interviews.ts`
  - `src/runtime/plans.ts`
  - `src/runtime/contracts.ts`
  - `src/runtime/reconcile.ts`
  - `src/cli/index.ts`
  - artifact runtime/CLI tests
- dependencies:
  - FG-18-01
  - FG-26-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
- passing_evidence:
  command: `npm run typecheck`; `npm test`
  exit_code: `0`; `0`
  log_path: terminal output
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Interview/Plan/Contract revision lifecycle`
  touched_files:
    - artifact schemas/runtimes/CLI/tests
    - `src/runtime/reconcile.ts`
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
  last_observation: approved artifact는 human archive 뒤 r+1 draft로 복제되고 supersedes reference를 남긴다. Archive는 Run pointer를 비우고 phase를 되돌린다.
- blocked_reason: null
- unblock_condition: null
- next_action: `FG-28-02 Final-goal completion audit`를 수행한다.

### FG-28-02 Final-goal completion audit

- status: `passing`
- phase: Phase 28
- objective: 최종목표 matrix, full tests, coverage, docs consistency를 감사한다.
- why: 개별 phase passing만으로 전체 workflow의 연결과 문서 상태를 증명할 수 없다.
- scope:
  - root docs
  - gap analysis/ledger
  - full test suite and coverage
- dependencies:
  - FG-28-01
  - FG-27-02
- verification_commands:
  - `npm run typecheck`
  - `npm test`
  - `node --experimental-test-coverage --test tests/*.test.mjs`
  - `git diff --check`
  - `npm_config_cache=/tmp/hyohyeon-harness-npm-cache npm pack --dry-run`
- passing_evidence:
  command: typecheck; full tests; coverage; diff check; package dry-run
  exit_code: `0`; `0`; `0`; `0`; `0`
  log_path: terminal output, 330 tests passed, line 89.14%, branch 71.40%, function 88.65%
  verified_at: `2026-07-10`
- active_work:
  current_focus: `Final-goal completion audit`
  touched_files:
    - `README.md`
    - `AGENT.md`
    - `AGENTS.md`
    - `hyohyeon-harness-최종목표.md`
    - final goal docs
  attempted_commands:
    - `npm run typecheck`
    - `npm test`
    - coverage command
    - `git diff --check`
    - package dry-run with an isolated cache
  last_observation: 필수 workflow gap은 닫혔다. Upstream hook 밖 shell wrapper와 human-selected AGENTS/CI patch는 명시된 제품 경계이며 전체 330 tests와 coverage audit가 통과했다.
- blocked_reason: null
- unblock_condition: null
- next_action: 실제 운영 Detection/Rule/Eval 피드백을 다음 독립 intent로 처리한다.

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
              -> Phase 8 Goal-aligned workflow
                -> Phase 9 Execution loop / Monitor CLI
                  -> Phase 10 Contract-centered completion gate
                    -> Phase 11 Judge / Reviewer / Eval CLI
                      -> Phase 12 Rule feedback loop
                        -> Phase 13 Execution loop blocked policy
                          -> Phase 14 Contract lifecycle and report
                            -> Phase 15 Judge / Eval / Rule follow-up persistence
                              -> Phase 16 Automation loop closure
                                -> Phase 17 Governed completion integrity
                                  -> Phase 18 Approval lifecycle and Run FSM
                                    -> Phase 19 Structured InterviewSummary and lineage
                                      -> Phase 20 General command tracing
                                        -> Phase 21 Structural semantic monitor and feedback
                                          -> Phase 22 Governance integrity hardening
                                            -> Phase 23 Execution precondition
                                              -> Phase 24 State integrity and concurrent create
                                                -> Phase 25 Verification content provenance
                                                  -> Phase 26 Lineage reconciliation
                                                    -> Phase 27 Semantic Judge and completion closure
                                                      -> Phase 28 Artifact lifecycle and final audit
```

Phase 3과 Phase 4는 Phase 2 이후 일부 병렬 진행이 가능하다. Phase 8 이후는 `hyohyeon-harness-최종목표.md`를 기준으로 MVP 기능을 운영 workflow로 묶는 후속 phase다.

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
- `docs/phase/phase-8-plan-artifact-and-cli.md`
- `docs/phase/phase-9-run-transition-and-monitor-cli.md`
- `docs/phase/phase-10-contract-required-checks-gate.md`
- `docs/phase/phase-11-judge-reviewer-eval-cli.md`
- `docs/phase/phase-12-detection-feedback-cli.md`
- `docs/phase/phase-13-execution-loop-policy.md`
- `docs/phase/phase-14-contract-lifecycle-report.md`
- `docs/phase/phase-15-judge-eval-rule-followups.md`
- `docs/phase/phase-16-automation-loop-closure.md`
- `docs/phase/phase-17-governed-completion-integrity.md`
- `docs/phase/phase-18-approval-lifecycle-run-fsm.md`
- `docs/phase/phase-19-structured-interview-lineage.md`
- `docs/phase/phase-20-general-command-tracing.md`
- `docs/phase/phase-21-structural-semantic-monitor-feedback.md`
- `docs/phase/phase-22-governance-integrity-hardening.md`
- `docs/phase/phase-23-execution-precondition.md`
- `docs/phase/phase-24-state-integrity-concurrent-create.md`
- `docs/phase/phase-25-verification-content-provenance.md`
- `docs/phase/phase-26-lineage-reconciliation.md`
- `docs/phase/phase-27-semantic-judge-completion-closure.md`
- `docs/phase/phase-28-artifact-lifecycle-final-audit.md`

## 현재 추천 시작점

필수 구현 phase는 완료됐다.

이유:

- `hyohyeon-harness-최종목표.md`가 상위 SSOT다.
- Phase 8-28에서 Plan, Execution Loop, Contract, Judge/Reviewer/Eval CLI, Detection feedback, 자동 loop closure, governed completion, 승인 artifact revision lifecycle, Run FSM, Structured InterviewSummary lineage, 일반 command tracing, structural+embedding semantic monitor, governance integrity, execution precondition, state/concurrent-create hardening, content provenance, lineage reconciliation, completion chain closure, final audit가 passing 상태가 됐다.
- feature/fix write와 act 전이는 approved artifact 사슬을 요구한다.
- 최종목표의 필수 구현 gap은 없다.

시작 방법:

1. 실제 운영에서 새 Detection/Rule/Eval feedback이 생기면 별도 intent로 처리한다.
2. 새 FG 항목을 이 ledger에 추가하고 `active`로 바꾼다.
3. deterministic hook 원칙을 깨지 않는지 먼저 설계한다.
4. `npm run typecheck`, `npm test`가 통과하면 `passing_evidence`를 채운다.
