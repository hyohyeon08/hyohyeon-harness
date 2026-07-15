# hyohyeon-harness final goal gap analysis

## 기준

이 문서의 기준은 `hyohyeon-harness-최종목표.md`다. 그 문서가 제품 비전과 상위 요구사항의 SSOT다.

`docs/final-goal-phase-feature-spec.md`는 구현 ledger이고, 이 문서는 최종목표 대비 gap matrix다.

## 현재 검증 상태

현재 checkout 기준:

- `npm run typecheck` 통과
- `npm test` 통과
- 총 356개 테스트 통과
- coverage: line 89.54%, branch 71.08%, function 88.48%
- `npm pack --dry-run --json`: runtime allowlist 65 files, 75.9 KB

PowerShell에서 `npm.ps1` 실행 정책 오류가 나면 `npm.cmd run typecheck`, `npm.cmd test`를 사용한다.

## 한 줄 결론

현재 코드는 최종목표의 핵심 데이터 레이어와 운영 loop의 대부분을 구현했다.

`Intent Gate + RunState + Verification Evidence + Observability + Detection + Wiki/Rule/Reviewer/Eval + Contract/Execution Loop CLI`에 더해 completion/stop 자동 탐지, 외부 judge adapter, rule impact/reflection, spec/plan 자동 run 연결, governed completion 판정까지 연결되어 있다.

기존 workflow와 Phase 30 완전 자율 lifecycle에 Phase 31 governance integrity hardening까지 연결됐다. AI가 모든 approve/archive/resolve CLI를 직접 실행하면서 actor provenance와 기존 gate를 보존하고, 저장소 경계·고순번 관측 ID·동시 Run/Trace append 결함도 닫았다. 현재 필수 구현 gap은 없다.

## 최종목표 흐름 대비 구현률

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

| 최종목표 단계 | 현재 상태 | 구현 위치 | 남은 gap |
| --- | --- | --- | --- |
| User Goal / Interview | 구현 | structured summary, approval immutability, archive/revise, supersedes lineage, SessionStart/handoff | 필수 gap 없음. |
| Plan | 구현 | strategy artifact, approval/immutability, archive/revise, contract phase precondition | 필수 gap 없음. |
| Sprint Contract | 구현 | Plan/Interview lineage, machine-enforced scope/required checks, explicit reviewer metadata, archive/revise, Run pause | 자연어 reviewer metadata는 자동 gate가 아니며, 강제가 필요하면 deterministic rule/check로 compile해야 한다. |
| RunState | MVP+ 구현 | strict loader, collision-safe create, cross-process update lock, governed run, derived index rebuild, durable completion journal, `intent reconcile` | 필수 gap 없음. |
| Execution Loop | 구현 | `src/runtime/execution-governance.ts`, feature/fix write gate, phase prerequisites, command/monitor/completion loop | 일부 unified/streaming shell 호출은 upstream hook 제약으로 wrapper가 필요하다. |
| Verification Evidence | 구현 | latest-result, post-edit stale 판정, scoped SHA-256 content manifest, legacy reverify, raw logs | symlink 외부 대상 내용과 very large scope 성능 정책은 더 감사할 수 있다. |
| Observability | MVP+ 구현 | concurrent-safe Trace append, numeric `RUN/SPAN-1000+`, `src/runtime/commands.ts`, pre-write/PostToolUse hooks, verify runner | upstream hook이 제공하지 않는 shell 호출과 unobserved direct write는 wrapper 밖에서 관측할 수 없다. |
| Monitor | 구현 | structural candidates, cached external embeddings, cosine similarity, confirmed-only hard block | Embedding provider는 command adapter로 교체 가능하게 유지한다. |
| Detection Record | 구현 | embedding cache, Judge classification/action/input digest, bounded queue/batch CLI | Hook 밖의 명시적 adapter 실행을 요구한다. |
| Persist to LLM-Wiki | 구현 | `recordDetectionWikiPage`, resolve 자동 ingest, `wiki lint`, 수동 ingest CLI | candidate의 자동 ingest는 하지 않는다. |
| Rule Candidate | 구현 | `draftRule`, `sourceDetectionId`, `intent rule draft-from-detection`, `agents-candidate`, `ci-candidate`, `impact`, `reflect` | AGENTS/CI 파일 자동 patch 적용은 하지 않고 candidate/reflection 추적까지만 한다. |
| Reviewer / Eval | 구현 | `reviewer.ts`, `judge.ts`, `judge-adapter.ts`, span replay `evals.ts`, CLI | false_success eval은 아직 source state 비교 중심이다. |
| Autonomous lifecycle | 구현 | AI-executable approve/archive/resolve, actor provenance, CLI-only state writer | 필수 gap 없음. |

