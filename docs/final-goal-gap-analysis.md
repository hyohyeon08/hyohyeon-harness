# hyohyeon-harness final goal gap analysis

## 목적

이 문서는 `hyohyeon-harness-최종목표.md`의 최종 비전과 현재 프로젝트 구현을 대조해, 무엇이 이미 있고 무엇이 부족하거나 다른지 정리한다. 결론부터 말하면 현재 프로젝트는 `Intent-First Gate + LLM Wiki + handoff + postmortem`까지 구현된 v1/v2 하네스이고, 최종목표 문서는 이를 `RunState + verification evidence + observability + monitor + detection + reviewer/eval`까지 확장하려는 다음 단계 청사진이다.

현재 구현은 작고 강한 게이트 중심이다. 최종목표 문서는 작업 실행 전체를 관리하는 운영체계에 가깝다.

## 현재 프로젝트의 실제 상태

현재 레포의 중심은 `intent` CLI와 4개 hook이다.

- CLI: `src/cli/index.ts`
- 상태 경로: `src/state/paths.ts`
- 상태 스키마: `src/runtime/schemas.ts`
- 의도 CRUD: `src/runtime/intents.ts`
- 의도/스코프 게이트: `src/runtime/intent-gate.ts`, `src/runtime/scope.ts`
- 사소한 변경 판정: `src/runtime/triviality.ts`, `src/runtime/change-extract.ts`, `src/runtime/apply-patch.ts`
- Stop gate: `src/runtime/stop-gate.ts`
- `.intent/` 보호와 human-only 승인: `src/runtime/guard.ts`, `src/runtime/env.ts`
- rule 후보와 강제 규칙: `src/runtime/rules.ts`
- wiki: `src/runtime/wiki.ts`
- handoff: `src/runtime/handoff.ts`
- failure -> wiki/rule: `src/runtime/postmortem.ts`
- shared spec: `src/runtime/spec.ts`
- hooks: `hooks/session-start.ts`, `hooks/pre-write-guard.ts`, `hooks/stop-continue.ts`, `hooks/pre-compact.ts`

검증 상태:

- `npm.cmd run typecheck` 통과
- `npm.cmd test` 통과
- 총 105개 테스트 통과

주의: PowerShell에서는 `npm.ps1` 실행 정책 때문에 `npm run ...`이 막혔고, `npm.cmd ...`로 검증했다.

## 최종목표 문서의 핵심 요구

목표 문서는 다음 흐름을 제안한다.

```text
User Goal
  -> Interview
  -> Plan
  -> Sprint Contract
  -> RunState 생성
  -> Execution Loop
  -> Test & Verification Layer
  -> Observability Layer
  -> Monitor
  -> Detection Record
  -> Persist to LLM-Wiki
  -> Rule Candidate 생성
  -> AGENTS.md / Hook / Reviewer / Eval 반영
```

이 흐름에서 현재 프로젝트와 가장 큰 차이는 `Run` 중심 모델의 부재다. 현재 프로젝트는 `Intent`를 중심으로 "비사소 변경을 승인된 의도와 scope 안에서만 허용"한다. 반면 최종목표 문서는 각 작업을 `RunState`로 관리하고, 검증/관측/탐지 증거를 붙여 완료를 외부적으로 판정하려 한다.

## 현재 있음

### 1. Intent-First Gate

현재 구현은 비사소 변경을 승인된 intent 없이 막는다.

- 작은 변경, 주석/포맷 변경은 통과
- 새 파일, 삭제, 새 symbol, control flow, 큰 변경은 intent 필요
- 승인된 intent가 있어도 scope 밖이면 차단
- Codex `apply_patch` payload도 파싱해서 검사

관련 구현:

- `src/runtime/intent-gate.ts`
- `src/runtime/triviality.ts`
- `src/runtime/change-extract.ts`
- `src/runtime/apply-patch.ts`
- `hooks/pre-write-guard.ts`

최종목표 문서의 "종료 조건 외부화"와 "아키텍처 경계 강제" 철학과 방향이 맞다. 다만 현재는 작업 전체 계약이 아니라 파일 변경 직전의 게이트다.

### 2. Scope boundary

`Intent.scope`가 glob-ish path pattern으로 관리된다.

- `**`
- `src/foo/**`
- `src/*.ts`
- exact path
- Windows backslash normalization

관련 구현:

- `src/runtime/scope.ts`
- `tests/scope.test.mjs`

