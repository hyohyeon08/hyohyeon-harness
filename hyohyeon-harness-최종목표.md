# hyohyeon-harness

## 1. 목적

`hyohyeon-harness`는 AI Agent에게 단순히 작업을 맡기는 도구가 아니라, 사용자의 의도, 프로젝트 맥락, 개발 과정, 실패 기록, 검증 증거, 관측 데이터, 의사결정까지 함께 관리하는 개인 Agent Harness다.

핵심 목적은 다음과 같다.

* 사용자와 AI 사이의 지식 격차를 줄인다.
* 목표를 바로 구현하지 않고, 심층 인터뷰를 통해 실제 의도와 제약을 명확히 한다.
* Agent 작업을 `Run` 단위로 관리하여 목표, 계획, 상태, 검증 증거, 관측 데이터, 다음 행동을 추적한다.
* 구현 과정에서 발생하는 `thrashing`과 `false_success`를 감시한다.
* 테스트와 런타임 신호를 통해 Agent의 완료 판단을 독립적으로 검증한다.
* 실패와 실수를 단순 로그가 아니라 재발 방지 규칙으로 변환한다.
* 대화, 프로젝트 정보, 실패 기록, 의사결정을 LLM-Wiki에 축적하여 다음 작업에 재사용한다.
* 시간이 지날수록 나만의 프로젝트 지식, 개발 습관, Agent 운영 규칙이 강화되는 구조를 만든다.

---

## 2. 핵심 문제의식

AI Agent가 실패하는 이유는 단순히 모델 성능이 낮아서가 아니다.

많은 경우 실패는 다음 지점에서 발생한다.

* 사용자의 머릿속에 있는 배경지식이 Agent에게 전달되지 않음
* 목표가 추상적이고 완료 조건이 불명확함
* Agent가 프로젝트 구조와 기존 의사결정을 모름
* 아키텍처 경계가 문서에만 있고 코드 수준에서 강제되지 않음
* 같은 파일, 같은 에러, 같은 명령어를 반복하며 헛돎
* 단위 테스트만 통과하고 실제 사용자 흐름에서는 실패함
* 테스트, 빌드, 타입체크, E2E 검증 없이 성공했다고 선언함
* 실패 기록이 다음 실행에 반영되지 않음
* 대화와 개발 과정이 일회성으로 사라짐

따라서 Harness의 역할은 Agent를 무작정 자동화하는 것이 아니라, Agent 작업을 관찰 가능하고 검증 가능하며 축적 가능한 구조로 만드는 것이다.

---

## 3. 전체 흐름

```text
User Goal
  ↓
Interview
  ↓
Plan
  ↓
Sprint Contract
  ↓
RunState 생성
  ↓
Execution Loop
  ↓
Test & Verification Layer
  ↓
Observability Layer
  ↓
Monitor
  ↓
Detection Record
  ↓
Persist to LLM-Wiki
  ↓
Rule Candidate 생성
  ↓
AGENTS.md / Hook / Reviewer / Eval 반영
```

---

## 4. 핵심 원칙

hyohyeon-harness의 핵심 원칙은 다음과 같다.

```text
테스트는 완료를 증명한다.
관측 가능성은 행동을 증명한다.
실패는 패턴으로 축적한다.
패턴은 규칙으로 축적한다.
규칙은 Harness를 강화한다.
```

Agent가 “완료했다”고 말하는 것은 완료의 근거가 될 수 없다.

완료는 반드시 실행 가능한 테스트, 빌드, 타입체크, 린트, E2E 검증, 런타임 신호를 통해 판단해야 한다.

또한 Agent가 “무언가를 했다”고 말하는 것만으로는 충분하지 않다. 어떤 파일을 수정했고, 어떤 명령을 실행했고, 어떤 오류가 발생했고, 어떤 검증이 실패했으며, 어떤 재시도를 했는지 추적 가능한 구조로 남겨야 한다.

---

## 5. Interview: 지식 격차 줄이기

구현에 들어가기 전, 사용자의 목표와 AI가 이해한 목표 사이의 격차를 줄이는 단계다.

사용자가 “이 기능 구현해줘”라고 말하더라도 바로 구현하지 않는다. 먼저 심층 인터뷰를 통해 다음 정보를 확인한다.

* 사용자가 진짜로 원하는 결과
* 이 기능을 만드는 이유
* 기존 프로젝트 맥락
* 반드시 지켜야 하는 제약
* 수정 가능한 범위
* 수정하면 안 되는 영역
* 성공과 실패를 나누는 기준
* 테스트 또는 검증 방법
* 사용자가 이미 고려한 선택지
* 사용자가 원하지 않는 구현 방식

Interview 결과는 `Interview Summary`로 저장하고, 이후 Plan과 RunState의 근거로 사용한다.

Interview Summary는 목표와 이유뿐 아니라 context, constraints, allowed/forbidden scope, success/failure criteria, verification, considered options, non-goals, assumptions, open questions를 schema-validated JSON으로 저장한다. 사람 승인 뒤 본문은 불변이며, 아직 존재하지 않았던 Intent/Spec/Plan/Run 참조만 기존 값을 교체하지 않는 append-only 방식으로 연결한다.

---

## 6. Plan: 구현 계획과 완료 조건 정의

Interview 결과를 바탕으로 구현 계획을 작성한다.

Plan에는 다음이 포함되어야 한다.

