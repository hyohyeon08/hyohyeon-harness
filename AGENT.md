# AGENT.md — intent

> 사람과 에이전트가 이 저장소에서 일하기 위한 **운영 기준 문서**다.
> 상위 제품 비전과 최종 요구사항의 SSOT는 `hyohyeon-harness-최종목표.md`다.
> `CLAUDE.md`는 Claude Code 어댑터이며 본 문서를 **auto-import 하지 않는다** (의도적 — §0). 필요할 때 읽는다.
> `AGENTS.md`는 본 문서의 quick-reference view다.

---

## 0. 이 하네스의 메타 원칙 (왜 standing 규칙을 .md에 다 적지 않나)

이 프로젝트는 *"규칙은 텍스트가 아니라 게이트"*(Beck)와 *"컨텍스트 부패 방지"*(이 하네스의 존재 이유 중 하나)를 믿는다. 따라서:

- **강제되는 규칙은 게이트(hook)에 있다** — AGENT.md는 그것을 *설명*할 뿐 *집행*하지 않는다.
- **항상 로드되는 거대 .md를 만들지 않는다** — 그게 우리가 싸우는 컨텍스트 부패다. `CLAUDE.md`는 얇게 유지하고 본 문서를 `@import`하지 않는다. 본 문서는 *필요할 때 읽는 참조*다.
- **지식은 위키에 둔다** — 프로젝트 도메인 지식은 `.intent/wiki/`에 축적되고 SessionStart엔 인덱스만 주입된다(progressive disclosure).

---

## 1. Project Overview

`intent`는 `hyohyeon-harness`의 CLI다. 상위 제품 비전과 최종 요구사항은 `hyohyeon-harness-최종목표.md`가 기준이다.

현재 구현은 AI가 코드를 짜기 전 **의도(무엇·왜)를 선언**하고 준비 상태를 검토한 뒤 승인 checkpoint로 직접 전환하게 하며, Agent 실행 상태·검증 증거·관측 데이터·탐지 기록·지식·컨텍스트가 손실되지 않게 하는 개인 워크플로 하네스다. 세 레이어로 구성된다: **게이트 레이어**(의도·스코프·DoD·anti-cheat·contract), **실행 증거 레이어**(RunState·VerificationEvidence·Trace/Span·Detection), **지식 레이어**(위키·핸드오프·실패규칙·spec).

### 1.1 Invariants (절대 깨지 않는 규칙)