## 이미 구현된 기반

### 1. Intent-first gate

비사소 변경은 승인된 intent 없이는 차단된다.

- 관련 코드: `src/runtime/intent-gate.ts`, `src/runtime/triviality.ts`, `src/runtime/change-extract.ts`, `src/runtime/apply-patch.ts`
- hook: `hooks/pre-write-guard.ts`
- 테스트: `tests/intent-gate.test.mjs`, `tests/triviality.test.mjs`, `tests/apply-patch.test.mjs`, `tests/codex-hooks.test.mjs`

최종목표의 "규칙은 실행 가능한 게이트여야 한다"는 방향과 맞는다.

### 2. Autonomous approval / CLI-only state boundary

Phase 30에서 사용자가 governance 명령을 대신 입력하지 않아도 AI가 준비 상태를 판단해 모든 lifecycle 명령을 직접 실행하게 했다.

- AI는 `intent approve`, rule/spec/interview/plan/contract approve, artifact archive, detection resolve를 지원 Agent shell에서 스스로 실행한다.
- `approved`는 사람 보증이 아니라 readiness·immutability·lineage를 나타내는 실행 상태다.
- 승인 계열 state에는 `agent:codex`, `agent:claude-code`, `human` 같은 실제 actor provenance를 기록하며 actor에 따라 권한을 나누지 않는다.
- `.intent/` 직접 Edit/Write, redirect, 임의 script mutation은 계속 차단한다. Schema-validated `intent` CLI만 state writer다.
- 관련 구현 범위: `src/runtime/guard.ts`, `src/runtime/command-guard.ts`, `src/runtime/env.ts`, lifecycle runtimes, CLI adapters, hook/CLI regression tests.

### 3. RunState / Plan / Contract workflow

Run은 Intent와 분리되어 "이번 agent 실행 상태"를 추적한다.

- Run: `src/runtime/runs.ts`, `intent run start/status/list/note/phase/status-set/next/budget/attempt`
- Plan: `src/runtime/plans.ts`, `intent plan draft/show/list/link`
- Contract: `src/runtime/contracts.ts`, `intent contract draft/show/list/approve/edit/report`

Plan draft와 spec draft/link는 active run에 연결된다. Plan/Contract는 실제 CLI actor와 승인 시각을 남기고 approved 전이 뒤 불변이다. AI가 이 전이를 직접 실행해도 승인된 Contract의 `requiredChecks`만 completion/stop gate의 SSOT로 쓰이며, 승인된 Contract가 없을 때 RunState `requiredEvidenceTypes`가 fallback이다. 조작 초점인 active run과 완료 정책의 근거인 governed run은 분리되며, blocked/paused/passing 상태가 되어도 최신 연결 Run은 완료 판정에서 사라지지 않는다.

현재 RunStatus는 `active | blocked | passing | paused`, Run phase의 terminal 값은 `done`이다. Budget state는 `maxAttempts`와 `attemptsUsed`만 저장한다. Attempt exhaustion은 Run을 `blocked`로 만들고 이유를 `nextAction`에 남기며, 권한·scope·unsafe 작업도 별도 status가 아니라 guard 차단 이유로 표현한다. 검증 결과의 `passed | failed`는 RunStatus가 아니라 Verification Evidence status다.

### 4. Verification Evidence

`intent verify <type> -- <command...>`가 실제 명령을 실행하고 결과를 저장한다.

- 관련 코드: `src/runtime/verification.ts`
- schema: `VerificationEvidenceSchema`
- CLI: `intent verify`, `intent verify list`
- raw logs: `.intent/raw/<type>-results/*.log`

저장되는 정보는 evidence id, type, status, command/args, exit code, log path, startedAt/finishedAt이다. 같은 evidence type이 여러 번 실행되면 마지막으로 기록된 결과만 completion과 contract report를 결정하며, 이전 pass 뒤의 최신 fail을 과거 pass로 덮을 수 없다.

### 5. Observability / Monitor / Detection