최종목표의 `allowedScope`, `forbiddenScope` 중 `allowedScope`에 해당하는 기능은 있다. `forbiddenScope`는 별도 Sprint Contract에는 없고, approved rule의 `forbid-path`로 우회 가능하다.

### 3. DoD와 Stop gate

현재 intent는 `dod`, `dodChecked`를 가진다. `feature`/`fix` intent는 learning note가 없으면 완료할 수 없다.

관련 구현:

- `src/runtime/stop-gate.ts`
- `src/runtime/intents.ts`
- `hooks/stop-continue.ts`

최종목표의 Definition of Done 철학과 직접 연결된다. 다만 지금의 DoD는 사람이/AI가 CLI로 체크한 텍스트 항목이고, 실제 테스트/빌드 로그와 자동 연결되지는 않는다.

### 4. Human-only approval과 anti-cheat

현재 구현은 `.intent/` 직접 편집을 차단하고, AI 환경에서 `approve` 명령을 거부한다.

관련 구현:

- `src/runtime/guard.ts`
- `src/runtime/env.ts`
- `hooks/pre-write-guard.ts`
- `src/cli/index.ts`

최종목표 문서의 "중요한 판단은 사람이 검토한다"와 맞다.

### 5. LLM-Wiki 기본 구조

현재 wiki는 `.intent/wiki/knowledge`와 `.intent/wiki/problems`로 나뉜다.

- knowledge: `concept`, `decision`, `spec`, `guide`, `source`, `overview`
- problem: `failure`, `issue`
- `index.md`, `log.md`
- wikilink/backlink
- lint: orphan, dead link, low confidence, open problem

관련 구현:

- `src/runtime/wiki.ts`
- `skills/wiki/SKILL.md`
- `tests/wiki.test.mjs`

최종목표 문서의 LLM-Wiki 방향과 상당히 가깝다. 다만 최종목표 문서가 제안하는 `raw/`, `runs/`, `verification/`, `observability/`, `evals/` 계층은 아직 없다.

### 6. Failure -> wiki + rule candidate

`intent postmortem`은 failure page를 만들고, 필요한 경우 `Rule` draft를 만든다.

관련 구현:

- `src/runtime/postmortem.ts`
- `src/runtime/rules.ts`
- `src/cli/index.ts`

최종목표의 "실패 기록의 규칙화"와 방향이 정확히 맞다. 현재는 수동 postmortem 중심이고, Detection Record 기반 자동 전환은 아직 없다.

### 7. Handoff

PreCompact 시점에 handoff를 작성하고 SessionStart에서 이전 handoff와 wiki index를 주입한다.

관련 구현:

- `src/runtime/handoff.ts`
- `src/runtime/memory.ts`
- `hooks/pre-compact.ts`
- `hooks/session-start.ts`

최종목표 문서의 "대화와 개발 과정이 일회성으로 사라지지 않게 한다"는 목적에 대응한다. 다만 RunState 기반 resume은 아니다.

## 부분적으로 있음

### 1. Interview

최종목표는 Interview Summary를 저장하고 Plan/RunState의 근거로 쓰자고 한다. 현재는 `skills/interview/SKILL.md`와 `intent spec draft/approve`가 있다.

차이:

- 현재: interview 결과를 wiki spec으로 남기는 흐름
- 목표: 별도 `Interview Summary`가 Plan과 RunState에 연결됨

추천:

- `InterviewSummarySchema`를 별도 JSON으로 만들기보다, 초기에는 wiki spec을 authoritative interview artifact로 사용한다.
- `RunState.interviewId`나 `RunState.specSlug`로 연결한다.

### 2. Plan

현재는 Plan이라는 별도 artifact가 없다. `intent draft`의 `what`, `why`, `scope`, `dod`가 축약된 계획 역할을 한다.

차이:

- 현재: 의도 선언 중심
- 목표: 작업 목표, 문제 정의, 범위, 수정 금지 영역, 테스트 전략, 검증 명령, 남은 위험까지 명시

추천:

- `Plan`을 intent에 직접 합치지 말고 별도 `plans/*.json` 또는 wiki spec section으로 둔다.
- 최소 MVP에서는 `RunState.plan`을 inline object로 시작해도 된다.

### 3. Sprint Contract

현재는 `Intent` + `Rule` + `DoD`가 Sprint Contract 일부 역할을 한다.

부족한 필드:

- `allowedScope`
- `forbiddenScope`
- `architectureBoundaries`
- `requiredChecks`
- `definitionOfDone`
- `rubric`
- `stopConditions`
- `requiresUserDecision`

