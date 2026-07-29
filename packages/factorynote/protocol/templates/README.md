# 산출물 템플릿 (Protocol)

각 Stage 산출물의 마크다운/JSON 템플릿. Design Agent가 템플릿대로 작성한다.
Doc-Conventions([[vault/90-meta/Doc-Conventions]]) 준수: kebab-case 파일명, frontmatter(`updated`, `tags`, `stage`, `status`).

- `stage-1-requirements.md` — 요구사항 명세(기능/비기능, 범위, 제약, 가정)
- `stage-2-scenarios.md` — 정상 동작 시나리오(happy path)
- `stage-3-modules.{md,json}` — 모듈 구조도(nodes/edges)
- `stage-4-classes.{md,json}` — 클래스 명세(nodes/edges)
- `stage-5-implementation-plan.md` — 구현 순서·의존성·마일스톤
- `stage-6-verification-matrix.md` — 요구사항↔시나리오↔설계↔계획 정합 매트릭스