trace/span 저장 구조가 있고 일부 작업이 자동 기록된다.

- Observability: `src/runtime/observability.ts`
- Monitor: `src/runtime/monitor.ts`
- Detection: `src/runtime/detections.ts`

자동 기록/탐지되는 것:

- pre-write guard가 검사한 edit/apply_patch span
- `intent command` wrapper와 PostToolUse(Bash)가 기록한 일반 `run_command` span
- `intent verify`가 실행한 check span
- failed verification의 deterministic errorSignature
- required evidence 없이 completion을 시도한 false_success
- 같은 command+args+exitCode 반복 실패
- 같은 errorSignature 반복 실패
- 같은 파일 반복 수정
- complete/stop/Stop hook에서 monitor detection 자동 생성
- candidate는 유형과 무관하게 기록만 하고 confirmed detection만 Run을 hard block

### 6. LLM-Wiki / Rule / Eval feedback

Detection Record를 wiki page, rule draft, eval draft로 전환하는 runtime과 CLI가 있다.

- Wiki ingest: `intent wiki ingest detection <id>`
- Rule feedback: `intent rule draft-from-detection`, `agents-candidate`, `ci-candidate`, `impact`, `reflect`
- Judge: `intent judge bundle`, `record`, `run`
- Reviewer/Eval: `intent reviewer checklist`, `intent eval draft-from-detection`, `intent eval run`

hook 안에서는 LLM/네트워크 호출을 하지 않는다. 외부 judge는 `intent judge run <detectionId> -- <command...>`로 hook 밖에서 candidate detection에만 실행한다.

## 최근 완료된 Phase 31

Phase 31은 운영 감사에서 확인된 실제 integrity 결함과 문서 과장을 함께 교정했다.

1. scope matcher는 absolute path와 모든 `..` traversal을 broad `**`보다 먼저 거부하고, write hook은 저장소 내부 absolute payload만 상대경로로 정규화한다.
2. outside-root/`..` payload는 차단하며 판정 전에 저장소 밖 Write 대상 파일을 읽지 않는다.
3. `RUN-1000`·`SPAN-1000` 이상 span 파일과 eval evidence reference를 로드하고 숫자순으로 유지한다.
4. 기존 Run과 Trace의 read-transform-write를 cross-process lock으로 직렬화하고 Span exclusive create를 유지한다.
5. Contract의 machine policy와 reviewer metadata를 schema 주석, show/report, reviewer checklist에서 명시적으로 분리한다.
6. 최종목표 RunState를 실제 status·phase·attempt budget 모델에 맞춘다.
7. 실제 governed Intent/Run/verification/Wiki 표본과 아직 입증하지 못한 운영 한계를 `docs/dogfooding-baseline.md`에 남긴다.
8. 전체 356개 테스트를 통과했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 31과 `docs/phase/phase-31-governance-integrity-hardening.md`를 본다.

## 최근 완료된 Phase 30

Phase 30은 Phase 18·28·29에서 도입한 human-only actor 정책만 대체했다. 이전 phase 문서는 당시 구현과 검증을 기록한 역사 자료로 유지하며 소급 수정하지 않는다.

1. 지원 Agent shell에서 모든 기존 approve/archive/resolve CLI를 허용한다.
2. `approved`를 사람 동의가 아니라 readiness·lineage·immutability 상태로 재정의한다.
3. approval 계열 전이에 `agent:codex`, `agent:claude-code`, `human` actor provenance를 기록한다.
4. AI와 사람에게 동일한 schema, 상태, lineage, phase precondition을 적용한다.
5. `.intent/` 직접 mutation 차단과 CLI-only writer 경계는 그대로 유지한다.
6. 사람의 수동 governance 명령 없이 feature workflow와 feedback/revision workflow가 진행되는 회귀 테스트를 요구한다.
7. 전체 346개 테스트, coverage, package dry-run, diff check를 통과했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 30과 `docs/phase/phase-30-autonomous-approval-policy.md`를 본다.

## 이전 완료 Phase 29

Phase 29에서 거버넌스 경계와 실제 배포·운영 준비를 재감사했다.