| # | Invariant | 구현 |
|---|---|---|
| 1 | 비사소 변경은 **승인된 의도** 없이는 차단된다. Agent는 의도·스코프·DoD가 실행 가능할 만큼 구체적인지 검토한 뒤 `intent approve`를 직접 실행한다. | `intent-gate.ts`, `intents.ts` |
| 2 | matcher의 변경 경로는 저장소 상대경로여야 하고 절대경로와 `..` traversal은 broad `**`보다 먼저 거부한다. Hook payload의 저장소 내부 절대경로만 상대경로로 정규화하며 outside-root와 `..`는 차단한다. 그 뒤 승인된 의도 `scope`를 적용한다. | `scope.ts`, `pre-write-guard.ts` |
| 3 | DoD 미완, behavior 변경(feature/fix)의 학습 노트·governed Run 부재, required type별 최신 evidence 미통과 중 하나라도 있으면 complete/Stop이 차단된다. Run status는 이 판정을 우회하지 않는다. | `completion.ts`, `stop-gate.ts`, `runs.ts` |
| 4 | `.intent/`는 **CLI만** 쓴다. 지원되는 Agent 채널의 직접 Edit/Write/apply_patch와 CLI를 우회한 Bash state write는 사전 가드가 차단한다. 승인·archive·resolve도 반드시 CLI로 수행한다. | `guard.ts`, `command-guard.ts` |
| 5 | 게이트 규칙(`rules/*.json`)은 Agent가 후보의 정확성·범위·근거를 검토하고 **approved readiness checkpoint**로 전환한 뒤에만 강제된다. 위키(`wiki/`)는 compile/lint를 포함해 Agent가 자율 관리한다. | `rules.ts`, `wiki.ts` |
| 6 | Hook은 deterministic하다 — LLM/네트워크 호출 금지, 실패 시 silent exit 0(세션을 절대 중단 안 함). | `hooks/*` |
| 7 | 주석·공백·포맷만 바꾸는 변경은 게이트를 통과한다. 코드 의미 변경은 줄 수와 무관하게 비사소 변경이다. | `triviality.ts` |
| 8 | Plan/Contract는 draft에서만 수정할 수 있고 Agent가 readiness 승인 시 행위자·시각을 기록한다. 승인된 Contract의 lineage·allowed/forbidden scope·required checks만 기계 강제 정책이다. 자연어 architecture/DoD/rubric/stop/user-decision 필드는 reviewer metadata이며 자동 completion gate가 아니다. | `plans.ts`, `contracts.ts`, `completion.ts`, `reviewer.ts` |
| 9 | 승인된 InterviewSummary 본문은 불변이고 downstream Intent/Spec/Plan/Run lineage는 기존 참조를 바꾸지 않는 append-only 갱신만 허용한다. | `interviews.ts` |
| 10 | 구조 monitor의 `candidate`는 최종 판정이 아니며 Run을 hard block하지 않는다. Agent가 evidence와 Judge 결과를 검토해 `confirmed`로 resolve한 detection만 실행을 차단한다. | `monitor.ts`, `detections.ts` |
| 11 | Contract 승인은 같은 Run/Intent의 approved Plan을 요구하고, required evidence는 마지막 성공 edit보다 최신이어야 한다. 손상된 Intent/linked Contract state는 write/Stop에서 fail-closed다. | `contracts.ts`, `completion.ts`, hooks |
| 12 | feature/fix의 비사소 write는 같은 Intent의 active Run이 `act`/`verify` phase이고 approved Contract가 연결된 경우에만 허용한다. `plan -> contract -> act` 전이는 승인 artifact를 전제로 한다. | `execution-governance.ts`, `pre-write-guard.ts` |
| 13 | governance artifact loader는 schema-invalid record를 숨기지 않고, 새 sequential record는 기존 파일을 덮어쓰지 않는 atomic exclusive create와 충돌 재시도를 사용한다. | runtime state modules, `utils/id.ts`, `utils/json.ts` |
| 14 | verification evidence는 승인 scope의 SHA-256 content manifest를 저장한다. completion은 현재 digest 불일치나 provenance 없는 legacy required evidence를 stale로 처리한다. | `provenance.ts`, `verification.ts`, `completion.ts` |
| 15 | Run index는 validated Run에서 재구축 가능한 derived cache다. Reconcile은 missing lineage만 idempotent하게 채우고 기존 lineage 충돌 시 전체 apply를 거부한다. | `reconcile.ts`, `runs.ts` |
| 16 | Embedding/Judge는 hook 밖에서 candidate thrashing에만 실행되고 vector/input/batch budget과 digest cache를 적용한다. Feature/fix completion은 approved Contract와 verify phase를 요구한다. | `judge-policy.ts`, `judge-adapter.ts`, `stop-gate.ts` |
| 17 | Interview/Plan/Contract 변경은 Agent가 approved artifact를 dependency 순서에 맞춰 archive한 뒤 supersedes lineage를 가진 새 draft revision으로 만든다. Archive는 Run pointer를 비우고 phase를 되돌려 새 revision 승인 전 실행을 멈춘다. | artifact runtimes, CLI |
| 18 | Intent와 Run의 terminal 전이는 durable completion journal을 먼저 쓴다. 중간 실패는 `reconcile`이 idempotent하게 마무리하며, terminal state와 committed journal의 불일치는 자동 수정하지 않고 fail-closed다. | `completion-transaction.ts`, `reconcile.ts` |
| 19 | 기존 Run과 Trace의 read-transform-write는 cross-process lock 안에서 수행한다. Span은 exclusive create로 발행하고 `RUN/SPAN-1000` 이상 ID도 로드·참조·숫자순 정렬한다. | `runs.ts`, `observability.ts`, `evals.ts`, `utils/json.ts` |

### 1.2 현재 상태

