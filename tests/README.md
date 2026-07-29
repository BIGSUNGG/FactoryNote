# tests

통합/수동 테스트. 단위 테스트는 각 패키지 `*.test.ts` 옆에 (colocated, plannotator 패턴).

- `integration/` — 6단계 파이프라인 엔드투엔드 (state 전이, 게이트 판정, 회귀)
- `manual/` — harness별(Pi/Claude Code/Codex) 수동 스모크
- `fixtures/` — Stage 산출물 예시 (plan-page mockup 기반)

> 핵심 검증 대상: M3 Persistence atomic r/w(NFR-2), M4 Tier 0/1 동치, 게이트 불가침(AI가 통과시킬 수 없음).