1. 당시 정책에 따라 지원 Agent Bash에서 human-only 승인과 직접 `.intent/` write를 사전 차단하고 위협 모델을 명시했다. 승인 차단 정책은 Phase 30이 대체하지만 직접 state write 차단은 유지한다.
2. semantic code edit는 줄 수와 무관하게 Intent/active Run governance를 요구한다.
3. 모든 candidate detection을 record-only로 통일하고 confirmed만 Run을 차단한다.
4. Intent+Run 완료 전이에 durable journal, idempotent retry, reconcile 복구를 추가했다.
5. 저장소 자체 hook/`.intent` dogfooding, Node 20/22 CI, MIT LICENSE, package allowlist/prepack을 추가했다.
6. CLI를 `core`·`feedback`·`knowledge` command 모듈로 분리하고 전체 344개 테스트를 통과했다.
7. Coverage line 89.26%, branch 71.38%, function 88.21%와 65-file package dry-run을 통과했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 29와 `docs/phase/phase-29-governance-operational-hardening.md`를 본다.

## 이전 완료 Phase 28

Phase 28에서 artifact lifecycle과 최종 completion audit를 마쳤다.

1. Interview/Plan/Contract에 revision과 supersedes lineage를 추가했다.
2. Approved artifact는 당시 human-only였던 archive 뒤에만 새 draft revision을 만든다. Phase 30부터 같은 순서를 AI가 직접 실행한다.
3. Contract→Plan→Interview archive 순서를 강제하고 Run pointer/phase를 pause 상태로 되돌린다.
4. Reconcile이 crash 뒤 archived pointer를 안전하게 제거한다.
5. Full suite 330/330과 line 89.14%, branch 71.40%, function 88.65% coverage를 통과했다.
6. 최종목표 matrix를 감사해 필수 구현 gap이 없음을 확인했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 28과 `docs/phase/phase-28-artifact-lifecycle-final-audit.md`를 본다.

## 이전 완료 Phase 27

Phase 27에서 2차 의미 판정·Judge 비용 정책과 completion의 마지막 contract 우회를 닫았다.

1. candidate thrashing의 stable semantic text와 external embedding vector cache를 추가했다.
2. Cosine similarity threshold를 통과한 후보만 Judge queue에 넣는다.
3. Embedding candidate/input/vector dimension과 Judge candidate/per-input/batch-input budget을 config로 제한한다.
4. 동일 Judge bundle digest와 adapter key 결과를 재사용한다.
5. Judge가 `thrashing/false_success/none`, 근거, confidence, suggested action을 저장할 수 있다.
6. Feature/fix completion은 approved matching Contract와 verify phase를 요구한다.
7. 전체 approved artifact/evidence completion chain의 CLI 회귀 테스트를 추가했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 27과 `docs/phase/phase-27-semantic-judge-completion-closure.md`를 본다.

## 이전 완료 Phase 26

Phase 26에서 partial multi-record update의 복구 경로를 추가했다.

1. sequential ID 정렬을 numeric suffix 기준으로 바꿔 1000+ 순서를 보장한다.
2. Run index를 validated RunState에서 계산하는 derived cache로 명시했다.
3. `intent reconcile` dry-run과 `--apply` CLI를 추가했다.
4. Interview/Plan/Contract/Run의 비어 있는 backlink만 idempotent하게 채운다.
5. 기존 lineage 값이 충돌하면 전체 apply를 거부한다.
6. corrupt Run index와 partial lineage를 한 번에 복구한 뒤 두 번째 실행이 no-op인 회귀 테스트를 추가했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 26과 `docs/phase/phase-26-lineage-reconciliation.md`를 본다.

## 이전 완료 Phase 25

Phase 25에서 verification evidence를 실제 scoped content에 결박했다.

1. deterministic file manifest와 SHA-256 aggregate digest schema를 추가했다.
2. approved Contract scope를 우선하고 없으면 Intent scope를 사용한다.
3. `.intent`, `.git`, `node_modules`는 state/환경 오염을 피하기 위해 제외한다.
4. `intent verify`가 command 종료 직후 provenance를 evidence에 저장한다.
5. completion은 current digest 불일치와 provenance 없는 legacy required evidence를 stale로 처리한다.
6. hook span 없이 직접 파일을 수정해도 completion context가 evidence를 무효화하는 end-to-end 테스트를 추가했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 25와 `docs/phase/phase-25-verification-content-provenance.md`를 본다.

## 이전 완료 Phase 24

Phase 24에서 governance state 손상과 sequential record 충돌 경계를 강화했다.

