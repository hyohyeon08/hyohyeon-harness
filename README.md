# intent

> **AI 코딩 하네스 — 이해하지 못한 코드는 들어올 수 없다.**
> _Understand before you ship._

`intent`는 `hyohyeon-harness`의 CLI다. `hyohyeon-harness`는 개인용 Agent Harness이고, 상위 요구사항은 [hyohyeon-harness-최종목표.md](hyohyeon-harness-최종목표.md)가 기준이다.

현재 CLI는 AI가 코드를 짜기 **전에 의도(무엇을·왜)를 선언**하고, 준비 상태를 스스로 검증한 뒤 승인 checkpoint로 올리게 한다. 승인된 의도 = 작업의 동결된 스코프 경계이자 **Agent가 무엇을·왜·어디까지 바꿀지 이해했다는 실행 준비 증거**다. 그리고 의도·실행 상태·검증 증거·관측 데이터·탐지 기록·결정·학습·실패는 세션을 넘어 영속한다.

## 철학 — 세 기둥

| 기둥 | 핵심 | 하네스에서 |
|---|---|---|
| **Kent Beck** (Augmented Coding) | 규칙은 프롬프트가 아니라 **파일 시스템 게이트**여야 한다 (텍스트 규칙은 부하 아래 무너진다) | 모든 강제는 hook/게이트 |
| **Andrej Karpathy** (Software 3.0) | autonomy slider · 작은 증분 · LLM Wiki | 승인 checkpoint = 자율 실행 경계, 위키 = 지식 보존 |
| **이해·학습 우선** (이 하네스 고유) | 의도·스코프·검증을 설명할 수 없는 코드는 통과 못 함 | **Intent-First Gate** + 학습 노트 강제 |

> 핵심 등식: **Agent = Model + Harness.** 모델을 신뢰성 있게 만드는 건 모델이 아니라 그 주위를 감싸는 게이트·피드백·지식 레이어다.

## 두 레이어

```
게이트 레이어 — "이해 못 한·범위 밖·미검증 코드를 막는다"
  intent-gate · triviality · scope · stop-gate · guard · rules · contract
지식 레이어 — "지식과 컨텍스트를 잃지 않는다"
  wiki(LLM Wiki: 정보/문제 2영역) · handoff(인수인계) · postmortem(실패→규칙) · spec(GAP)
실행 증거 레이어 — "Agent 작업을 관찰 가능하게 만든다"
  run · verification evidence · observability trace/span · detection · reviewer/eval
```

## 설치

```bash
npm install
npm run build
npm test          # 356 tests
npm run coverage  # line/branch/function coverage
```

Windows PowerShell에서 `npm.ps1` 실행 정책 오류가 나면 npm 스크립트는 `npm.cmd`로 실행한다.

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```

다른 프로젝트에 적용 (한 줄):

```bash
npm link                              # 하네스 레포에서 한 번 — `intent`를 전역 등록
cd /path/to/your-project
intent setup --install-hooks          # .intent/ + Claude/Codex hooks + skills
```

`--install-hooks` 는 Claude Code(`.claude/settings.json`, `.claude/skills`)와 Codex(`.codex/hooks.json`, `.agents/skills`)를 함께 설치한다. 한쪽만 필요하면 `--install-claude` 또는 `--install-codex` 를 쓴다.
hook은 `.intent/` 없는 프로젝트에선 no-op이라, 전역/공유 hook 등록도 다른 프로젝트를 건드리지 않는다.

## 워크플로

Claude Code에서는 `/intent` 형태로, Codex에서는 `$intent` 형태로 repo skill을 명시 호출한다. 자연어 요청과 skill description이 맞으면 자동 선택될 수도 있다.

```
/interview → /intent → AI readiness 승인 → run start → 코딩 → intent verify
   │                                    │                    │
   spec→위키                         Plan/Contract      dod check / learn
                                                            │
                                                        complete
                                                            │
                                         실패 시 /postmortem → 위키 + 규칙
