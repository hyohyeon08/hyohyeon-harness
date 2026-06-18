# intent

> **AI 코딩 하네스 — 이해하지 못한 코드는 들어올 수 없다.**
> _Understand before you ship._

`intent`는 개인용 AI 코딩 하네스다. AI가 코드를 짜기 **전에 의도(무엇을·왜)를 선언**하게 하고, 사람이 그것을 승인한 뒤에야 자율적으로 진행하게 한다. 승인된 의도 = 작업의 스코프 경계이자 **사람이 그 변경을 이해했다는 증거**다. 그리고 의도·결정·학습·실패는 세션을 넘어 영속한다.

## 철학 — 세 기둥

| 기둥 | 핵심 | 하네스에서 |
|---|---|---|
| **Kent Beck** (Augmented Coding) | 규칙은 프롬프트가 아니라 **파일 시스템 게이트**여야 한다 (텍스트 규칙은 부하 아래 무너진다) | 모든 강제는 hook/게이트 |
| **Andrej Karpathy** (Software 3.0) | *keep AI on the leash* · autonomy slider · 작은 증분 · LLM Wiki | 의도 승인 = leash의 손잡이, 위키 = 지식 보존 |
| **이해·학습 우선** (이 하네스 고유) | AI가 짠 걸 내가 이해 못 하면 통과 못 함 | **Intent-First Gate** + 학습 노트 강제 |

> 핵심 등식: **Agent = Model + Harness.** 모델을 신뢰성 있게 만드는 건 모델이 아니라 그 주위를 감싸는 게이트·피드백·지식 레이어다.

## 두 레이어

```
게이트 레이어 — "이해 못 한·범위 밖·미검증 코드를 막는다"
  intent-gate · triviality · scope · stop-gate · guard · rules
지식 레이어 — "지식과 컨텍스트를 잃지 않는다"
  wiki(LLM Wiki: 정보/문제 2영역) · handoff(인수인계) · postmortem(실패→규칙) · spec(GAP)
```

## 설치

```bash
npm install
npm run build
npm test          # 86 tests
```

다른 프로젝트에 적용 (한 줄):

```bash
npm link                              # 하네스 레포에서 한 번 — `intent`를 전역 등록
cd /path/to/your-project
intent setup --install-hooks          # .intent/ + .claude/settings.json(hook) + .claude/skills/
```

hook은 `.intent/` 없는 프로젝트에선 no-op이라, 전역 hook 등록도 다른 프로젝트를 건드리지 않는다.

## 워크플로

```
/interview  →  /intent  →  코딩  →  dod check / learn  →  complete
(GAP 줄이기)  (의도 선언)  (게이트가 안내)   (이해 검증)        (완료)
   │             │                                            │
   spec→위키     사람 승인                                   실패 시 /postmortem → 위키 + 규칙
                                          컨텍스트 80% → PreCompact → 핸드오프 → 다음 세션
```

## 명령

| 명령 | 역할 |
|---|---|
| `intent setup` / `status` | 초기화 / 현재 상태 |
| `intent draft "<무엇>" "<왜>" [--type --scope --dod]` | 의도 초안 (AI) |
| `intent approve <id>` | 의도 승인 (**사람만**) |
| `intent dod <id>` / `check <id> "<항목>"` | DoD 조회 / 체크 |
| `intent learn <id> "<배운 것>"` / `complete <id>` | 학습 기록 / 완료 |
| `intent wiki new <slug> "<제목>" --type <T> [--status]` | 위키 글 (type이 정보/문제 영역 결정) |
| `intent wiki list\|show\|index\|log\|lint\|resolve <slug>` | 목록·조회·인덱스·로그·건강점검·이슈 해결 |
| `intent rule draft <kind> <pattern> "<이유>"` / `approve <id>` | 게이트 규칙 (승인 **사람만**) |
| `intent postmortem "<제목>" --cause --prevent [--rule …]` | 실패 기록 → 위키 + 규칙 분기 |
| `intent spec draft "<제목>"` / `approve <slug>` | 공유 이해 문서 (승인 **사람만**) |
| `intent handoff [note <kind> "<텍스트>"]` | 인수인계 생성 / 작업 중 노트 |
| `intent stop-check` | Stop 게이트 점검 (hook이 사용) |

## 게이트 — 무엇이 막히나

| 시점 | 막는 것 |
|---|---|
| Edit/Write 직전 | ① `.intent/` 직접 편집 ② 승인된 forbid 규칙 ③ 승인된 의도 없는 비사소 변경 ④ 의도 스코프 밖 변경 |
| 세션 종료 | DoD 미완 / behavior 의도의 학습 노트 미작성 |
| 승인 명령 | `CLAUDECODE=1`(AI 셸)에서 `approve` 거부 — 사람 셸에서만 |

**사소한 변경**(≤5줄·주석/포맷)은 게이트를 통과한다 — 마찰 최소화.

## 구조

```
src/runtime/   게이트·지식 로직 (순수 함수, 테스트 가능)
src/cli/       intent CLI
src/state/     .intent/ 경로
hooks/         session-start · pre-write-guard · stop-continue · pre-compact
skills/        intent · interview · wiki · postmortem (SKILL.md)
.intent/       런타임 상태 (intents · rules · wiki/{knowledge,problems} · handoff · decisions · learnings)
```

## 문서

- [AGENT.md](AGENT.md) — 사람·에이전트용 **단일 진실 원천(SSOT)**: invariants, 레이아웃, 빌드/테스트, 규약, anti-patterns
- [CLAUDE.md](CLAUDE.md) — Claude Code 어댑터 (얇음, 의도적으로 AGENT.md를 auto-import 안 함)
- [AGENTS.md](AGENTS.md) — 크로스툴 quick reference

## 상태

v1(게이트) + v2(지식) 완성. 86/86 테스트 통과. breathe in/out 호흡 게이트는 v3 후보.

MIT License.