* 작업 목표
* 현재 문제 정의
* 구현 범위
* 수정 가능한 파일/폴더
* 수정 금지 영역
* 예상 변경 사항
* 필요한 조사 자료
* 참고해야 할 공식 문서 또는 프로젝트 자료
* 구현 단계
* 테스트 전략
* 검증 명령
* 완료 조건
* 남은 위험

특히 `Definition of Done`을 반드시 정의한다.

예시:

```markdown
## Definition of Done

- [ ] 요구사항을 만족하는 코드 변경이 있다.
- [ ] 관련 테스트가 추가 또는 수정되었다.
- [ ] 단위 테스트가 통과했다.
- [ ] 통합 테스트가 통과했다.
- [ ] 필요한 경우 E2E 테스트가 통과했다.
- [ ] 빌드/타입체크/린트 중 필요한 검증이 실행되었다.
- [ ] 검증 결과 로그가 저장되었다.
- [ ] 변경된 파일 목록이 기록되었다.
- [ ] 남은 위험이 명시되었다.
```

완료는 Agent의 말이 아니라 검증 증거로 판단한다.

### Plan 승인 생명주기

Plan은 `draft -> approved -> archived` 생명주기를 가진다. 사람 승인은 승인자와 승인 시각을 남기며, 승인된 Plan의 실행 전략·스코프·검증·DoD는 수정할 수 없다. 변경이 필요하면 새 draft Plan을 만들고 다시 승인받는다.

Interview/Plan/Contract revision은 `revision` 번호와 `supersedes*Id`를 기록한다. Approved artifact는 사람이 archive한 뒤에만 revision할 수 있다. Archive는 연결된 Run pointer를 비우고 `contract`/`plan`/`interview` phase로 되돌려 새 revision 승인 전 실행을 중단한다.

---

## 7. Sprint Contract

각 작업은 시작 전에 `Sprint Contract`를 가진다.

Sprint Contract는 Agent가 이번 Run에서 무엇을 해야 하고, 어떤 기준으로 평가받는지를 명확히 하는 계약이다.

작업 시작 전에 생성자와 평가자는 다음 항목을 확인한다.

* 이번 Run의 목표
* 해결해야 할 문제
* 수정 가능한 범위
* 수정 금지 영역
* 아키텍처 경계
* 테스트 요구사항
* 완료 조건
* 평가 기준
* 실패 시 멈춰야 하는 조건
* 사용자 판단이 필요한 조건

Sprint가 끝나면 평가자는 루브릭을 수집하여 정량화 가능한 채점으로 전환한다.

Sprint Contract도 사람 승인 전에는 draft다. Draft Contract는 실행 게이트나 completion policy를 바꾸지 않으며, 승인된 Contract만 allowed/forbidden scope와 required checks의 근거가 된다. 승인 후 계약 내용을 바꾸지 않고 새 Contract revision을 만든다.

예시:

```json
{
  "sprintContractId": "contract-001",
  "runId": "run-001",
  "objective": "로그인 실패 버그를 수정한다.",
  "allowedScope": [
    "src/auth/**",
    "test/auth/**"
  ],
  "forbiddenScope": [
    "src/payment/**",
    "infra/**"
  ],
  "architectureBoundaries": [
    "UI는 Repository를 직접 호출할 수 없다.",
    "Service는 Runtime에 의존할 수 없다."
  ],
  "requiredChecks": [
    "typecheck",
    "unit_test",
    "integration_test"
  ],
  "definitionOfDone": [
    "AuthService 테스트 통과",
    "기존 정상 로그인 테스트 유지",
    "검증 로그 저장"
  ],
  "rubric": {
    "requirementMatch": 40,
    "testEvidence": 30,
    "architectureCompliance": 20,
    "riskReport": 10
  }
}
```

---

## 8. RunState: Agent 작업 단위 관리

모든 Agent 작업은 `Run` 단위로 관리한다.

RunState는 현재 작업의 상태를 저장하는 핵심 데이터다.

```json
{
  "runId": "run-001",
  "objective": "로그인 버그를 수정하고 테스트를 통과시킨다.",
  "phase": "act",
  "status": "active",
  "planId": "plan-001",
  "interviewId": "interview-001",
  "sprintContractId": "contract-001",
  "budget": {
    "maxAttempts": 3,
    "maxWallClockMs": 1800000,
    "attemptsUsed": 0
  },
  "definitionOfDone": [
    "AuthService 관련 테스트 통과",
    "기존 정상 로그인 테스트 유지",
    "검증 로그 저장"
  ],
  "testMatrix": {
    "staticCheck": "required",
    "unitTest": "required",
    "integrationTest": "required",
    "e2eTest": "optional"
  },
  "completionGate": {
    "requiresVerificationEvidence": true,
    "allowSelfReportedSuccess": false
  },
  "verificationEvidence": [],
  "observability": {
    "traceId": "trace-run-001",
    "spanCount": 0,
    "logPaths": [],
    "errorSignatures": []
  },
  "detectionRecords": [],
  "lineage": {
    "parentRunId": null,
    "relatedConversationIds": []
  },
  "nextAction": "구현 진행"
}
```

RunState를 통해 대화가 끊기거나 모델이 바뀌어도 작업을 이어갈 수 있다.

### Governed Run과 완료 판정

`governed run`은 완료 대상 Intent에 연결되어 completion policy의 근거가 되는 가장 최근 RunState다. `active`는 현재 조작 초점을 뜻할 뿐 완료 증거의 유효성을 뜻하지 않는다. 따라서 `blocked`, `paused`, `passing` 상태의 Run도 completion 판정에서 사라지지 않는다.

