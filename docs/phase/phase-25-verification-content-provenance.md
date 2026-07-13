# Phase 25: Verification Content Provenance

## Status

- status: `passing`
- completed_at: `2026-07-10`
- source_plan: `docs/final-goal-phase-feature-spec.md`

## Scope

Required verification evidence를 실제 승인 scope의 content manifest와 SHA-256 digest에 결박한다.

## Completed Feature Items

| Feature ID | Title | Status | Verification |
| --- | --- | --- | --- |
| `FG-25-01` | Scoped content fingerprint capture | `passing` | `npm run typecheck`; `npm test` |
| `FG-25-02` | Completion digest revalidation | `passing` | full suite; provenance tests |

## Actual Work Performed

- `ContentFingerprint`와 file entry schema를 추가했다.
- path-sorted manifest에 file size와 SHA-256을 저장하고 manifest 전체 digest를 만든다.
- approved matching Contract의 allowed/forbidden scope를 우선하고 없으면 Intent scope를 사용한다.
- `.intent`, `.git`, `node_modules` directory를 fingerprint에서 제외한다.
- verification command 종료 직후 evidence에 provenance를 저장한다.
- completion/Stop이 current digest를 다시 계산해 mismatch를 stale evidence로 처리한다.
- provenance가 없는 legacy required pass도 재검증을 요구한다.
- hook span 없이 직접 파일을 바꾸는 end-to-end 회귀 테스트를 추가했다.

## Verification Evidence

| Command | Exit Code | Evidence Location | Verified At |
| --- | ---: | --- | --- |
| `npm run typecheck` | 0 | terminal output | `2026-07-10` |
| `npm run build && node --test tests/provenance.test.mjs` | 0 | 3 targeted tests passed | `2026-07-10` |
| `npm test` | 0 | terminal output, 314 tests passed | `2026-07-10` |

## Decisions

- Digest에는 scope policy 자체도 포함해 policy 변경 시 evidence를 재사용하지 않는다.
- Verification command가 source를 생성/수정할 수 있으므로 fingerprint는 command 종료 뒤 캡처한다.
- Harness state와 dependency environment는 product content가 아니므로 기본 제외한다.
- Legacy evidence를 암묵적으로 신뢰하지 않고 한 번 재검증하게 한다.

## Known Risks

- very large `**` scope는 completion마다 file hashing 비용이 커질 수 있다.
- symlink 외부 대상의 내용 변경은 현재 manifest가 직접 증명하지 않는다.
- 파일이 fingerprint 도중 바뀌는 concurrent write에는 filesystem snapshot이 없다.
- Contract report/reviewer의 stale 표시를 더 풍부하게 만들 수 있다.

## Next Phase Entry Point

- Run index와 cross-artifact lineage를 idempotent하게 rebuild/reconcile하고 crash recovery 경계를 명시한다.
