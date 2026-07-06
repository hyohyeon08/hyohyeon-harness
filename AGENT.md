# AGENT.md — intent

> 사람과 에이전트가 이 저장소에서 일하기 위한 **단일 진실 원천(SSOT)** 이다.
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

`intent`는 AI가 코드를 짜기 전 **의도(무엇·왜)를 선언·승인**받게 하고, 지식·컨텍스트가 손실되지 않게 하는 개인 워크플로 하네스다. 두 레이어로 구성된다: **게이트 레이어**(의도·스코프·DoD·anti-cheat)와 **지식 레이어**(위키·핸드오프·실패규칙·spec).

### 1.1 Invariants (절대 깨지 않는 규칙)

| # | Invariant | 구현 |
|---|---|---|
| 1 | 비사소 변경은 **승인된 의도** 없이는 차단된다. 의도 승인은 **사람만**(AI는 draft만 작성). | `intent-gate.ts`, `intents.ts` |
| 2 | 변경 파일은 승인된 의도의 `scope` 안에 있어야 한다 (스코프 크리프 차단). | `scope.ts` |
| 3 | DoD 미완이거나, behavior 변경(feature/fix)에 **학습 노트가 없으면** 세션 종료가 차단된다. | `stop-gate.ts` |
| 4 | `.intent/`는 **CLI만** 쓴다. AI의 직접 Edit/Write/apply_patch는 가드가 차단한다. 승인 명령은 Claude/Codex AI 셸에서 거부된다(human-only). | `guard.ts`, `env.ts` |
| 5 | 게이트 규칙(`rules/*.json`)은 **사람 승인** 후에만 강제된다. 위키(`wiki/`)는 AI 자율(compile/lint, 승인 불요). | `rules.ts`, `wiki.ts` |
| 6 | Hook은 deterministic하다 — LLM/네트워크 호출 금지, 실패 시 silent exit 0(세션을 절대 중단 안 함). | `hooks/*` |
| 7 | 사소한 변경(≤5줄·주석/포맷·새 심볼/제어흐름/새파일 아님)은 게이트를 통과한다 — 마찰 최소화. | `triviality.ts` |

### 1.2 현재 상태

- v1(게이트 레이어) + v2(지식 레이어) 완성. Claude Code와 Codex 어댑터 지원. 200/200 테스트 통과.
- TypeScript + zod + `node:test`. 외부 런타임 의존성 없음(zod만).
- 미구현: README 외 docs/ 없음(의도적), breathe in/out 호흡 게이트(v3 후보), git 초기화.

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
│   ├── cli/index.ts            # CLI 디스패치
│   ├── runtime/                # 게이트·지식 로직 (순수, 테스트 가능)
│   │   ├── intent-gate.ts      # 척추: 의도 게이트 판정
│   │   ├── triviality.ts       # '사소함' 분류기
│   │   ├── scope.ts            # 글롭 스코프 매처
│   │   ├── stop-gate.ts        # DoD + 학습 게이트
│   │   ├── guard.ts            # .intent/ 보호 (anti-cheat 1차)
│   │   ├── env.ts              # Claude/Codex AI 셸 승인 가드 (anti-cheat 2차)
│   │   ├── rules.ts            # forbid-path/pattern 게이트 규칙
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
npm test          # build → node --test tests/*.test.mjs (200)

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

4개 hook 모두 얇은 어댑터다 (로직은 `src/runtime/*`).

| Event | 파일 | 역할 | 차단? | 채널 |
|---|---|---|---|---|
| `SessionStart` | `session-start.ts` | 핸드오프 + 위키 인덱스 + 미완 의도 주입 | 아니오 | stderr |
| `PreToolUse (Edit\|Write\|apply_patch)` | `pre-write-guard.ts` | ①`.intent/` 보호 ②게이트 규칙 ③의도+스코프 게이트 | **예** | stdout JSON / stderr |
| `Stop` | `stop-continue.ts` | DoD/학습 미완 차단 | **예** | stdout JSON |
| `PreCompact` | `pre-compact.ts` | 핸드오프 스냅샷 (압축 손실 방지) | 아니오 | stderr |

규칙: ① `PostToolUse` 미사용(부수효과·오염 방지). ② LLM 호출 금지(deterministic). ③ 실패 시 silent exit 0. ④ stdout=결정 JSON, stderr=컨텍스트. ⑤ 글롭 매칭은 root-상대 경로로 정규화한 뒤 수행(tool_input은 절대경로).

---

## 8. Security / Anti-cheat Rules

### 8.1 사람 전용 채널
- `.intent/` 전체는 AI가 직접 Edit/Write 못 한다 (`guard.ts`). 상태 변경은 **CLI로만**.
- `intent approve` / `intent rule approve` / `intent spec approve`는 Claude/Codex AI 셸에서 거부된다 — 사람의 셸에서만 (`env.ts`). Bash 우회까지 차단.
- 위키(`wiki/`)와 의도 draft는 AI가 CLI로 자율 작성 가능(승인 불요).

### 8.2 위험 작업 (사용자 승인 후만)
`git push --force`, `git reset --hard`, `rm -rf`, `npm publish`, `.env`/`*.pem`/`*.key`/credentials 수정, `--amend`/`--no-verify`.

### 8.3 비밀
secret 하드코딩 금지(환경변수/keychain). 로그에 secret 노출 금지.

---

## 9. Commit Guidelines (convention — 아직 게이트 미적용)

> dohyun과 달리 commit-msg hook이 없다. 아래는 **권장 규약**이며 강제되지 않는다. (필요 시 v3에서 게이트화 가능)

- Conventional 형식: `<type>: <subject>` (`feat|fix|refactor|docs|test|chore`).
- **구조 변경과 행위 변경을 같은 커밋에 섞지 않는다** (Tidy First). 둘 다 필요하면 구조 먼저.
- 본문에는 **왜**를 쓴다. 코드를 보면 아는 사실은 반복하지 않는다.
- 커밋/푸시는 사용자가 요청할 때만. force push는 명시적 승인 후.

---

## 10. Anti-Patterns (즉시 중단)

1. 승인된 의도 없이 비사소 변경을 밀어붙이기 → 게이트가 막는다. **의도를 먼저 선언**.
2. 의도 scope 밖 파일 수정 (스코프 크리프) → 의도 확장 또는 새 의도.
3. behavior 변경 완료에서 학습 노트 생략 → Stop이 막는다.
4. `.intent/` 파일을 Edit/Write로 직접 수정 (특히 status를 approved로) → 가드 차단. **CLI 사용**.
5. AI가 `intent approve`를 셸에서 실행 → AI 셸 가드 거부. 사람이 한다.
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

## 12. Out of Scope (현재)

- breathe in/out 호흡 게이트 (v3 후보 — feature N회 후 tidy 강제)
- 결정 ID 카탈로그(dohyun의 SYSTEM-DESIGN.md 같은 역참조 체계)
- 멀티 저장소 지식 공유 / Web UI / 동시성 데몬
- commit-msg 게이트 (현재 §9는 권장 규약)