Behavior 변경인 feature/fix Intent는 governed Run 없이 완료할 수 없다. Run이 `blocked`로 전이되어도 Intent 연결과 completion evidence 책임은 유지되며, complete/Stop 재시도는 같은 Run을 다시 평가한다.

---

## 9. Execution Loop

Execution Loop는 Plan을 기반으로 실제 구현을 수행하는 단계다.

원칙은 다음과 같다.

* 한 번에 너무 큰 범위를 수정하지 않는다.
* Plan에 없는 파일을 수정하려면 이유를 기록한다.
* 아키텍처 경계를 위반하는 수정은 허용하지 않는다.
* 수정 후에는 반드시 검증 단계로 넘어간다.
* 실패가 발생하면 같은 시도를 반복하기 전에 원인을 기록한다.
* 예산을 초과하면 자동으로 멈추고 사용자에게 상태를 보고한다.

Execution Loop의 목적은 Agent를 오래 돌리는 것이 아니라, 목표를 향해 검증 가능한 단위로 전진시키는 것이다.

Run phase는 순서가 있는 상태 전이다. 기본 구현 루프는 `interview -> plan -> contract -> act -> verify`이고, 검증 실패나 보완이 필요하면 `verify -> act`로 돌아간다. `done`은 임의 phase 변경으로 설정하지 않고 completion gate가 모든 완료 조건을 통과한 뒤에만 설정한다.

Artifact 승인과 실제 실행은 같은 사슬이어야 한다. 연결된 Interview가 있으면 승인된 Interview만 plan phase의 근거가 되고, `plan -> contract`는 같은 Run/Intent의 approved Plan, `contract -> act`는 같은 Run/Intent의 approved Contract를 요구한다. feature/fix의 비사소 write는 Run이 `act` 또는 `verify`이고 approved Contract가 연결된 동안에만 허용한다.

Run과 governance artifact는 schema-invalid 레코드를 조용히 건너뛰지 않는다. 새 sequential artifact는 기존 레코드를 덮어쓰지 않는 atomic exclusive create로 발행하고, 동시 생성 충돌 시 새 ID를 다시 할당한다.

`latest-runs.json`은 validated RunState에서 재구축 가능한 derived cache다. Cross-artifact recovery는 기존 lineage를 교체하지 않고 비어 있는 backlink만 채우며, 서로 다른 기존 값이 충돌하면 자동 적용하지 않고 사람에게 보고한다.

---

## 10. Test & Verification Layer

Test & Verification Layer는 Agent의 완료 판단을 독립적으로 검증하는 계층이다.

Agent가 코드를 작성하고 단위 테스트를 통과시켰더라도 실제 결과물이 원하는 방식으로 동작하지 않을 수 있다. 이는 단위 테스트의 철학과 관련이 있다.

단위 테스트는 테스트 대상을 격리하고 의존성을 모킹한다. 이 방식은 개별 함수나 모듈의 동작을 빠르게 검증하는 데 유용하지만, 컴포넌트 간 상호작용, 아키텍처 경계, 실제 런타임 흐름까지 보장하지는 못한다.

따라서 Harness는 단위 테스트만으로 완료를 판단하지 않는다.

완료 여부는 다음 검증 체계를 통해 판단한다.

```text
정적 분석
  ↓
단위 테스트
  ↓
통합 테스트
  ↓
E2E 테스트
  ↓
런타임 신호 확인
  ↓
완료 판정
```

---

## 11. 종료 조건 외부화와 실행 가능한 검증 체계

Agent의 작업 완료 여부를 Agent 내부 판단에만 맡기지 않는다.

완료 조건은 Harness 외부에 명시되어야 하며, 가능한 경우 테스트, 린트, 정적 분석, CI 규칙으로 실행 가능해야 한다.

아키텍처 제약도 문서에만 존재해서는 안 된다.

예를 들어 다음과 같은 규칙이 있다면,

```text
UI는 Repository를 직접 호출할 수 없다.
Renderer Process는 Node.js API에 직접 접근할 수 없다.
Service는 Runtime에 의존할 수 없다.
```

이 규칙은 문서에 적는 것만으로 끝나면 안 된다.

대응되는 테스트, 린트, 정적 분석 규칙으로 강제해야 한다.

예시:

```text
문법 오류 확인
  ↓
타입체크
  ↓
린트
  ↓
아키텍처 경계 검사
  ↓
단위 테스트
  ↓
통합 테스트
  ↓
E2E 테스트
```

즉, 단위 테스트 → 통합 테스트 → E2E 테스트가 모두 필요한 수준에서 통과되어야 안정적인 시스템이라고 판단할 수 있다.

---

## 12. Test Matrix

모든 작업에 같은 수준의 테스트를 요구하지 않는다.

작업의 성격에 따라 필요한 테스트 수준을 명확히 정의한다.

| 작업 유형        | 정적 분석    | 단위 테스트   | 통합 테스트   | E2E 테스트  |
| ------------ | -------- | -------- | -------- | -------- |
| 단순 문구 수정     | optional | optional | optional | optional |
| 유틸 함수 수정     | required | required | optional | optional |
| API 로직 수정    | required | required | required | optional |
| 인증/결제/권한 수정  | required | required | required | required |
| 사용자 주요 흐름 수정 | required | required | required | required |
| 아키텍처 경계 수정   | required | required | required | optional |

Test Matrix는 Plan과 RunState에 저장된다.