1. Rule/Run/Plan/Interview/Contract/Detection/Eval loader가 schema-invalid record를 fail-closed로 보고한다.
2. write/Stop hook이 corrupt Rule/Run state를 명시적으로 차단한다.
3. approved invalid regex rule은 승인 시 거부되고, 이미 저장돼 있으면 write를 fail-closed로 차단한다.
4. ID는 record 수가 아니라 가장 큰 numeric suffix 다음으로 할당한다.
5. 999 이후 ID도 loader가 인식한다.
6. 새 record는 atomic exclusive publish를 사용하고 동시 충돌 시 재할당한다.
7. 8개 동시 Intent creator가 손실 없이 고유 record를 만드는 회귀 테스트를 추가했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 24와 `docs/phase/phase-24-state-integrity-concurrent-create.md`를 본다.

## 이전 완료 Phase 23

Phase 23에서 승인 artifact와 실제 write 사이의 실행 전제를 게이트로 연결했다.

1. feature/fix Run은 `plan` phase에서 시작한다.
2. linked Interview가 있으면 승인 후에만 `interview -> plan`으로 전이한다.
3. `plan -> contract`는 같은 Run/Intent의 approved Plan을 요구한다.
4. `contract -> act`는 같은 Run/Intent의 approved Contract를 요구한다.
5. feature/fix의 비사소 write는 active Run이 `act`/`verify`이고 approved Contract가 연결된 경우에만 허용한다.
6. tidy/chore는 이 계약 전제를 선택적으로 유지한다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 23과 `docs/phase/phase-23-execution-precondition.md`를 본다.

## 이전 완료 Phase 22

Phase 22에서 governance integrity의 남은 우회 세 가지를 닫았다.

1. Contract 승인은 같은 Run/Intent의 approved linked Plan을 요구한다.
2. Interview lineage가 있으면 approved Interview와 Plan reference 일치도 검증한다.
3. required pass 이후 성공 edit span이 있으면 evidence를 stale로 판정한다.
4. malformed/schema-invalid Intent state를 더 이상 건너뛰지 않는다.
5. 손상/유실된 linked Contract는 write/Stop hook에서 fail-closed다.
6. atomic JSON 임시 파일 이름을 process/UUID별로 분리했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 22와 `docs/phase/phase-22-governance-integrity-hardening.md`를 본다.

## 이전 완료 Phase 21

Phase 21에서 구조 후보와 최종 판정을 분리하고 detector feedback을 실제 재생 가능하게 했다.

1. edit old-text anchor를 line bucket `regionKey`로 기록한다.
2. 동일 region 3회 수정과 edit/failed-command 반복 sequence를 후보로 찾는다.
3. 같은 파일의 서로 다른 영역은 region detection에서 분리한다.
4. candidate thrashing은 Run/complete를 hard block하지 않고 confirmed만 차단한다.
5. Detection-derived thrashing eval은 관련 span snapshot을 재생한다.
6. Detection resolve가 Wiki problem page를 자동 생성/갱신한다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 21과 `docs/phase/phase-21-structural-semantic-monitor-feedback.md`를 본다.

## 이전 완료 Phase 20

Phase 20에서 일반 shell command 관측을 Run trace와 Monitor에 연결했다.

1. command/args/cwd/output/exit code를 저장하는 `commands.ts` runtime을 추가했다.
2. `intent command -- <command...>` wrapper가 raw log와 `run_command` span을 남긴다.
3. Codex/Claude PostToolUse(Bash) hook이 실행 결과를 재실행 없이 기록한다.
4. failed command의 deterministic error signature를 저장한다.
5. 일반 command 실패도 repeated command/error signature detection 입력이 된다.
6. upstream hook이 놓치는 unified/streaming shell은 wrapper를 쓰도록 경계를 명시했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 20과 `docs/phase/phase-20-general-command-tracing.md`를 본다.

## 이전 완료 Phase 19

Phase 19에서 Interview를 first-class artifact로 만들었다.

1. 목표·맥락·제약·scope·성공/실패·검증·비목표·가정·질문을 schema로 저장한다.
2. `.intent/interviews/INTERVIEW-*.json` CRUD와 setup path를 추가했다.
3. `intent interview draft/show/list/link/approve` CLI를 추가했다.
4. 승인된 Interview 본문을 동결하고 downstream lineage만 append-only로 허용한다.
5. `run start --interview`, `spec draft --interview`, `plan draft`가 lineage를 자동 전파한다.
6. SessionStart와 handoff active Run에 Interview/Spec/Plan/Contract lineage를 노출한다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 19와 `docs/phase/phase-19-structured-interview-lineage.md`를 본다.

