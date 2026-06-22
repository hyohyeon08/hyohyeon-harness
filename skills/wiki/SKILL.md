---
name: wiki
description: 프로젝트 지식(도메인 사실·결정·spec·학습·재발방지)을 LLM Wiki에 축적·정리하고 질의한다. 새로 알게 된 사실이 생기거나, 세션 지식을 정리하거나, "위키 정리/기록", "/wiki", "$wiki", 압축이 임박했을 때 사용. 지식이 휘발되지 않게 하는 작업이면 적극 트리거.
---

# /wiki — LLM Wiki (Karpathy 패턴, 코딩 도메인 적응)

지식이 매 세션 재유도되지 않도록 `.intent/wiki/` 에 **한 번 컴파일해 누적**한다.
가드가 `.intent/` 직접 편집을 막으므로 **반드시 `intent wiki` CLI** 로만 쓴다 (Bash 호출).

## 구조 — 정보와 문제를 분리 (참고: jidohyun/llm-wiki)

```
wiki/
├── knowledge/<slug>.md   # 정보: concept · decision · spec · guide · source · overview
├── problems/<slug>.md    # 문제: failure(해결됨) · issue(미해결)
├── index.md              # 자동 생성. ## 정보 / ## 문제(미해결·해결됨)로 분리. SessionStart에 이것만 주입
└── log.md                # 시간순 로그 `## [날짜] ingest|query|lint | slug`
```

- **정보(knowledge)**: 프로젝트에 대해 *아는 것* — 도메인 사실, 결정, spec, 가이드.
- **문제(problems)**: 프로젝트에서 *겪은 것* — 발생한 버그·실패·미해결 이슈. `status: open|resolved`.
- 문제는 관련 정보로 `[[slug]]` 링크해 둘을 잇는다 (예: `failure-x` → `[[order-cancel]]`).
- `--type` 이 디렉터리를 결정한다 (failure/issue → problems/, 그 외 → knowledge/).

> **raw/ 없음**: 코딩 도메인의 불변 소스는 코드 + git 이다. 외부 문서 요약만 `type: source`.

## 페이지 컨벤션

모든 페이지는 frontmatter로 시작 (`intent wiki new` 가 자동 생성):

```yaml
---
title: 주문 취소 흐름
type: concept | decision | spec | guide | source | overview   # 정보
      | failure | issue                                        # 문제
status: open | resolved      # 문제 페이지만 (issue=open, failure=resolved 기본)
tags: [order, stock]
summary: 한 줄 요약 (index에 표시됨 — 비우면 첫 문단 사용)
created: 2026-06-17
updated: 2026-06-17
confidence: high | medium | low   # 불확실하면 low
---
# 주문 취소 흐름
... 본문 (H2/H3) ...
## See Also
- [[stock-model]]
```

- **Wikilink**: 다른 글 참조는 `[[slug]]`. 인덱스가 백링크를 자동 계산.
- **모순은 숨기지 않는다**: 충돌하면 `> [!contradiction]` 콜아웃 + 근거 링크.
- 파일명: 소문자·하이픈. 소스 요약은 `src-`, 실패는 `failure-`, spec은 `spec-` 접두어.

## 세 워크플로

### Ingest (새 정보가 들어올 때)
1. 핵심 **개념**을 뽑는다.
2. 기존 글 확인: `intent wiki list`
3. 새로 만들거나 이어붙인다:
   ```bash
   intent wiki new order-cancel "주문 취소 흐름" --type concept --summary "취소 시 재고 복원 경로"
   intent wiki append order-cancel "재고는 OrderService.cancel 에서 복원. [[stock-model]] 참조."
   ```
4. **하나의 정보가 여러 페이지를 건드린다** — 관련 개념/결정 페이지도 갱신한다.
5. `new`/`append` 는 인덱스와 로그를 자동 갱신한다.

### Query (질문에 답할 때)
1. `intent wiki show index` 로 **인덱스 먼저** 읽어 관련 페이지를 찾는다 (embedding 검색 불요).
2. 관련 페이지를 `intent wiki show <slug>` 로 drill-in 해 종합한다 (전체를 펼치지 않음 — progressive disclosure).
3. `[[slug]]` 로 근거를 인용하며 답한다.
4. **재사용 가치가 있는 답은 위키로 되돌려 파일링**한다 (`intent wiki new … --type synthesis/guide`) — 탐색이 복리로 쌓인다.

### Problem (문제 축적 — 정보와 별도 영역)
프로젝트에서 문제가 생기면 `problems/` 에 쌓는다:
```bash
intent wiki new bug-stock-restore "취소 시 재고 미복원" --type issue --summary "동시 취소 시 재고가 안 늘어남"
intent wiki append bug-stock-restore "관련: [[order-cancel]]. 재현: 동시 요청 2건."
intent wiki resolve bug-stock-restore       # 해결되면 status를 resolved로
```
- **미해결 이슈**는 `type issue`(status open). 인덱스 ## 문제 > 미해결 에 뜨고 `intent wiki lint` 가 open 목록을 보여준다.
- **해결된 실패**는 보통 `/postmortem` 이 `type failure`(원인·재발방지 + 가능하면 게이트 규칙)로 만든다.
- 문제는 **항상 관련 정보 페이지로 링크**해 지식과 잇는다.

### Lint (주기적 건강 점검)
```bash
intent wiki lint    # orphans(고아) · dead links(끊긴 [[링크]]) · low-confidence 리포트
```
- **고아**: 아무도 링크 안 하는 페이지 → 링크를 잇거나 병합.
- **끊긴 링크**: 없는 slug로의 `[[링크]]` → 페이지를 만들거나 링크 수정.
- 그 외: 모순 미해결, 낡은 주장, 중복(병합), 개념 누락 점검.

## 무엇을 넣고 / 안 넣나
- 넣는다: 도메인 사실, 아키텍처 경계, 합의된 spec, 비자명한 결정과 근거, behavior 변경 학습.
- **안 넣는다**: *차단해야 하는* 규칙은 위키가 아니라 **게이트 규칙**(`intent rule …`, 사람 승인). 위키 = 읽는 지식, 규칙 = 강제되는 것. 휘발성 잡담도 제외.

## 원칙
지식은 누적된다 · 모순은 명시한다 · 인용은 필수다 · 인덱스는 자동이니 손대지 않는다(`intent wiki index` 로 재빌드만).