Agent는 이 기준을 보고 어떤 검증을 수행해야 하는지 알 수 있고, Verification Agent는 이 기준을 보고 완료 여부를 판단할 수 있다.

---

## 13. E2E 테스트와 Agent 행동 변화

E2E 테스트는 단순히 최종 결과물을 확인하는 장치가 아니다.

Agent가 자신이 만든 결과물이 실제 사용자 흐름에서 검증된다는 사실을 알면 행동이 달라진다.

Agent는 컴포넌트 간 상호작용을 더 신중하게 고려하고, 아키텍처 경계를 지키며, E2E 테스트에서 발생할 예외 상황까지 생각하게 된다.

따라서 중요한 기능에서는 E2E 테스트를 작성하는 것만큼, 그 전에 아키텍처 경계를 명확히 정의하는 것이 중요하다.

시스템의 책임과 의존성 흐름이 명확해야 E2E 테스트도 실제 사용자 흐름을 안정적으로 검증할 수 있다.

예를 들어 계층을 다음과 같이 나눌 수 있다.

```text
Types
  ↓
Config
  ↓
Repository
  ↓
Service
  ↓
Runtime
  ↓
UI
```

각 계층은 허용된 방향으로만 의존해야 하며, 금지된 의존성은 커스텀 린팅이나 정적 분석으로 차단해야 한다.

---

## 14. Agent 지향 오류 메시지

Agent가 실패를 스스로 수정하려면 오류 메시지는 단순히 실패 사실만 알려주는 수준에 머물러서는 안 된다.

좋은 오류 메시지는 마치 빨간 펜으로 첨삭하듯이 다음 정보를 함께 제공해야 한다.

* 무엇이 잘못되었는지
* 왜 문제가 되는지
* 어떻게 수정해야 하는지
* 어떤 파일이나 계층을 확인해야 하는지

예시:

```text
ERROR: Found direct import of 'fs' in src/renderer/App.tsx:12

WHY:
Renderer process has no access to Node.js APIs for security.

FIX:
Move file operations to src/preload/file-ops.ts
and call via window.api.readFile().
```

이처럼 구체적이고 실행 가능한 피드백을 제공하면, Agent는 인간의 추가 설명 없이도 실패 원인을 좁히고 다음 수정 행동을 결정할 수 있다.

따라서 테스트 실패 메시지, 린트 오류, 아키텍처 위반 메시지는 모두 Agent가 바로 수정에 착수할 수 있는 형태로 설계되어야 한다.

---

## 15. 리뷰 피드백의 자동 검사화

코드 리뷰에서 발견된 Agent의 새로운 실수는 일회성 피드백으로 끝나서는 안 된다.

반복 가능성이 있는 오류는 다음 중 하나로 전환해야 한다.

* 테스트
* 린트 규칙
* 정적 분석 규칙
* CI 규칙
* Reviewer Checklist
* Hook
* Eval Case
* AGENTS.md 규칙 후보

흐름은 다음과 같다.

```text
Review Feedback
  ↓
Repeated Failure Candidate
  ↓
Detection Record
  ↓
Rule Candidate
  ↓
Human Review
  ↓
Test / Lint / CI / Hook / Eval 반영
```

이렇게 하면 리뷰는 단순한 사람이 남긴 코멘트가 아니라, Harness를 강화하는 입력 데이터가 된다.

---

## 16. Verification Agent

개발이 완료되었다고 선언되면 Verification Agent가 검증을 수행한다.

검증 대상은 다음과 같다.

* 테스트 실행 여부
* 빌드 성공 여부
* 타입체크 성공 여부
* 린트 결과
* 아키텍처 경계 위반 여부
* 변경된 파일 목록
* 요구사항 충족 여부
* Definition of Done 충족 여부
* Test Matrix 충족 여부
* 남은 위험

검증 결과는 `Verification Evidence`로 저장한다.

예시:

```json
{
  "type": "unit_test",
  "command": "npm test",
  "status": "passed",
  "exitCode": 0,
  "logPath": "raw/test-results/run-001-npm-test.log",
  "createdAt": "2026-07-02T14:00:00+09:00"
}
```

### 최신 증거 규칙

Required evidence type은 연결된 Sprint Contract의 `requiredChecks`를 우선하고, 적용 가능한 Contract가 없을 때 RunState의 required evidence 설정을 사용한다. 각 type은 가장 최근에 기록된 evidence의 상태가 `passed`일 때만 충족된다.

각 verification evidence는 실행 직후 승인된 allowed/forbidden scope의 deterministic file manifest와 SHA-256 digest를 저장한다. Completion은 현재 manifest를 다시 계산해 digest가 다르거나 legacy required evidence에 provenance가 없으면 stale로 판정하고 재검증을 요구한다. `.intent`, `.git`, `node_modules`는 제품 content가 아닌 state/환경으로 제외한다.

최신 결과가 `failed`이면 이전 `passed` 결과가 있어도 완료할 수 없고, evidence가 없으면 `missing`이다. Run status 변경은 이 검증 책임을 제거하지 않는다.

최신 결과가 `passed`여도 그 뒤에 성공한 edit/apply_patch 관측이 있으면 해당 evidence는 `stale`이다. 수정 뒤 required check를 다시 실행해 새 evidence를 남겨야 완료할 수 있다.

완료 상태는 다음 중 하나로 분류한다.