- 최종목표 기준 Phase 1-31 핵심 workflow, 완전 자율 lifecycle, governance integrity hardening 구현. Claude Code와 Codex 어댑터 지원. 356/356 테스트 통과.
- TypeScript + zod + `node:test`. 외부 런타임 의존성 없음(zod만).
- 필수 구현 gap: 없음. Upstream hook 밖 shell은 `intent command` wrapper가 필요하고 AGENTS/CI patch는 candidate/reflection을 거치는 별도 Agent 후속 작업이다.
- 구현 기준 문서: `hyohyeon-harness-최종목표.md` → `docs/final-goal-gap-analysis.md` → `docs/final-goal-phase-feature-spec.md`.

**Governed Run**은 completion 대상 Intent에 연결된 가장 최근 Run이다. `activeRun`은 현재 CLI 조작 초점이고 completion authority가 아니다. Run이 `blocked`, `paused`, `passing`으로 바뀌어 active index에서 빠져도 complete/Stop은 해당 Run과 required evidence를 계속 평가한다.

---

## 2. Repository Layout

```
intent/
├── AGENT.md            # 본 문서 (루트 SSOT)
├── CLAUDE.md           # Claude Code 어댑터 (얇음, @import 안 함)
├── AGENTS.md           # 크로스툴 quick reference
├── README.md           # 사람용 입구
├── package.json        # tsc / node:test / intent bin
├── tsconfig.json
│
├── src/
│   ├── cli/index.ts            # CLI 진입점·실행/artifact 디스패치
│   ├── cli/commands/           # core·feedback·knowledge 도메인 명령
│   ├── cli/shared.ts           # CLI context·공통 actor/flag helper
│   ├── runtime/                # 게이트·지식 로직 (순수, 테스트 가능)
│   │   ├── intent-gate.ts      # 척추: 의도 게이트 판정
│   │   ├── triviality.ts       # '사소함' 분류기
│   │   ├── scope.ts            # 글롭 스코프 매처
│   │   ├── stop-gate.ts        # DoD + 학습 게이트
│   │   ├── completion.ts       # governed Run context + CLI/Stop 공통 orchestration
│   │   ├── completion-transaction.ts # Intent + Run 완료 저널·재시도·복구
│   │   ├── guard.ts            # .intent/ 보호 (anti-cheat 1차)
│   │   ├── command-guard.ts    # Agent Bash의 .intent 직접 write 차단
│   │   ├── env.ts              # Claude/Codex 실행 actor 식별
│   │   ├── rules.ts            # forbid-path/pattern 게이트 규칙
│   │   ├── runs.ts             # RunState CRUD + phase FSM + terminal completion
│   │   ├── execution-governance.ts # artifact/phase 기반 실행 전제
│   │   ├── interviews.ts       # Structured InterviewSummary + append-only lineage
│   │   ├── plans.ts            # Plan artifact + approval immutability
│   │   ├── verification.ts     # 검증 명령 실행 + evidence/log 저장
│   │   ├── provenance.ts       # 승인 scope content manifest + SHA-256 digest
│   │   ├── reconcile.ts        # derived index + cross-artifact lineage recovery
│   │   ├── judge-policy.ts     # cached embedding + bounded Judge selection
│   │   ├── commands.ts         # 일반 command wrapper/hook log + run_command span
│   │   ├── contracts.ts        # Sprint Contract approval + allowed/forbidden scope
│   │   ├── observability.ts    # Trace/Span writer
│   │   ├── monitor.ts          # false_success/thrashing 구조 탐지
│   │   ├── detections.ts       # DetectionRecord CRUD + wiki ingest helper
│   │   ├── judge.ts            # LLM Judge 입력 bundle builder
│   │   ├── reviewer.ts         # reviewer checklist generator
│   │   ├── evals.ts            # detection-derived eval case draft + runner
│   │   ├── change-extract.ts   # tool_input → Change
│   │   ├── intents.ts          # 의도 CRUD
│   │   ├── wiki.ts             # LLM Wiki (compile/lint, 백링크)
│   │   ├── memory.ts           # SessionStart 주입 조립
│   │   ├── handoff.ts          # 인수인계 조립
│   │   ├── postmortem.ts       # 실패 → 위키 + 규칙 분기
│   │   ├── spec.ts             # 공유 이해 spec
│   │   └── schemas.ts          # zod 계약
│   └── state/paths.ts          # .intent/ 경로
│
├── hooks/              # 얇은 어댑터 (Beck H2/H3/H4)
│   ├── session-start.ts        # 메모리 주입
│   ├── pre-write-guard.ts      # PreToolUse: 보호·규칙·의도 게이트
│   ├── pre-command-guard.ts    # PreToolUse(Bash): 직접 state write 차단
│   ├── post-command.ts         # PostToolUse(Bash): 일반 command 관측
│   ├── stop-continue.ts        # Stop: DoD/학습 게이트
│   └── pre-compact.ts          # PreCompact: 핸드오프 스냅샷
│
├── skills/             # 필요할 때만 로드되는 워크플로 (progressive disclosure)
│   ├── interview/SKILL.md      # GAP 줄이기 → spec
│   ├── intent/SKILL.md         # 의도 선언
│   ├── wiki/SKILL.md           # 지식 compile/lint
│   └── postmortem/SKILL.md     # 실패 기록
│
├── tests/*.test.mjs    # node:test (게이트·지식 순수 함수)
├── .claude/settings.template.json  # Claude Code hook template
├── .codex/hooks.template.json      # Codex hook template
└── .intent/            # 런타임 상태 (setup이 생성)
    ├── intents/*.json          # 의도 (draft→approved→done)
    ├── runs/*.json             # Agent 실행 상태 + evidence refs
    ├── transactions/completions/*.json # Intent + Run 완료 트랜잭션 저널
    ├── plans/*.json            # Plan artifact (scope/test/risk/steps)
    ├── contracts/*.json        # Sprint Contract
    ├── raw/*-results/*.log     # verification raw logs
    ├── raw/observability/      # traces + spans
    ├── detections/*.json       # false_success/thrashing 후보·판정
    ├── evals/*.json            # detection-derived regression draft
    ├── rules/*.json            # 게이트 규칙 (draft→approved)
    ├── wiki/knowledge/*.md     # 정보 (concept·decision·spec·guide·source·overview)
    ├── wiki/problems/*.md      # 문제 (failure=해결·issue=미해결, status)
    ├── wiki/index.md + log.md  # 자동 인덱스(## 정보/## 문제) + 시간순 로그
    ├── handoff/latest.md + scratch.json
    └── decisions.md  learnings.md  state.json  config.json
```

