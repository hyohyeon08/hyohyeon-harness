# Phase 24: State Integrity and Concurrent Create

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Governance state 손상과 sequential record 생성 경쟁이 policy를 우회하거나 기존 record를 덮어쓰지 못하게 한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-24-01` | Strict governance artifact loaders | `passing` | `npm run typecheck`; `npm test` |
| `FG-24-02` | Collision-safe sequential record creation | `passing` | full suite; concurrent creator test |

## Actual Work Performed

- Rule/Run/Plan/Interview/Contract/Detection/Eval collection loader를 schema fail-closed로 통일했다.
- corrupt Rule/Run을 pre-write와 Stop hook에서 명시적으로 차단한다.
- approved invalid regex Rule을 fail-closed 처리하고 새 승인은 거부한다.
- sequential ID를 record count가 아니라 가장 큰 numeric suffix 다음으로 할당한다.
- artifact filename matcher가 1000 이상 ID를 인식한다.
- 새 JSON record를 fully-written temp의 atomic hard-link로 exclusive publish한다.
- 동시 충돌 시 create 함수가 새 ID를 읽어 다시 시도한다.
- 8개 별도 Node process의 동시 Intent 생성 회귀 테스트를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm run build && node --test tests/id.test.mjs` | 0 | 4 targeted tests passed | `2026-07-10` |
| `npm test` | 0 | terminal output, 309 tests passed | `2026-07-10` |

## Decisions

- schema-invalid governance record는 목록에서 사라지는 것보다 명시적 repair 요구가 안전하다.
- record creation은 overwrite 가능한 rename이 아니라 exclusive publish를 사용한다.
- ID의 사람이 읽기 쉬운 sequential 형식은 유지하되 충돌 시 재할당한다.
- 단일 record publish와 multi-record transaction recovery는 별개 문제로 유지한다.

## Known Risks

- Run+index와 cross-artifact lineage 갱신은 crash recovery journal이 없다.
- hard-link publish는 동일 디렉터리 filesystem을 전제로 한다.
- observability trace/span append는 별도의 concurrent append 감사가 필요하다.
- timestamp evidence freshness는 content digest를 증명하지 않는다.

## Next Phase Entry Point

- verification evidence에 deterministic scoped content fingerprint를 저장하고 completion에서 재검증한다.