* `complete`: 검증 증거가 충분함
* `failed`: 검증 실패
* `blocked`: 실행은 중단되지만 governed Run과 completion 책임은 유지됨. 원인 해결과 최신 required evidence가 필요함
* `unsafe`: 권한 또는 범위 문제 발생
* `budget_exhausted`: 시도 횟수나 시간 예산 초과
* `paused`: 사용자 판단 필요

---

## 17. Observability Layer

관측 가능성은 Agent의 행동을 증명한다.

정확함과 정확해 보임은 구별하기 어렵다. 그렇기 때문에 실제 작업 환경 속에서 Agent의 행동을 파악해야 한다.

Agent 자체 로그에만 의존해서는 안 된다. Harness가 자동으로 런타임 신호를 수집해야 한다.

수집 대상은 다음과 같다.

* 애플리케이션 생명 주기
* 기능 경로 실행
* 데이터 흐름
* 리소스 활용
* 오류 및 예외
* 실행 명령
* 테스트 결과
* 린트 결과
* 빌드 결과
* 수정된 파일
* 반복된 에러 시그니처
* 재시도 패턴

일반 shell command는 `intent command -- <command...>` wrapper에서 완전하게 기록하고, 지원되는 Agent shell 호출은 `PostToolUse(Bash)` hook으로 관측한다. 기록에는 command/args/cwd/exit code/stdout/stderr raw log/error signature가 포함되며 `run_command` span으로 Monitor에 전달된다. Hook이 지원하지 않는 streaming/unified shell 호출은 wrapper를 사용한다.

관측 가능성의 목적은 Agent를 감시하는 것이 아니라, Agent 작업을 재현 가능하고 분석 가능하며 개선 가능한 상태로 만드는 것이다.

---

## 18. Trace와 Span

하나의 Harness 실행 세션 전체를 `trace`로 본다.

그 안에서 수행된 개별 작업은 `span`으로 나눈다.

테스트나 린트 같은 검증 단계는 다시 하위 span으로 세분화한다.

예시:

```text
Trace: run-001 로그인 버그 수정
  ├─ Span: 프로젝트 구조 분석
  ├─ Span: AuthService 수정
  ├─ Span: 정적 분석 실행
  ├─ Span: 단위 테스트 실행
  │   ├─ Sub Span: AuthServiceTest 실행
  │   ├─ Sub Span: 실패 원인 확인
  │   └─ Sub Span: 재시도
  ├─ Span: 통합 테스트 실행
  ├─ Span: E2E 테스트 실행
  └─ Span: Verification Agent 판정
```

이렇게 기록하면 다음 질문에 답할 수 있다.

* Agent가 어떤 단계에서 실패했는가?
* 어떤 검증이 오래 걸렸는가?
* 어떤 파일이 반복 수정되었는가?
* 어떤 명령어가 반복 실패했는가?
* 같은 에러가 반복되었는가?
* 검증 없이 성공을 선언했는가?
* 실패 이후 수정 방향이 바뀌었는가?

또한 OpenTelemetry의 표준 형식을 사용하면 Jaeger나 Zipkin 같은 관측 도구와 연결해 작업 흐름을 시각적으로 분석할 수 있다.

---

## 19. Observability Evidence

관측 데이터는 `Observability Evidence`로 저장한다.

예시:

```json
{
  "traceId": "trace-run-001",
  "runId": "run-001",
  "spans": [
    {
      "spanId": "span-001",
      "name": "edit_file",
      "target": "src/auth/AuthService.ts",
      "status": "completed",
      "startedAt": "2026-07-02T14:00:00+09:00",
      "endedAt": "2026-07-02T14:01:20+09:00"
    },
    {
      "spanId": "span-002",
      "name": "run_test",
      "command": "npm test",
      "status": "failed",
      "errorSignature": "Invalid token",
      "logPath": "raw/test-results/run-001-npm-test.log"
    }
  ]
}
```

Verification Evidence가 “완료 여부”를 판단하는 증거라면, Observability Evidence는 “작업 과정”을 판단하는 증거다.

```text
Verification Evidence = 완료를 증명하는 데이터
Observability Evidence = 행동을 증명하는 데이터
```

---

## 20. Monitor: Agent 작업 감시

구현 과정에서는 최종 결과물만 보지 않고, Agent가 작업하는 과정에서 발생하는 신호를 수집하고 분석한다.

감시 대상은 크게 두 가지다.

* `thrashing`
* `false_success`

Monitor는 Verification Evidence와 Observability Evidence를 기반으로 Agent의 작업 상태를 판단한다.

---

## 21. Thrashing

`thrashing`은 Agent가 진전 없이 같은 시도를 반복하는 상태다.

대표 신호는 다음과 같다.

* 같은 파일을 반복 수정함
* 같은 에러를 계속 발생시킴
* 같은 명령어를 반복 실행하고 계속 실패함
* 같은 도구 호출 패턴을 반복함
* 같은 수정 패턴을 반복함
* 문제 해결 방향이 바뀌지 않음
* 같은 테스트 실패가 반복됨
* 같은 error signature가 바뀌지 않음

단, 같은 파일을 여러 번 수정했다는 이유만으로 실패로 판단하지 않는다.

같은 파일의 서로 다른 영역을 순차적으로 수정하는 것은 정상적인 개발 과정일 수 있다.

따라서 1차 구조 게이트에서는 수상한 후보만 찾고, 2차 의미 판정에서 실제로 같은 문제를 반복하고 있는지 확인한다.

---

## 22. False Success

`false_success`는 Agent가 실제 검증 증거 없이 성공했다고 선언하는 상태다.

대표 신호는 다음과 같다.