## 이전 완료 Phase 18

Phase 18에서 승인 artifact와 Run terminal 상태의 경계를 강화했다.

1. Plan/Contract 승인자와 승인 시각을 schema-validated state로 저장한다.
2. 승인되거나 archived된 Plan/Contract 내용 변경을 runtime에서 거부한다.
3. Draft Contract는 scope/completion policy를 바꾸지 않는다.
4. 승인된 Contract는 forbiddenScope뿐 아니라 allowedScope 밖 변경도 막는다.
5. Run phase는 순방향과 `verify -> act` 재작업만 허용한다.
6. `done/passing`은 성공한 completion evaluator만 설정한다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 18과 `docs/phase/phase-18-approval-lifecycle-run-fsm.md`를 본다.

## 이전 완료 Phase 17

Phase 17에서 completion integrity의 P0 우회를 닫았다.

1. active run과 governed run 조회를 분리했다.
2. feature/fix 완료에는 동일 Intent에 연결된 governed run을 요구한다.
3. run이 blocked/paused/passing 상태가 되어도 completion context에서 사라지지 않게 했다.
4. required evidence와 contract report에 latest-result-wins 규칙을 적용했다.
5. CLI complete/stop-check와 Stop hook이 같은 completion evaluator를 사용하게 했다.
6. run start가 Intent type에서 required evidence를 파생하도록 했다.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 17과 `docs/phase/phase-17-governed-completion-integrity.md`를 본다.

## 이전 완료 Phase 16

Phase 16에서 이전 추천 1-6은 구현 완료됐다.

1. Completion/Stop path와 monitor/detection 자동 연결.
2. 외부 Judge command adapter.
3. Approved rule impact report.
4. Monitor의 반복 파일 수정 탐지.
5. Spec/Plan 자동 run 연결.
6. AGENTS/CI candidate와 reflection 추적.

상세 ledger는 `docs/final-goal-phase-feature-spec.md`의 Phase 16과 `docs/phase/phase-16-automation-loop-closure.md`를 본다.

## 실제 남은 작업

### 운영 표본 확대 (구현 gap 아님)

현재 실제 governed work 이력은 setup-only 상태를 벗어났지만 세 개 Intent의 자기참조 표본에 불과하다. Detection 정밀도, Wiki 재사용률, 장기 friction에 대한 정량 주장은 아직 할 수 없다. `docs/dogfooding-baseline.md`의 수집 기준에 따라 3~5개 이상의 독립 feature/fix를 더 완료한다.

### 1. AGENTS/CI 자동 patch 적용 (선택)

현재는 AGENTS/CI 후보 출력과 reflection 상태 기록까지 제공한다. 실제 파일 자동 patch 적용은 별도 기능이지만, 추가될 경우 사람 전용 approval gate가 아니라 AI가 실행 가능한 dry-run·검증·provenance 흐름을 따라야 한다.

초기 구현 후보:

- `intent rule apply-agents-candidate <ruleId>`
- `intent rule apply-ci-candidate <ruleId>`
- dry-run diff, deterministic validation, actor provenance

## 문서 간 역할

### `hyohyeon-harness-최종목표.md`

상위 SSOT다. 코드와 나머지 문서는 이 문서를 향해야 한다.

### `docs/final-goal-phase-feature-spec.md`

구현 ledger다. Phase 1-31과 hardening 항목의 상태와 verification evidence를 기록한다.

### `README.md`

사람용 입구다. 설치, workflow, 주요 CLI, 현재 상태만 짧게 보여준다.

### `AGENT.md`

저장소 운영 기준 문서다. invariants, layout, build/test, hook architecture, security, anti-patterns를 둔다.

### `AGENTS.md`

Codex/Claude/기타 agent가 빠르게 읽는 quick-reference view다.

## 다음 phase 후보

필수 구현 phase는 완료됐다. 먼저 `docs/dogfooding-baseline.md`의 기준으로 3~5개 독립 feature/fix 표본을 축적하고, 그 과정에서 생긴 Detection/Rule/Eval 또는 AI-executable AGENTS/CI patch 기능을 별도 intent로 진행한다.
