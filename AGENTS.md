# FactoryNote — 에이전트 오리엔테이션

**Human-Gated Plan 생성 워크플로 패키지.** pi 하네스 위에서 3단계로 산출물을 순차 작성하고,
각 단계를 사용자가 게이트에서 검토·수정·확정한다. AI가 게이트를 통과시킬 수 없다.

> 설계 진실: [`vault/Home.md`](vault/Home.md). 구현: [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md).

## 5대 원칙 (타협 불가 — 게이트 규칙)

1. **승인되지 않은 요구사항으로 설계할 수 없다.** (Stage 1 확정 → 설계 진입)
2. **승인되지 않은 설계로 구현 계획을 만들 수 없다.** (Stage 2 확정 → 구현 계획)
3. **승인되지 않은 구현 계획으로 코드를 작성할 수 없다.** (Stage 3 확정 → 코드)
4. **승인된 계획과 다른 코드는 검수를 통과할 수 없다.**
5. **검증되지 않은 코드는 사용자 작업 공간에 반영될 수 없다.** (구현 계획(Stage 3) 확정 후, 승인된 계획에 따라 구현·검증되어야 반영)

> 원칙 1-2 = 계획 단계 간 게이트. 3-5 = 계획→구현→반영 게이트. Stage 6(사용자 최종 검증)은 [ADR-008](vault/02-decisions/ADR-008-3-stage-pipeline.md) 로 폐지되었다. AI(Feedback 포함)는 게이트를 넘길 수 없고 오직 사용자만.

## 레포 레이아웃

```
packages/factorynote/    # Layer 1-2 코어(harness-agnostic) — engine · persistence · 3단계 Registry
apps/pi-extension/       # Layer 3 Pi 어덂터(메인) — /factorynote · factorynote_plan · 웹 게이트
apps/plan-viewer/  # 뷰어(React) — 빌드 dist 가 게이트로 서빙
bin/factorynote.mjs      # CLI(순수 Node, 상태 조회)
scripts/install.mjs     # 로컬 pi 설치(순수 Node) — bash/WSL 의존 없음
vault/                   # 문서(Obsidian) — 기획·설계·ADR·아키텍처·가이드
.pi/skills/doc-workflow  # 문서 갱신 규칙(스킬)
```

> 워크스페이스 패키지는 TS 소스를 직접 export. pi(jiti)·bun 이 TS 를 직접 로드 → JS 컴파일 산출물 없음. `tsc -b` 는 타입검사 + 선언문만.

## 이 리포에서 작업할 때

- **빌드/배포/테스트**: `bun run build`(= `tsc -b` 타입체크 + viewer 빌드 + `install.mjs` 배포 → **빌드=배포**, 설치 확장이 항상 최신) · `bun test`(96 자체체크). 코드 바꾸면 이 둘이 0 종료여야. 순수 타입체크만 원하면 `bun run typecheck`.
- **문서는 코드와 함께**: 결정→`vault/02-decisions/ADR-NNN-*.md`, 변경→`vault/04-development/Changelog.md`+`Dev-Log.md`, 신규 문서→`vault/Home.md` 링크. 전체 규칙은 `.pi/skills/doc-workflow` 스킬.
- **plan 모드**(본 도구): pi 에서 `/factorynote` 로 토글. ON 이면 계획만产出(코드 금지), `factorynote_plan` 도구로 3단계 구동, 웹 페이지가 게이트.

## 핵심 문서

- [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md) — 구현 코드 구조·데이터 흐름
- [`vault/90-meta/usage-guide.md`](vault/90-meta/usage-guide.md) · [`vault/90-meta/development-guide.md`](vault/90-meta/development-guide.md)
- [`vault/02-decisions/ADR-005-mvp-implementation.md`](vault/02-decisions/ADR-005-mvp-implementation.md) — MVP 결정