* 테스트 실행 없이 “완료했습니다”라고 말함
* 빌드 실패 로그가 있는데 해결됐다고 말함
* 타입체크를 실행하지 않고 “문제 없습니다”라고 말함
* 실패했던 명령을 재실행하지 않았는데 통과했다고 말함
* 단위 테스트만 통과했는데 전체 기능이 완료됐다고 말함
* E2E 테스트가 필요한 작업인데 E2E 없이 완료 선언함
* 자기 설명만으로 검증을 대체함

성공 선언은 반드시 실행된 검증 명령과 결과 로그를 기반으로 판단한다.

---

## 23. 탐지 방식

탐지는 1차 구조 게이트와 2차 의미 판정으로 나눈다.

### 23-1. 1차 구조 게이트

최근 작업 로그와 관측 데이터를 기준으로 반복 행동 후보를 빠르게 탐지한다.

수집하는 신호는 다음과 같다.

* 같은 파일 반복 수정 횟수
* 같은 에러 반복 횟수
* 같은 명령어 반복 실패 횟수
* 같은 도구 호출 패턴 반복 여부
* 같은 파일 내 동일 영역 재수정 여부
* 성공 선언 이후 검증 명령 존재 여부
* Test Matrix 충족 여부
* E2E 요구 작업에서 E2E 실행 여부
* 같은 error signature 반복 여부

1차 구조 게이트는 최종 판정이 아니라 후보 추출 단계다.

구현 정책상 `candidate` detection은 Run을 자동 hard block하지 않는다. 같은 파일의 20-line bucket 반복 수정과 `edit -> failed command` 같은 tool sequence 반복은 후보로 저장하며, 사람 또는 판정자가 `confirmed`로 확정한 뒤에만 blocked 전이를 만든다. Detection에서 만든 regression eval은 source JSON을 자기 비교하지 않고 관련 span snapshot을 detector 입력으로 재생한다.

### 23-2. 2차 의미 판정

1차에서 발견한 후보가 실제로 의미적으로 같은 문제를 반복하고 있는지 판단한다.

방식은 다음과 같다.

* 수정 내용, 에러 메시지, 실행 명령, Agent의 완료 선언을 텍스트로 변환한다.
* 임베딩을 통해 후보 행동 간 의미 유사도를 계산한다.
* 의미 유사도가 높고, 검증 증거가 부족하거나 동일 실패가 반복되면 LLM Judge에게 최종 판단을 맡긴다.

초기 버전에서는 비용을 줄이기 위해 2차 의미 판정과 LLM Judge는 애매한 후보에만 적용한다.

구현에서는 candidate `thrashing`만 외부 embedding adapter 대상으로 삼고, vector를 model/input digest와 함께 Detection에 캐시한다. Cosine similarity 임계치를 넘은 후보만 Judge queue에 들어가며 embedding candidate 수·입력 문자 수·vector 차원과 Judge candidate 수·개별/배치 입력 문자 수를 `config.json` 정책으로 제한한다. 동일 Judge input digest와 adapter key의 결과는 재사용한다. 이 외부 호출은 hook 안에서 실행하지 않는다.

---

## 24. LLM Judge

LLM Judge는 작업자가 아니라 판정자 역할을 한다.

입력은 다음과 같다.

* 구조 게이트 결과
* 반복된 파일/명령어/에러 정보
* 임베딩 유사도
* Agent의 완료 선언
* 실제 검증 명령 실행 여부
* Test Matrix 충족 여부
* 관련 trace/span 정보
* 관련 로그 위치

출력은 다음과 같다.

* `thrashing`, `false_success`, `none` 중 하나
* 판단 근거
* confidence
* 관련 로그 위치
* 다음 조치 제안

LLM Judge는 모든 로그에 실행하지 않는다.

비용 절감을 위해 1차 구조 게이트를 통과한 후보 중 애매한 경우에만 실행한다.

---

## 25. Detection Record

모든 탐지 결과는 Detection Record로 저장한다.

Detection Record에는 다음 정보가 포함된다.

* 어떤 작업에서 문제가 발생했는지
* 어떤 파일이 반복 수정되었는지
* 어떤 명령어가 반복 실행되었는지
* 어떤 에러가 반복되었는지
* 어떤 trace/span에서 문제가 발생했는지
* Agent가 어떤 근거로 성공을 선언했는지
* 실제 검증 증거가 있었는지
* Test Matrix가 충족되었는지
* 구조 게이트 결과
* 의미 판정 결과
* LLM Judge 판정
* 최종 판정
* 다음에 같은 실패를 막기 위해 필요한 Harness 규칙

예시:

```json
{
  "type": "thrashing",
  "runId": "run-001",
  "evidence": {
    "repeatedFile": "src/auth/AuthService.ts",
    "repeatedCommand": "npm test",
    "repeatedErrorSignature": "Invalid token",
    "relatedTraceId": "trace-run-001",
    "relatedSpanIds": ["span-002", "span-004", "span-006"]
  },
  "judgement": {
    "result": "thrashing_candidate",
    "reason": "같은 파일 수정과 같은 테스트 실패가 반복되었지만 에러 시그니처가 변하지 않았다."
  },
  "nextAction": "수정 방향을 바꾸기 전에 실패 원인을 재분석한다."
}
```

---

## 26. LLM-Wiki

LLM-Wiki는 hyohyeon-harness의 장기 기억 계층이다.

