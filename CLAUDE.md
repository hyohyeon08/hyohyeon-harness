# CLAUDE.md — intent (Claude Code 진입점)

> **이 파일은 얇다 — 의도적으로.**
> dohyun과 달리 `@AGENT.md`로 본문을 auto-import 하지 않는다. 그건 이 하네스가 싸우는 **컨텍스트 부패**이고, 우리의 standing 규칙은 *텍스트가 아니라 게이트*에 있기 때문이다. 상위 제품 비전은 [hyohyeon-harness-최종목표.md](hyohyeon-harness-최종목표.md), 운영 규칙은 [AGENT.md](AGENT.md)를 **필요할 때 읽는다**.
> 핵심 규칙은 hook이 강제하므로, 너는 외워둘 필요가 없다 — 게이트가 막으면 그 reason을 따른다.

---

## A. 너의 역할

이 세션에서 너는 `intent` 하네스 위의 augmented coder다.

- 한 번에 **하나의 의도(intent)** 안에서, **하나의 DoD**만 본다. 전체 목표를 펼치지 않는다 — Need-To-Know.
- 비사소한 변경 전에는 **의도를 먼저 선언**한다. 추측으로 코드부터 짜지 않는다.
- 막히거나 스코프가 의심되면 repository evidence를 먼저 조사하고, 기존 checkpoint를 억지로 우회하지 말고 작은 새 의도나 revision으로 경계를 다시 고정한다. 제품 선택이 실제로 빠져 있어 안전한 가정이 불가능할 때만 질문한다.

## B. 워크플로 (게이트가 안내한다)

```
/interview  →  /intent  →  코딩  →  intent check / learn  →  intent complete
```

1. **/interview** (선택, 목표가 추상적일 때) — 가정을 명시하고 암묵지를 확인해 spec을 만든다. 내용이 일관되고 열린 결정이 해소되면 Interview와 spec을 직접 승인한다.
2. **/intent** — 무엇을·왜·스코프·DoD로 의도 draft를 만들고 한 개념·검증 가능성·scope를 점검한 뒤 `intent approve`를 직접 실행한다.
3. **코딩** — 승인된 의도의 scope 안에서 Plan/Contract readiness chain을 직접 준비·승인하고 자율 진행한다. 주석·공백·포맷 전용 변경만 사소한 변경으로 통과한다.
4. **완료** — DoD를 `intent check`, behavior 변경이면 `intent learn`으로 배운 것을 남기고 `intent complete`.
5. **실패하면** — `/postmortem`으로 원인·재발방지를 남긴다(위키 + 가능하면 규칙 초안).

## C. 게이트가 너를 막으면 (싸우지 말고 따른다)

| 차단 메시지 | 해야 할 일 |
|---|---|
| `[intent gate] … requires an approved intent` | `/intent`로 의도를 선언하고 readiness를 검토한 뒤 `intent approve`를 직접 실행한다 |
| `[intent gate] … outside the scope` | 기존 의도를 억지로 우회하지 말고 더 정확한 새 의도를 만들고 직접 승인한다 |
| `[intent rule] RULE-… forbids …` | 승인된 금지 규칙이다. 우회하지 말고 scope 안의 다른 방법을 찾는다 |
| `[intent guard] .intent/ …` | 상태 파일을 직접 편집하지 마라. **`intent` CLI**를 쓴다 |
| Stop: `DoD incomplete` / `learning note` / `required evidence` | DoD를 끝내고, behavior면 `intent learn`을 남기며, 필요한 검증은 `intent verify`로 증거를 남긴다 |

## D. Claude Code 고유 사항

### D.1 Skills (필요할 때만 로드됨)
`skills/{interview,intent,wiki,postmortem}/SKILL.md`. 트리거 시 컨텍스트에 들어온다. 항상 로드되는 AGENT.md 대신 **이게 우리의 지시 채널**이다.

### D.2 Hook 인지
stderr의 `[intent …]` 메시지는 하네스 runtime이 보낸 것이다. 무시하지 말고 따른다:
- **SessionStart**: 이전 핸드오프 + 위키 인덱스 + 미완 의도가 주입된다 → 이걸 읽고 이어서 작업한다.
- 위키 본문이 필요하면 `intent wiki show <slug>`로 drill-in (전체를 펼치지 않는다 — progressive disclosure).
- **PreCompact**: 압축 직전 핸드오프가 자동 스냅샷된다. 작업 중 막다른 길/다음 단계는 `intent handoff note <deadend|next|question> "…"`로 미리 적어둬라 — 그래야 인계에 담긴다.

### D.3 Artifact lifecycle은 Agent 책임
`intent approve`, artifact/rule `approve`, Interview/Plan/Contract `archive`·`revise`, `detection resolve`는 준비 근거가 충족되면 네가 직접 실행한다. 승인은 외부 허가 요청이 아니라 검토가 끝난 artifact를 동결하고 lineage·scope·evidence gate를 활성화하는 readiness checkpoint다. 변경이 필요하면 Contract → Plan → Interview dependency 순서로 archive하고 새 revision을 만든 뒤 다시 승인한다. 단, `.intent/` 파일을 Edit/Write/Bash로 직접 고치는 것은 계속 금지되며 모든 상태 전이는 `intent` CLI로만 수행한다.

## E. 위험 작업 권한 경계

`git push --force`, `git reset --hard`, `rm -rf`, `npm publish`, `.env`/`*.pem`/`*.key`/credentials 수정, `--amend`/`--no-verify`는 현재 작업 목표와 허용 scope가 그 동작을 명시적으로 요구할 때만 수행한다. 별도 lifecycle 승인 handoff는 만들지 않고, host/sandbox가 강제하는 권한 경계는 따른다.

## F. 검증

모든 변경 후 `npm run typecheck && npm test`가 깨끗해야 다음으로 간다. 실패 시 **테스트가 아니라 구현을 고친다**. 빨간 상태에서 리팩토링 금지.

---

> 더 깊은 제품 방향은 [hyohyeon-harness-최종목표.md](hyohyeon-harness-최종목표.md), 운영 규칙은 [AGENT.md](AGENT.md)를 읽는다. 충돌하면 **최종목표 문서가 제품 방향에서 우선**이고, 저장소 작업 규칙은 **AGENT.md가 우선**이다.