추천:

- Contract는 `Intent`를 대체하지 않는다.
- `SprintContract.intentId`로 연결하고, `allowedScope` 기본값은 `Intent.scope`에서 가져온다.
- `requiredChecks`는 Test Matrix와 연결한다.

### 4. Test Matrix

현재 테스트 실행 자체는 프로젝트 개발자가 `npm.cmd test`로 수행하지만, Harness 상태에 저장되지 않는다.

차이:

- 현재: 테스트는 수동 실행 결과이며 완료 gate에 연결되지 않음
- 목표: 작업 유형별 required/optional matrix를 Plan/RunState에 저장

추천:

- `TestMatrixSchema`를 `staticCheck`, `unitTest`, `integrationTest`, `e2eTest`, `lint`, `build` 정도로 시작한다.
- 첫 구현에서는 각 check를 `required | optional | skipped`로 제한한다.

### 5. Rule Candidate

현재 `rules/*.json`은 draft/approved를 지원한다. `postmortem`에서 draft rule을 만들 수 있다.

차이:

- 현재: 사람이 명시적으로 postmortem/rule draft를 만든다.
- 목표: Detection Record에서 Rule Candidate가 자동 생성된다.

추천:

- 기존 `Rule`을 유지한다.
- Detection 기반으로 만들어진 rule에는 `sourceDetectionId`를 추가하는 방향이 좋다.

## 없음

### 1. RunState

최종목표의 핵심인 RunState가 없다.

현재 `StateSchema`는 다음 수준이다.

```ts
{
  version: 1,
  activeIntentId: string | null
}
```

부족한 것:

- `runId`
- `phase`
- `status`
- `planId`
- `interviewId`
- `sprintContractId`
- `budget`
- `definitionOfDone`
- `testMatrix`
- `completionGate`
- `verificationEvidence`
- `observability`
- `detectionRecords`
- `lineage`
- `nextAction`

이 차이가 최종목표와 현재 구현 사이의 가장 큰 구조적 차이다.

### 2. Verification Evidence

현재 완료 판정은 DoD text check와 learning note에 의존한다. 실제 명령 실행 로그를 Harness가 저장하거나 판정하지 않는다.

없는 것:

- 검증 명령 실행 wrapper
- exit code 저장
- stdout/stderr log 저장
- logPath 저장
- evidence type 분류
- required check 충족 여부 판정
- 실패 후 재검증 여부 확인

최종목표의 `false_success` 감지를 위해 가장 먼저 필요하다.

### 3. Raw evidence storage

현재 `.intent/wiki`는 정리된 지식 중심이고, 원본 evidence 저장소가 없다.

목표 문서가 요구하는 raw 계층:

- conversations
- agent-logs
- traces
- spans
- test-results
- build-results
- lint-results
- typecheck-results
- git-diffs
- errors
- sources

현재 `src/runtime/wiki.ts` 주석에는 "No raw/ layer"라고 되어 있다. 이는 현재 설계와 목표 문서가 명확히 다른 지점이다.

추천:

- 루트 `raw/`가 아니라 `.intent/raw/`로 둔다.
- `.intent/` 아래를 CLI-only state로 유지한다.

### 4. Observability Evidence

현재 hook은 write 시점의 gate로 동작하지만, trace/span을 축적하지 않는다.

없는 것:

- trace id
- span id
- edit_file span
- run_command span
- run_test span
- startedAt/endedAt
- status
- errorSignature
- logPath
- span count

최종목표의 "행동을 증명하는 데이터" 계층은 아직 없다.

### 5. Monitor

현재는 thrashing 또는 false_success 감지가 없다.

없는 탐지:

- 같은 파일 반복 수정 횟수
- 같은 명령 반복 실패
- 같은 error signature 반복
- 같은 테스트 실패 반복
- 성공 선언 이후 검증 명령 존재 여부
- Test Matrix 충족 여부
- E2E required인데 E2E 누락 여부

### 6. Detection Record

현재 failure는 wiki page나 postmortem으로 남길 수 있지만, 구조화된 Detection Record가 없다.

없는 것:

- `detectionId`
- `type: thrashing | false_success`
- `runId`
- structural gate result
- semantic judgement
- evidence summary
- related trace/span ids
- nextAction
- suggested rule candidate

### 7. LLM Judge

현재 hook/runtime은 deterministic 원칙을 따른다. LLM Judge는 없다.

