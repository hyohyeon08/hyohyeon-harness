# AGENTS.md — intent harness

Personal AI coding harness. Not a platform, not a framework.
**Understand before you ship.** — 이해하지 못한 코드는 들어올 수 없다.

> 이 파일은 [AGENT.md](AGENT.md)(운영 기준 문서)의 quick-reference view다. 상세·근거는 AGENT.md를 본다.
> 상위 제품 비전과 구현 기준은 [hyohyeon-harness-최종목표.md](hyohyeon-harness-최종목표.md)다.

## Quick Reference

| Topic | Location |
|-------|----------|
| Invariants (의도·스코프·DoD·anti-cheat) | [AGENT.md §1.1](AGENT.md) |
| Repository layout | [AGENT.md §2](AGENT.md) |
| Build / test / verification | [AGENT.md §4](AGENT.md) |
| Hook architecture (6 hooks) | [AGENT.md §7](AGENT.md) |
| Security / anti-cheat | [AGENT.md §8](AGENT.md) |
| Claude Code 어댑터 | [CLAUDE.md](CLAUDE.md) |
| Codex 어댑터 | [.codex/hooks.template.json](.codex/hooks.template.json) · `.agents/skills` 설치 |
| Zod 계약 | [src/runtime/schemas.ts](src/runtime/schemas.ts) |
| 최종목표 gap | [docs/final-goal-gap-analysis.md](docs/final-goal-gap-analysis.md) |
| Phase ledger | [docs/final-goal-phase-feature-spec.md](docs/final-goal-phase-feature-spec.md) |

## Skills (필요할 때만 로드됨 — progressive disclosure)

| Skill | Trigger | Purpose |
|-------|---------|---------|
| Interview | Claude `/interview` · Codex `$interview` | GAP 줄이기 → 공유 이해 spec (구현 전) |
| Intent | Claude `/intent` · Codex `$intent` | 의도(무엇·왜·스코프·DoD) 선언 → draft |
| Wiki | Claude `/wiki` · Codex `$wiki` | LLM Wiki compile/lint (지식 축적) |
| Postmortem | Claude `/postmortem` · Codex `$postmortem` | 실패 → 원인·재발방지 → 위키 + 규칙 분기 |

## State Files

모두 `.intent/` 아래. read 시 zod 검증.

| Path | Purpose |
|------|---------|
| `intents/*.json` | 의도 (draft → approved → done) |
| `runs/*.json` `runs/latest-runs.json` | Agent 실행 상태, active run, evidence refs |
| `interviews/*.json` | Structured InterviewSummary, approval, append-only lineage |
| `plans/*.json` | Plan artifact, scope/test/risk/steps, human approval metadata |
| `contracts/*.json` | Sprint Contract, human approval, allowed/forbidden scope, required checks |
| `raw/*-results/*.log` | `intent verify` 원본 stdout/stderr 로그 |
| `raw/observability/traces/*.json` | Run trace index |
| `raw/observability/spans/*.json` | edit/apply_patch/command/verify span |
| `detections/*.json` | `thrashing` / `false_success` 후보와 판정 |
| `evals/*.json` | Detection 기반 regression eval draft |
| `rules/*.json` | 게이트 규칙 (draft → approved, 사람만) |
| `wiki/index.md` | 위키 인덱스 (SessionStart에 주입) |
| `wiki/knowledge/*.md` | 정보 위키 본문 (`intent wiki show`로 drill-in) |
| `wiki/problems/*.md` | 문제/실패 위키 본문 (`intent wiki show`로 drill-in) |
| `handoff/latest.md` | 세션 인수인계 (PreCompact가 생성) |
| `handoff/scratch.json` | 작업 중 노트 (dead-ends / next / questions) |
| `decisions.md` `learnings.md` | 결정 / 학습 로그 |
| `state.json` `config.json` | 세션 상태 / 설정(triviality 임계 등) |

## Current Gap

Phase 1-28 핵심 workflow 항목은 구현되어 있고 330개 테스트가 통과한다. Artifact revision/archive까지 닫혔고 feature/fix는 approved Contract chain, verify phase, fresh content provenance를 끝까지 요구한다.

필수 구현 gap은 없다. Upstream hook 밖 shell은 `intent command` wrapper를 사용하며, AGENTS/CI 자동 patch는 candidate/reflection 이후 사람이 명시적으로 선택하는 후속 기능으로 유지한다.

## Core Principles

### Harness (이 레포 운영 원칙)
1. **Gate, don't instruct** — 강제되는 규칙은 텍스트가 아니라 hook/게이트에 (Beck).
2. **Pure core, thin hooks** — 판정은 순수 함수, hook은 어댑터.
3. **Schema-validated** — 모든 state read는 zod 경유.
4. **Immutable updates** — spread, mutation 금지.
5. **CLI is the only writer of `.intent/`** — AI 직접 편집 차단 (anti-cheat).
6. **Knowledge in the wiki, not in always-loaded .md** — 컨텍스트 부패 방지.

`active`는 현재 작업 초점이고 `governed`는 완료 책임이다. Run이 blocked되어 active index에서 빠져도 feature/fix complete와 Stop은 그 Run의 latest required evidence를 계속 평가한다.

### 철학 에센스
1. **Intent-First** — 비사소 변경 전 의도 선언·사람 승인. 승인 = 이해의 증거.
2. **Autonomy slider** (Karpathy) — 의도 승인이 leash의 손잡이. 승인 후 scope 내 자율.
3. **작은 증분** — 한 의도 = 한 개념. 생성-검증 루프를 짧게.
4. **이해 게이트** — behavior 변경엔 학습 노트 필수.
5. **지식 복리** — LLM Wiki(Karpathy) + 핸드오프 + 실패→규칙. 컨텍스트가 압축돼도 손실 없음.

출처: Kent Beck *Augmented Coding* / Andrej Karpathy *Software 3.0 · LLM Wiki* / Anthropic *Effective context engineering*.
상세 프로토콜은 [AGENT.md](AGENT.md), Claude Code 적용은 [CLAUDE.md](CLAUDE.md).
