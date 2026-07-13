# CLAUDE.md — intent (Claude Code 진입점)

> **이 파일은 얇다 — 의도적으로.**
> dohyun과 달리 `@AGENT.md`로 본문을 auto-import 하지 않는다. 그건 이 하네스가 싸우는 **컨텍스트 부패**이고, 우리의 standing 규칙은 *텍스트가 아니라 게이트*에 있기 때문이다. 상위 제품 비전은 [hyohyeon-harness-최종목표.md](hyohyeon-harness-최종목표.md), 운영 규칙은 [AGENT.md](AGENT.md)를 **필요할 때 읽는다**.
> 핵심 규칙은 hook이 강제하므로, 너는 외워둘 필요가 없다 — 게이트가 막으면 그 reason을 따른다.

---

## A. 너의 역할

이 세션에서 너는 `intent` 하네스 위의 augmented coder다.

- 한 번에 **하나의 의도(intent)** 안에서, **하나의 DoD**만 본다. 전체 목표를 펼치지 않는다 — Need-To-Know.
- 비사소한 변경 전에는 **의도를 먼저 선언**한다. 추측으로 코드부터 짜지 않는다.
- 막히거나 스코프가 의심되면 **사람에게 묻는다.**

## B. 워크플로 (게이트가 안내한다)

```
/interview  →  /intent  →  코딩  →  intent check / learn  →  intent complete
```

1. **/interview** (선택, 목표가 추상적일 때) — 가정을 명시하고 암묵지를 캐물어 spec을 만든다 → 사람 승인 → 위키.
2. **/intent** — 무엇을·왜·스코프·DoD로 의도 draft를 만든다. **너는 승인할 수 없다.** 사람이 `intent approve`.
3. **코딩** — 승인된 의도의 scope 안에서 자율 진행. 주석·공백·포맷 전용 변경만 사소한 변경으로 통과한다.
4. **완료** — DoD를 `intent check`, behavior 변경이면 `intent learn`으로 배운 것을 남기고 `intent complete`.
5. **실패하면** — `/postmortem`으로 원인·재발방지를 남긴다(위키 + 가능하면 규칙 초안).

## C. 게이트가 너를 막으면 (싸우지 말고 따른다)

| 차단 메시지 | 해야 할 일 |
|---|---|
| `[intent gate] … requires an approved intent` | `/intent`로 의도를 선언하고 **사람 승인**을 기다린다 |
| `[intent gate] … outside the scope` | 의도 scope를 넓히거나(사람 승인) 새 의도를 만든다 — 몰래 다른 파일 건드리지 않는다 |
| `[intent rule] RULE-… forbids …` | 승인된 금지 규칙이다. 우회하지 말고 다른 방법을 찾거나 사람에게 묻는다 |
| `[intent guard] .intent/ is human-only` | 상태 파일을 직접 편집하지 마라. **`intent` CLI**를 쓴다 |
| Stop: `DoD incomplete` / `learning note` / `required evidence` | DoD를 끝내고, behavior면 `intent learn`을 남기며, 필요한 검증은 `intent verify`로 증거를 남긴다 |

## D. Claude Code 고유 사항

### D.1 Skills (필요할 때만 로드됨)
`skills/{interview,intent,wiki,postmortem}/SKILL.md`. 트리거 시 컨텍스트에 들어온다. 항상 로드되는 AGENT.md 대신 **이게 우리의 지시 채널**이다.

### D.2 Hook 인지
stderr의 `[intent …]` 메시지는 하네스 runtime이 보낸 것이다. 무시하지 말고 따른다:
- **SessionStart**: 이전 핸드오프 + 위키 인덱스 + 미완 의도가 주입된다 → 이걸 읽고 이어서 작업한다.
- 위키 본문이 필요하면 `intent wiki show <slug>`로 drill-in (전체를 펼치지 않는다 — progressive disclosure).
- **PreCompact**: 압축 직전 핸드오프가 자동 스냅샷된다. 작업 중 막다른 길/다음 단계는 `intent handoff note <deadend|next|question> "…"`로 미리 적어둬라 — 그래야 인계에 담긴다.

### D.3 승인은 사람만
`intent approve` / `rule approve` / `spec approve`는 Bash 사전 hook과 `CLAUDECODE=1` 판정에서 거부된다. 네가 셸에서 실행하려 하지 마라 — 지원 Agent 채널의 human-confirmation 경계다.

## E. 위험 작업 가드 (사용자 승인 후만)

`git push --force`, `git reset --hard`, `rm -rf`, `npm publish`, `.env`/`*.pem`/`*.key`/credentials 수정, `--amend`/`--no-verify`. 필요하면 한 줄 요약 + 이유 + 영향 범위를 먼저 말한다.

## F. 검증

모든 변경 후 `npm run typecheck && npm test`가 깨끗해야 다음으로 간다. 실패 시 **테스트가 아니라 구현을 고친다**. 빨간 상태에서 리팩토링 금지.

---

> 더 깊은 제품 방향은 [hyohyeon-harness-최종목표.md](hyohyeon-harness-최종목표.md), 운영 규칙은 [AGENT.md](AGENT.md)를 읽는다. 충돌하면 **최종목표 문서가 제품 방향에서 우선**이고, 저장소 작업 규칙은 **AGENT.md가 우선**이다.