이것은 단순 미구현이라기보다 설계상 조심할 부분이다. 현재 원칙상 hook 안에서 LLM을 호출하면 안 된다. 따라서 LLM Judge는 blocking hook이 아니라 별도 command 또는 reviewer workflow로 붙이는 것이 맞다.

추천:

- `intent monitor`는 deterministic structural gate만 수행
- `intent judge <detectionId>`는 선택적 LLM Judge로 분리
- 초기 버전에서는 LLM Judge 없이 Detection Record까지만 구현

### 8. Reviewer / Eval 연동

현재는 reviewer agent나 eval case 저장 구조가 없다.

없는 것:

- reviewer checklist artifact
- eval case schema
- detection -> eval case 변환
- AGENTS.md candidate patch generation
- CI/reviewer/hook 반영 워크플로

## 설계가 다른 부분

### 1. 프로젝트 이름

목표 문서 제목은 `hyoheyon-harness`이고, 현재 파일명/프로젝트 경로는 `hyohyeon-harness`다. 철자를 통일해야 한다.

추천:

- 문서와 패키지명을 `hyohyeon-harness`로 통일한다.
- 단, npm package name은 현재 `intent-harness`라서 별도 product name 정책이 필요하다.

### 2. 상태 위치

목표 문서는 루트에 `raw/`, `wiki/`, `schema/`, `runs/`를 제안한다. 현재 프로젝트는 `.intent/` 아래에 상태를 모은다.

현재 원칙:

- `.intent/`는 CLI-only state
- AI 직접 편집 차단
- wiki도 `.intent/wiki` 아래

추천:

- 최종목표의 구조를 그대로 루트에 만들지 말고 `.intent/` 아래로 흡수한다.

예상 구조:

```text
.intent/
  intents/
  runs/
  contracts/
  plans/
  detections/
  raw/
    test-results/
    build-results/
    typecheck-results/
    lint-results/
    traces/
    spans/
    errors/
    git-diffs/
  wiki/
    knowledge/
    problems/
  rules/
  handoff/
```

### 3. `Intent`와 `Run`의 책임

현재 `Intent`는 변경 의도와 scope approval이다. 최종목표의 `RunState`는 실행 상태다.

섞으면 위험하다.

- Intent는 사람이 승인한 "무엇/왜/범위"다.
- Run은 Agent가 수행하는 "이번 실행의 상태/증거/다음 행동"이다.

추천 관계:

```text
Spec -> Intent -> SprintContract -> RunState -> Evidence -> Detection -> Wiki/Rule
```

### 4. Wiki raw layer

현재 wiki 설계는 "No raw/ layer"다. 최종목표는 raw source를 source of truth로 요구한다.

이 차이는 최종목표를 따르려면 바뀌어야 한다.

추천:

- wiki 자체에는 raw를 넣지 않는다.
- `.intent/raw`를 새로 만들고, wiki frontmatter 또는 본문에서 raw source path/hash를 참조한다.

### 5. Hook deterministic 원칙과 LLM Judge

현재 AGENT 원칙은 hook deterministic, LLM/network call 금지다. 최종목표의 LLM Judge는 이 원칙과 충돌할 수 있다.

추천:

- blocking hook에는 deterministic 검사만 둔다.
- LLM Judge는 수동/비동기/후처리 command로 둔다.
- Detection Record에는 `judgeStatus: not_run | skipped | completed`를 둔다.

## 부족한 기능을 단계별로 나눈 구현 후보

### Phase A: RunState MVP

목표 문서의 1단계에 해당한다.

추가할 것:

- `RunStateSchema`
- `RunStatusSchema`
- `RunPhaseSchema`
- `.intent/runs/run-*.json`
- `.intent/runs/latest-runs.json`
- CLI:
  - `intent run start <intentId> "<objective>"`
  - `intent run status`
  - `intent run note "<text>"`
  - `intent run pause|resume`

기존과 연결:

- `StateSchema.activeIntentId` 옆에 `activeRunId` 추가 가능
- 혹은 별도 `runs/latest-runs.json`만 사용

### Phase B: Verification Evidence MVP

목표 문서의 2단계에 해당한다. 최우선 구현 후보.

추가할 것:

- `VerificationEvidenceSchema`
- `.intent/raw/test-results`
- `.intent/raw/typecheck-results`
- `.intent/raw/build-results`
- CLI:
  - `intent verify typecheck -- npm.cmd run typecheck`
  - `intent verify unit_test -- npm.cmd test`
  - `intent verify lint -- <command>`
  - `intent verify list`