---

## 3. Setup Commands

```bash
npm ci            # 또는 npm install
npm run build     # tsc → dist/
npm test          # build → node --test tests/*.test.mjs (356)
npm run coverage  # Node test coverage audit

node dist/src/cli/index.js setup    # .intent/ 골격 생성
node dist/src/cli/index.js status   # 현재 상태
```

Windows PowerShell에서 `npm.ps1` 실행 정책 오류가 나면 npm 명령은 `npm.cmd`로 실행한다.

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```

다른 프로젝트 적용 (자동): `npm link`로 `intent`를 전역 등록 후, 대상 프로젝트에서
```bash
intent setup --install-hooks   # .intent/ 생성 + Claude/Codex hooks 렌더·머지 + skills 복사
intent setup --install-codex   # Codex만: .codex/hooks.json + .agents/skills
intent setup --install-claude  # Claude Code만: .claude/settings.json + .claude/skills
```
hook은 `.intent/` 없는 프로젝트에선 no-op(`hooks/_env.ts`)이라 전역 hook 등록도 안전하다.

---

## 4. Build / Test / Verification Loop

```
Red (실패 테스트)  →  Green (최소 구현)  →  Refactor (구조 개선, green일 때만)
```

매 사이클 후 통과해야 다음으로 간다:

```bash
npm run typecheck   # tsc --noEmit, TS 에러 0
npm test            # 모든 테스트 통과
```

Windows PowerShell에서는 같은 검증을 `npm.cmd run typecheck`, `npm.cmd test`로 실행한다.

- 런타임 로직은 전부 **순수 함수**로 두고 단위 테스트한다 (hook은 그 위의 얇은 어댑터).
- 한 번에 하나의 DoD만 진행한다 (`intent dod <id>`).
- 테스트가 빨간 상태에서 리팩토링 금지 (Tidy First).
- 검증 실패 시 **테스트가 아니라 구현을 고친다** (테스트가 틀렸다는 강한 근거가 있을 때만 예외).

---

## 5. Code Style (TypeScript)

- `strict: true`. `as` 단언/`any` 지양 — 경계는 `unknown`으로 받아 **zod로 좁힌다**.
- **Mutation 금지** — spread로 새 객체. (`updateIntent` 패턴 참조)
- 모든 state read는 스키마 검증 경유 (`schemas.ts`). raw `JSON.parse` + 단언 금지.
- 원자적 쓰기: tmp + rename (`utils/json.ts writeJsonAtomic`).
- **게이트 판정은 순수 함수**로 분리한다 — hook/CLI는 그 위의 어댑터. (테스트 가능성 = 우리 설계의 축)
- 파일 한 개 = 한 책임. 과도하게 커지면 분해.

---

## 6. Testing

- `node:test` 빌트인. 테스트 파일 = `tests/*.test.mjs`, 컴파일된 `dist/`를 import.
- **Red 먼저.** 실패 테스트 없이 구현 금지.
- 한 테스트 = 한 행동. 의도가 드러나는 이름.
- 외부 호출 금지(네트워크/실제 LLM/git push). 순수 함수 위주라 자연히 격리됨.
- **Cheating 금지**: 테스트 삭제, `.skip`, `expect(true)`, assertion 주석 처리.
- end-to-end 스모크(hook을 JSON 페이로드로 파이프)는 단위 테스트가 못 잡는 경계 버그를 잡는다 — 실제로 절대경로 글롭매칭 버그를 이렇게 발견했다.

---

## 7. Hook Architecture

6개 hook 모두 얇은 어댑터다 (로직은 `src/runtime/*`).

| Event | 파일 | 역할 | 차단? | 채널 |
|---|---|---|---|---|
| `SessionStart` | `session-start.ts` | 핸드오프 + 위키 인덱스 + 미완 의도 주입 | 아니오 | stderr |
| `PreToolUse (Edit\|Write\|apply_patch)` | `pre-write-guard.ts` | ①`.intent/` 보호 ②게이트 규칙 ③의도+스코프 게이트 | **예** | stdout JSON / stderr |
| `PreToolUse (Bash)` | `pre-command-guard.ts` | CLI를 우회한 직접 `.intent/` state write를 실행 전에 차단 | **예** | stdout JSON / stderr |
| `PostToolUse (Bash)` | `post-command.ts` | command/output/exit code를 raw log + `run_command` span으로 기록 | 아니오 | silent |
| `Stop` | `stop-continue.ts` | DoD/학습 + governed Run + latest required evidence 판정 | **예** | stdout JSON |
| `PreCompact` | `pre-compact.ts` | 핸드오프 스냅샷 (압축 손실 방지) | 아니오 | stderr |

규칙: ① `PostToolUse`는 결과를 재실행하거나 차단하지 않고 관측만 한다. ② LLM 호출 금지(deterministic). ③ 실패 시 silent exit 0. ④ stdout=결정 JSON, stderr=컨텍스트. ⑤ 글롭 매칭은 root-상대 경로로 정규화한 뒤 수행(tool_input은 절대경로).

---

## 8. Security / Anti-cheat Rules

### 8.1 CLI 전용 상태 채널
- `.intent/` 전체는 Agent가 직접 Edit/Write/apply_patch하거나 임의 Bash write로 바꾸지 않는다 (`guard.ts`, `command-guard.ts`). 상태 변경은 **CLI로만** 수행한다.
- `intent approve`와 artifact/rule approval·archive·detection resolve는 Agent가 readiness와 근거를 확인한 뒤 직접 실행한다. 이 명령들도 schema validation, lifecycle prerequisite, immutable update 규칙을 우회하지 않는다.
- 승인은 외부 허가가 아니라 검토가 끝난 artifact를 동결하고 lineage·scope·evidence policy를 활성화하는 내부 checkpoint다. 같은 artifact를 수정해야 하면 직접 상태를 고치지 말고 archive → revise → approve lifecycle을 따른다.
- 이 경계는 설치된 Claude/Codex hook과 CLI를 따르는 **지원 채널의 상태 무결성 경계**다. 같은 OS 사용자 권한으로 hook 밖에서 임의 프로세스를 실행하는 적대자를 격리하는 보안 샌드박스는 아니며, 그 위협에는 별도 OS 계정·sandbox가 필요하다.

### 8.2 위험 작업 권한 경계
`git push --force`, `git reset --hard`, `rm -rf`, `npm publish`, `.env`/`*.pem`/`*.key`/credentials 수정, `--amend`/`--no-verify`는 현재 작업 목표와 허용 scope가 명시적으로 요구할 때만 수행한다. 별도 lifecycle 승인 handoff는 만들지 않으며, host/sandbox가 강제하는 권한 경계는 그대로 따른다.

### 8.3 비밀
secret 하드코딩 금지(환경변수/keychain). 로그에 secret 노출 금지.

---

## 9. Commit Guidelines (convention — 아직 게이트 미적용)

> dohyun과 달리 commit-msg hook이 없다. 아래는 **권장 규약**이며 강제되지 않는다. (필요 시 v3에서 게이트화 가능)

- Conventional 형식: `<type>: <subject>` (`feat|fix|refactor|docs|test|chore`).
- **구조 변경과 행위 변경을 같은 커밋에 섞지 않는다** (Tidy First). 둘 다 필요하면 구조 먼저.
- 본문에는 **왜**를 쓴다. 코드를 보면 아는 사실은 반복하지 않는다.
- 커밋/푸시는 현재 작업 목표에 포함될 때만 수행한다. force push는 작업 목표가 그 동작 자체를 명시적으로 요구할 때만 수행한다.

---

## 10. Anti-Patterns (즉시 중단)

1. 승인된 의도 없이 비사소 변경을 밀어붙이기 → 게이트가 막는다. **의도를 먼저 선언**.
2. 의도 scope 밖 파일 수정 (스코프 크리프) → 의도 확장 또는 새 의도.
3. behavior 변경 완료에서 학습 노트 생략 → Stop이 막는다.
4. `.intent/` 파일을 Edit/Write/Bash로 직접 수정 (특히 status를 approved로) → 사전 가드 차단. **CLI 사용**.
5. 준비된 artifact의 approve/archive/resolve 명령을 사용자에게 떠넘기거나 `.intent/`를 직접 고치기 → Agent가 readiness를 검토하고 **CLI 명령을 직접 실행**한다.
6. 테스트 삭제/`.skip`/가짜 assertion (cheating).
7. 빨간 테스트 상태에서 리팩토링.
8. 게이트 규칙을 위키에 넣기 (강제되는 건 `rules/`, 읽는 지식은 `wiki/`).
9. hook 안에서 LLM/네트워크 호출, 또는 throw로 세션 중단.
10. standing 규칙을 거대 .md에 적어 always-load (컨텍스트 부패) — 게이트나 스킬로.

---

## 11. When You're Stuck

| 질문 | 볼 곳 |
|---|---|
| "지금 워크플로가 뭐지?" | README §워크플로 / `skills/interview`, `skills/intent` |
| "게이트가 왜 막지?" | 차단 메시지의 reason (게이트가 직접 설명) + 본 문서 §1.1, §7 |
| "이 프로젝트 도메인 지식은?" | `intent wiki show index` → `intent wiki show <slug>` (정보 영역) |
| "이전 세션은 뭘 했지?" | `.intent/handoff/latest.md` (SessionStart가 주입) |
| "과거 문제/미해결 이슈는?" | `intent wiki lint` (open problems) · `wiki/problems/` |
| "왜 이렇게 설계됐지?" | 코드 주석(결정 근거 인라인) + 본 문서 |

---

## 12. Remaining Gaps (최종목표 기준)

- 필수 구현 gap은 없다. 저장소 자체도 실제 Intent/Run/Plan/Contract/evidence/Wiki 이력으로 동일 게이트를 dogfood한다. 표본과 한계는 `docs/dogfooding-baseline.md`에 고정한다.
- 운영 검증 표본은 아직 작다. detection precision, Wiki 재사용, 장기 마찰에 관한 정량 주장은 3~5개 이상의 독립 feature/fix를 더 완료한 뒤에만 한다.
- Upstream hook 밖 shell과 unobserved direct write는 host가 제공하지 않는 관측 경계이므로 `intent command` wrapper가 필요하다.
- 같은 OS 사용자 권한의 적대적 프로세스 격리는 제품 범위 밖이며 별도 OS account/sandbox/approval broker가 필요하다.
- AGENTS/CI patch 적용은 candidate/reflection 추적과 분리된 명시적 Agent 후속 작업으로 남긴다.
- breathe in/out 호흡 게이트와 commit-msg 게이트는 후속 후보로 남아 있다.