```

feature/fix의 `run start`는 완료 증거를 소유하는 governed Run을 만든다. `active`는 현재 조작 초점일 뿐이며, governed Run은 `blocked`/`paused`/`passing` 상태에서도 complete/Stop 판정에 계속 사용된다. Required evidence는 type별 최신 결과만 유효하므로 이후 실패가 이전 성공을 무효화한다.

Agent는 Interview/Intent/Plan/Contract/Spec/Rule이 충분히 구체적이고 내부 전제조건을 만족하면 해당 `approve` 명령을 직접 실행하고 다음 단계로 진행한다. 변경이 필요하면 dependency 순서에 맞춰 `archive`와 `revise`를 직접 수행하며, detection도 근거가 충분할 때 `resolve`한다. 승인 상태는 사람의 별도 허가가 아니라 **검토가 끝난 artifact를 동결하고 lineage·scope·evidence gate를 활성화하는 내부 readiness checkpoint**다.

## 명령

| 명령 | 역할 |
|---|---|
| `intent setup` / `status` | 초기화 / 현재 상태 |
| `intent draft "<무엇>" "<왜>" [--type --scope --dod]` | 의도 초안 |
| `intent approve <id>` | 준비된 의도를 승인 checkpoint로 전환 (Agent가 직접 실행) |
| `intent dod <id>` / `check <id> "<항목>"` | DoD 조회 / 체크 |
| `intent learn <id> "<배운 것>"` / `complete <id>` | 학습 기록 / 완료 |
| `intent run start <intentId> "<목표>"` / `status` / `list` / `note` / `phase` / `status-set` / `next` / `budget` / `attempt` | Agent 실행 단위와 governed completion context 추적 |
| `intent interview draft\|show\|list\|link\|approve\|archive\|revise` | 구조화된 InterviewSummary, append-only lineage, revision lifecycle |
| `intent plan draft\|show\|list\|link\|approve\|archive\|revise` | Plan 생성·연결·readiness 승인·archive·새 draft revision |
| `intent verify <type> -- <command...>` / `list` | 검증 명령 실행·raw log·Run evidence 저장. Required type별 최신 결과가 completion에 사용됨 |
| `intent command -- <command...>` | 일반 shell command 실행·exit code·raw log·`run_command` span 저장 |
| `intent reconcile [--apply]` | derived Run index, cross-artifact backlink, 중단된 completion journal을 dry-run/복구. 충돌은 자동 수정하지 않음 |
| `intent contract draft [runId]` / `show` / `list` / `approve` / `archive` / `revise` / `edit` / `report` | Sprint Contract 승인·revision·리포트. Archive 시 Run pause |
| `intent monitor active\|run <runId>` | 반복 실패·동일 edit region·tool sequence 후보 생성. candidate는 기록만, confirmed만 blocked 전이 |
| `intent detection list\|show\|resolve` | thrashing/false_success 후보 조회·판정 |
| `intent judge policy\|semantic\|queue\|batch\|bundle\|record\|run` / `reviewer checklist` / `eval draft-from-detection\|run` | Cached embedding similarity, bounded Judge adapter, 리뷰 체크리스트, eval |
| `intent wiki new <slug> "<제목>" --type <T> [--status]` | 위키 글 (type이 정보/문제 영역 결정) |
| `intent wiki list\|show\|index\|log\|lint\|resolve <slug>` / `ingest detection <id>` | 목록·조회·인덱스·로그·건강점검·이슈 해결·detection ingest |
| `intent rule draft` / `draft-from-detection` / `agents-candidate` / `ci-candidate` / `impact` / `reflect` / `approve` | 게이트 규칙, AGENTS/CI 후보, 반영 추적, readiness 승인 |
| `intent postmortem "<제목>" --cause --prevent [--rule …]` | 실패 기록 → 위키 + 규칙 분기 |
| `intent spec draft "<제목>"` / `link <slug> [runId]` / `approve <slug>` | 공유 이해 문서와 Run 연결·readiness 승인 |
| `intent handoff [note <kind> "<텍스트>"]` | 인수인계 생성 / 작업 중 노트 |
| `intent stop-check` | Stop 게이트 점검 (hook이 사용) |

## 게이트 — 무엇이 막히나

| 시점 | 막는 것 |
|---|---|
| Bash 직전 | CLI를 우회한 직접 `.intent/` state write |
| Edit/Write 직전 | ① `.intent/` 직접 편집 ② 승인된 forbid 규칙 ③ 승인된 active contract의 allowed/forbidden scope ④ 승인된 의도 없는 비사소 변경 ⑤ 의도 스코프 밖 변경 ⑥ feature/fix의 act/verify phase·approved Contract 부재 |
| 세션 종료 | DoD 미완 / behavior 학습 노트·governed Run 부재 / latest required evidence missing·failed |

**사소한 변경**은 주석·공백·포맷 전용 변경으로 제한한다. 값·조건·반환값을 포함한 코드 의미 변경은 줄 수와 무관하게 승인된 Intent가 필요하다.

`blocked`는 completion 책임을 제거하지 않는다. 원인을 해결하고 required check를 다시 통과해야 하며, complete/Stop을 반복해도 같은 governed Run이 평가된다.

## 구조

```
src/runtime/   게이트·지식 로직 (순수 함수, 테스트 가능)
src/cli/       intent CLI 진입점 + commands/{core,feedback,knowledge}
src/state/     .intent/ 경로
hooks/         session-start · pre-command-guard · pre-write-guard · post-command · stop-continue · pre-compact
skills/        intent · interview · wiki · postmortem (SKILL.md)
.intent/       런타임 상태 (intents · runs · completion transactions · contracts · raw · detections · evals · rules · wiki · handoff)
.github/       Node 20/22 CI
```

## 문서

- [AGENT.md](AGENT.md) — 사람·에이전트용 **단일 진실 원천(SSOT)**: invariants, 레이아웃, 빌드/테스트, 규약, anti-patterns
- [CLAUDE.md](CLAUDE.md) — Claude Code 어댑터 (얇음, 의도적으로 AGENT.md를 auto-import 안 함)
- [AGENTS.md](AGENTS.md) — 크로스툴 quick reference
- [hyohyeon-harness-최종목표.md](hyohyeon-harness-최종목표.md) — 상위 제품 비전과 최종 요구사항
- [docs/final-goal-gap-analysis.md](docs/final-goal-gap-analysis.md) — 최종목표 대비 현재 구현률과 남은 gap
- [docs/final-goal-phase-feature-spec.md](docs/final-goal-phase-feature-spec.md) — phase별 구현 ledger와 다음 작업
- [docs/dogfooding-baseline.md](docs/dogfooding-baseline.md) — 실제 governed work 표본과 아직 입증하지 못한 운영 한계

## 상태

최종목표 기준 Phase 1-31 핵심 workflow, 완전 자율 lifecycle, governance integrity hardening이 구현되어 있고 356/356 테스트가 통과한다. 이 저장소는 tracked hook 설치뿐 아니라 실제 Intent/Run/Plan/Contract/verification/Wiki 이력을 남기며 스스로를 dogfood한다. 다만 현재 운영 표본은 작고 자기참조적이므로 detection 정밀도나 장기 지식 복리의 근거로 과장하지 않는다. 상세 표본과 다음 3~5개 독립 작업의 수집 기준은 [dogfooding baseline](docs/dogfooding-baseline.md)에 있다.

MIT License.