동작:

- command 실행
- stdout/stderr를 log file로 저장
- exitCode/status/createdAt/logPath를 active run에 append
- required evidence가 없으면 complete 차단

주의:

- Windows에서 `npm.ps1` 이슈가 있으므로 examples는 `npm.cmd`를 고려한다.

### Phase C: Test Matrix와 Completion Gate

추가할 것:

- `TestMatrixSchema`
- `CompletionGateSchema`
- `RunState.testMatrix`
- `evaluateRunCompletion(run)` 순수 함수

동작:

- required check별 evidence 존재 여부 확인
- required evidence가 failed면 complete 불가
- evidence 없으면 `false_success_candidate`

### Phase D: Observability MVP

목표 문서의 3단계에 해당한다.

추가할 것:

- `TraceSchema`
- `SpanSchema`
- `.intent/raw/traces`
- `.intent/raw/spans`
- edit/apply_patch hook에서 span append
- verify command에서 run_command/run_test span append

초기 span 종류:

- `edit_file`
- `apply_patch`
- `run_command`
- `run_check`
- `write_handoff`

### Phase E: Detection MVP

목표 문서의 4단계에 해당한다.

추가할 것:

- `DetectionRecordSchema`
- `.intent/detections/*.json`
- `intent monitor`

초기 감지:

- 같은 command가 같은 exitCode로 3회 이상 실패
- 같은 error signature가 3회 이상 반복
- required evidence 없이 complete 시도
- failed evidence 이후 passed evidence 없이 complete 시도

### Phase F: Wiki ingest 자동화

목표 문서의 5단계에 해당한다.

추가할 것:

- `intent wiki ingest detection <id>`
- detection -> failure page 생성
- related evidence/log path 링크
- optional rule draft 생성

기존 `postmortem.ts`를 확장하면 된다.

### Phase G: LLM Judge / Reviewer / Eval

가장 뒤로 미루는 것이 좋다.

이유:

- 현재 hook deterministic 원칙과 충돌 가능
- 비용 통제 필요
- 구조 evidence가 먼저 있어야 judge 품질이 나온다

초기 구현 방향:

- Detection Record의 애매한 케이스만 대상으로 함
- hook 안에서는 실행하지 않음
- judge 결과도 evidence로 저장

## 우선순위 판단

가장 먼저 해야 할 것은 `RunState + Verification Evidence`다.

이유:

1. 최종목표의 핵심인 "완료는 Agent의 말이 아니라 증거로 판단"을 바로 구현한다.
2. false_success 감지의 기반이 된다.
3. Observability와 thrashing monitor도 evidence 없이는 의미가 약하다.
4. 현재 intent/DoD/stop-gate와 자연스럽게 연결된다.

권장 첫 intent:

```text
what: RunState와 verification evidence MVP를 추가한다.
why: 완료 판단을 self-report가 아니라 실행된 검증 증거에 연결하기 위해.
scope:
  - src/runtime/schemas.ts
  - src/state/paths.ts
  - src/runtime/runs.ts
  - src/runtime/verification.ts
  - src/runtime/stop-gate.ts
  - src/cli/index.ts
  - tests/run*.test.mjs
  - tests/verification*.test.mjs
dod:
  - RunState schema와 CRUD 테스트가 통과한다.
  - verify command가 명령 결과를 logPath와 evidence로 저장한다.
  - required evidence가 없으면 completion gate가 실패한다.
  - npm.cmd run typecheck와 npm.cmd test가 통과한다.
```

## 결론

현재 프로젝트는 최종목표의 "철학"은 이미 꽤 잘 반영하고 있다. 특히 `Intent-First`, scope gate, human-only approval, wiki, postmortem, rule candidate는 최종목표와 방향이 같다.

하지만 최종목표가 요구하는 "Agent 작업 실행 단위 관리"는 아직 없다. 현재는 변경 전/종료 시점의 gate는 있지만, 실행 중에 무엇을 했고 어떤 증거가 남았고 왜 완료라고 볼 수 있는지를 저장하는 계층이 비어 있다.

따라서 다음 진화의 핵심은 다음 한 문장으로 요약된다.

```text
Intent는 변경 허가를 관리하고, RunState는 실행과 증거를 관리하게 분리한다.
```

그 위에 Verification Evidence, Observability Evidence, Detection Record, LLM Judge를 단계적으로 쌓는 것이 최종목표 문서와 현재 코드베이스를 가장 자연스럽게 연결하는 길이다.
