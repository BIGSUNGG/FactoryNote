# Contributing

FactoryNote는 "문서는 코드와 함께 항상 최신" 원칙으로 동작한다. 기여도 동일하다.

## 개발

```bash
bun install
bun run typecheck
```

- 코어 변경 → `packages/factorynote/` (harness 의존 금지, Layer 1-2 순수 유지)
- harness 연결 → `apps/<harness>/` (Layer 3)
- 단위 테스트는 소스 옆 `*.test.ts`(colocated). 통합 테스트는 `tests/`.

## 문서 규칙 (필수)

결정·구현·문제 발생 시 `vault/` 에 기록한다. `doc-workflow` 스킬을 따른다.

- **결정** → `vault/02-decisions/ADR-NNN-*.md`
- **코드/기능 변경** → `vault/04-development/` (Changelog + Dev-Log)
- **문제/블로커** → `vault/05-problems/`
- 컨벤션: [`vault/90-meta/Doc-Conventions.md`](vault/90-meta/Doc-Conventions.md)

## 5대 원칙 (타협 불가)

1. 승인되지 않은 요구사항으로 설계할 수 없다.
2. 승인되지 않은 설계로 구현 계획을 만들 수 없다.
3. 승인되지 않은 구현 계획으로 코드를 작성할 수 없다.
4. 승인된 계획과 다른 코드는 검수를 통과할 수 없다.
5. 검증되지 않은 코드는 사용자 작업 공간에 반영될 수 없다.