단순히 문서를 저장하고 나중에 검색하는 RAG 방식이 아니라, LLM이 지속적으로 읽고 정리하고 연결하고 갱신하는 markdown 기반 개인 지식 베이스를 목표로 한다.

핵심 목적은 정보 저장이 아니라, 프로젝트와 Agent 사용 과정에서 발생한 지식이 계속 누적되고 다음 작업에 재사용되도록 만드는 것이다.

---

## 27. LLM-Wiki 저장 대상

LLM-Wiki는 다음 정보를 축적한다.

### AI와 나눈 대화

* 문제 정의
* 질문과 답변
* 프롬프트 변경 이력
* 중요한 인사이트
* 다음에 다시 참고할 사고 과정

### 프로젝트 정보

* 프로젝트 목표
* 기능 요구사항
* 아키텍처
* 기술 스택
* 주요 도메인 개념
* API 설계
* DB 설계
* 배포/인프라 정보
* 성능 측정 결과

### 개발 과정

* 구현한 기능
* 변경한 파일
* 작성한 테스트
* 실행한 명령어
* 빌드/테스트 결과
* PR/커밋 요약
* 리팩토링 이유

### 검증 기록

* 실행한 테스트
* 테스트 결과
* 실패한 테스트
* 빌드 결과
* 타입체크 결과
* 린트 결과
* E2E 테스트 결과
* 검증 로그 위치

### 관측 기록

* trace
* span
* runtime signal
* error signature
* resource usage
* 반복된 실패 패턴
* 재시도 흐름
* 병목 구간

### 실패 기록

* 발생한 버그
* 반복된 에러
* 잘못된 설계 판단
* 잘못된 프롬프트
* Agent가 목표와 다르게 구현한 사례
* 검증 없이 성공했다고 선언한 사례
* 같은 파일/같은 에러/같은 행동을 반복한 사례

### 의사결정 기록

* 어떤 선택지를 비교했는지
* 왜 특정 기술을 선택했는지
* 왜 특정 기술을 제거했는지
* 당시 기준으로 어떤 근거가 있었는지
* 나중에 판단이 바뀌었는지

---

## 28. LLM-Wiki 구조

```text
hyohyeon-harness/
├── raw/
│   ├── conversations/
│   ├── agent-logs/
│   ├── traces/
│   ├── spans/
│   ├── test-results/
│   ├── build-results/
│   ├── lint-results/
│   ├── typecheck-results/
│   ├── git-diffs/
│   ├── errors/
│   └── sources/
├── wiki/
│   ├── index.md
│   ├── log.md
│   ├── overview.md
│   ├── conversations/
│   ├── projects/
│   ├── runs/
│   ├── failures/
│   ├── decisions/
│   ├── rules/
│   ├── concepts/
│   ├── verification/
│   ├── observability/
│   └── evals/
├── schema/
│   ├── WIKI_SCHEMA.md
│   ├── AGENTS.md
│   ├── DETECTION_SCHEMA.md
│   ├── REVIEWER_SCHEMA.md
│   ├── VERIFICATION_SCHEMA.md
│   └── OBSERVABILITY_SCHEMA.md
└── runs/
    ├── latest-runs.json
    └── run-*.json
```

### raw

원본 자료를 저장하는 계층이다.

AI와의 대화 원문, Agent 실행 로그, 테스트 결과, 에러 로그, trace, span, git diff, 프로젝트 문서 등을 저장한다.

이 계층은 source of truth이므로 수정하지 않는다.

### wiki

LLM이 생성하고 유지보수하는 markdown 지식 베이스다.

원본 자료를 읽고 요약, 분류, 연결, 갱신한 결과를 저장한다.

### schema

LLM이 Wiki를 어떻게 관리해야 하는지 정의하는 운영 규칙이다.

어떤 페이지를 만들지, 어떤 형식으로 기록할지, 어떤 경우 기존 페이지를 갱신할지, 어떤 경우 log를 남길지 정의한다.

---

## 29. LLM-Wiki 주요 작업 흐름

### Ingest

새로운 대화, 로그, 문서, 실패 사례, 테스트 결과, trace가 생기면 raw에 저장한다.

LLM은 raw source를 읽고 핵심 정보를 추출한다.

관련된 기존 wiki 페이지를 찾아 업데이트한다.

필요한 경우 새로운 개념 페이지나 실패 패턴 페이지를 만든다.

`index.md`와 `log.md`를 갱신한다.

### Query

질문이 들어오면 raw source를 처음부터 다시 뒤지는 것이 아니라, 먼저 wiki의 index와 관련 페이지를 읽는다.

필요한 경우 raw source를 근거로 확인한다.

좋은 답변, 비교 분석, 설계 결정, 회고는 다시 wiki 페이지로 저장한다.

### Lint

주기적으로 wiki를 점검한다.

다음 항목을 확인한다.

* 중복된 페이지
* 오래된 주장
* 서로 충돌하는 내용
* 고립된 페이지
* source가 없는 주장
* 규칙에 반영되지 않은 실패 기록
* eval case로 등록되지 않은 반복 실패
* AGENTS.md에 반영되지 않은 rule candidate
* 검증 증거 없이 complete로 기록된 Run
* trace/span이 누락된 Run
* 테스트 실패가 규칙 후보로 전환되지 않은 사례

---

## 30. 실패 기록의 규칙화

실패 기록은 단순 로그가 아니라 재발 방지 규칙으로 변환한다.

흐름은 다음과 같다.

```text
Failure
  ↓
Detection Record
  ↓
Failure Pattern Page
  ↓
Rule Candidate
  ↓
Human Review
  ↓
AGENTS.md / Hook / Reviewer / Eval 반영
```

