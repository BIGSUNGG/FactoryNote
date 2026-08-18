# FactoryNote — 에이전트 오리엔테이션

## 4대 작업 원칙 (에이전트 행동 원칙)

1. **추론 자제** — 요청을 처리하기 위해 추가로 정하거나 알아야 하는 부분을 스스로 추론해서 정하지 말고, 사용자에게 질문(`ask_user_question`)하여 진행한다. 질문 임계값: **주요 결정**(아키텍처 · 사용자 가시 동작 · 되돌리기 힘든 선택)만 질문하고, 사소한 구현 세부사항은 진행 후 보고한다.
2. **미래지향** — 추후 추가 작업을 고려해 확장성과 유지보수성을 고려하고, 객체지향 원칙을 따르며 코드를 모듈화한다. 단, 투기적 미래를 위한 사전 설계는 하지 않는다 — **필요 범위 내**에서 모듈화한다.
3. **문서주의** — 사용자가 요청한 모든 것은 기획 문서로, 에이전트가 구현한 것은 구현 문서로 작성한다. 요청 처리 전 관련 문서를 반드시 참고한다. 문서 규칙은 `.pi/skills/doc-workflow` 스킬을 따른다(결정→ADR, 변경→Changelog·Dev-Log, 새 문서→Home 링크).
4. **비판적 사고** — 사용자 요청과 구현 완료 내용을 비판적으로 검토하고, 좋지 않은 부분이 있으면 그대로 진행해도 괜찮은지 사용자에게 확인받는다.

> 리마인더 훅: `.pi/extensions/work-principles.ts`가 코드 변경인데 문서 미변경인 실행 종료 시 알림(원칙 3). 결정 근거는 [ADR-028](vault/02-decisions/ADR-028-work-principles-harness-application.md).

## 프로젝트 개요

FactoryNote는 pi 하네스 위의 **Human-Gated Plan 생성 워크플로 패키지**다. 3단계로 산출물을 순차 작성하고 각 단계를 사용자가 게이트에서 검토·수정·확정한다. **AI는 게이트를 통과시킬 수 없고 오직 사용자만.**

- 설계 진실: [`vault/Home.md`](vault/Home.md) · 구현: [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md)
- FactoryNote 파이프라인 5대 원칙(게이트 규칙): `vault/00-vision/project-identity.md`, [ADR-008](vault/02-decisions/ADR-008-3-stage-pipeline.md)

## 레포 레이아웃

```text
packages/factorynote/    # Layer 1-2 코어(harness-agnostic) — engine · persistence · 3단계 Registry
apps/pi-extension/       # Layer 3 Pi 어댑터(메인) — /factorynote · factorynote_plan · 웹 게이트
apps/plan-viewer/        # 뷰어(React) — 빌드 dist가 게이트로 서빙
bin/factorynote.mjs      # CLI(순수 Node, 상태 조회)
scripts/install.mjs      # 로컬 pi 설치(순수 Node)
vault/                   # 문서(Obsidian) — 기획·설계·ADR·아키텍처·가이드
.pi/skills/              # 프로젝트 스킬(doc-workflow + 원칙별 4스킬)
.pi/extensions/          # 프로젝트 확장(work-principles 리마인더 훅)
```

> 워크스페이스 패키지는 TS 소스를 직접 export. pi(jiti)·bun이 TS를 직접 로드 → JS 컴파일 산출물 없음. `tsc -b`는 타입검사 + 선언문만.

## 빌드 / 테스트

- `bun run build`(= `tsc -b` 타입체크 + viewer 빌드 + `install.mjs` 배포 → **빌드=배포**) · `bun test`(자체체크). 코드 바꾸면 이 둘이 0 종료여야 한다.
- 순수 타입체크만: `bun run typecheck`.

## 문서

- 결정→`vault/02-decisions/ADR-NNN-*.md`, 변경→`vault/04-development/Changelog.md`+`Dev-Log.md`, 신규 문서→`vault/Home.md` 링크. 전체 규칙은 `.pi/skills/doc-workflow` 스킬.
- plan 모드(본 도구): pi에서 `/factorynote`로 토글. ON이면 계획만 산출(코드 금지), `factorynote_plan` 도구로 3단계 구동, 웹 페이지가 게이트.

## 핵심 문서

- [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md) — 구현 코드 구조·데이터 흐름
- [`vault/90-meta/usage-guide.md`](vault/90-meta/usage-guide.md) · [`vault/90-meta/development-guide.md`](vault/90-meta/development-guide.md)
- [`vault/02-decisions/ADR-005-mvp-implementation.md`](vault/02-decisions/ADR-005-mvp-implementation.md) — MVP 결정