예시:

```markdown
# Failure Pattern: false_success_without_verification

## 유형
false_success

## 발생 상황
Agent가 코드 수정을 완료했다고 선언했지만, 테스트/빌드/타입체크 실행 로그가 없었다.

## 관찰된 증거
- 완료 선언: "수정 완료했습니다."
- 실행된 검증 명령: 없음
- 최근 실패 로그 이후 재검증 기록 없음

## 원인
완료 조건이 명확하지 않았고, Agent가 자기 설명을 검증 증거로 대체했다.

## 재발 방지 규칙
- 완료 선언 전 반드시 검증 명령 실행 결과를 포함해야 한다.
- 검증 명령을 실행하지 못한 경우 “완료”가 아니라 “구현 완료 / 검증 미완료”로 보고해야 한다.

## Harness 반영 위치
- AGENTS.md
- Reviewer checklist
- Detection rule
- Eval case
```

---

## 31. 비용 통제 원칙

hyohyeon-harness는 비용을 통제하기 위해 다음 원칙을 따른다.

* 기본 저장소는 로컬 markdown과 JSON을 사용한다.
* 초반에는 vector DB를 사용하지 않고 `index.md`, `log.md`, 파일 검색을 우선 사용한다.
* 모든 로그를 LLM에게 보내지 않는다.
* raw source는 hash로 중복 ingest를 방지한다.
* 대화 원문은 raw에 저장하고, wiki에는 요약된 지식만 저장한다.
* LLM Judge는 모든 로그가 아니라 1차 구조 게이트를 통과한 후보 중 애매한 경우에만 실행한다.
* 임베딩 결과는 캐시한다.
* trace/span은 원본을 보존하되, wiki에는 요약된 관측 결과만 저장한다.
* Wiki lint는 매번 실행하지 않고 수동 또는 주기적으로 실행한다.
* AGENTS.md 자동 수정은 하지 않고, 처음에는 rule candidate만 생성한다.

---

## 32. 안정성 원칙

* raw source는 수정하지 않는다.
* wiki는 LLM이 관리하지만 중요한 판단은 사람이 검토한다.
* 모든 중요한 주장에는 근거 source를 연결한다.
* 기존 페이지를 삭제하지 않는다.
* 충돌하는 정보는 contradiction 섹션에 기록한다.
* 오래된 정보는 outdated로 표시한다.
* 완료는 Agent의 말이 아니라 verification evidence로 판단한다.
* 중요한 규칙 변경은 바로 적용하지 않고 candidate로 저장한다.
* 자동 차단보다 read-only 감시를 먼저 적용한다.
* trace/span은 Agent의 자기 보고가 아니라 Harness가 수집한 신호를 우선한다.
* feature/fix 완료는 status와 무관한 governed Run의 required verification evidence로 판단한다.
* governed Run이 없거나 required type별 최신 evidence가 missing/failed인 complete 상태는 허용하지 않는다.

---

## 33. 개발 단계

### 1단계: 기록 중심 MVP

* 프로젝트 생성
* raw 대화 저장
* Interview Summary 저장
* RunState 생성
* wiki summary 생성
* index.md/log.md 갱신

### 2단계: 검증 증거 기반 완료 판정

* verification evidence 저장
* test/build/typecheck/lint 로그 저장
* 완료 선언 시 evidence 확인
* evidence 없으면 false_success 후보 기록
* Test Matrix 도입

### 3단계: 관측 가능성 MVP

* Run 단위 trace 생성
* 작업 단위 span 생성
* 명령 실행, 파일 수정, 테스트 실행을 span으로 저장
* error signature 저장
* trace/span 기반 작업 흐름 조회

### 4단계: thrashing 구조 게이트

* 같은 파일 수정 횟수 감지
* 같은 명령어 실패 횟수 감지
* 같은 error signature 반복 감지
* 같은 테스트 실패 반복 감지
* Detection Record 저장

### 5단계: LLM-Wiki Ingest 자동화

* Detection Record를 failure page로 변환
* 관련 concept/rule/project page 갱신
* verification page 갱신
* observability page 갱신
* rule candidate 생성

### 6단계: 의미 판정과 LLM Judge

* embedding similarity 적용
* 애매한 후보에만 LLM Judge 실행
* confidence와 판단 근거 저장

### 7단계: Reviewer / Hook / Eval 연동

* Reviewer Agent가 Detection Record 기반으로 검토
* 반복 실패를 Hook으로 방지
* 실패 패턴을 Eval Case로 등록
* AGENTS.md 규칙 후보를 검토 후 반영
* 리뷰 피드백을 테스트/린트/CI 규칙으로 전환

---

## 34. 최종 원칙

hyohyeon-harness는 AI Agent에게 일을 맡기는 도구가 아니다.

hyohyeon-harness는 Agent 작업을 목표, 계획, 상태, 검증 증거, 관측 데이터, 실패 기록, 장기 기억이 있는 관리 가능한 실행 단위로 바꾸는 시스템이다.

핵심은 자동화가 아니라 축적이다.

대화는 지식으로 축적한다.

테스트는 완료의 증거로 축적한다.

관측 데이터는 행동의 증거로 축적한다.

실패는 패턴으로 축적한다.

패턴은 규칙으로 축적한다.

규칙은 Harness를 강화한다.

결과적으로 Agent가 실패할수록 시스템이 강해지는 구조를 만든다.
