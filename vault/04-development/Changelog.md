---
updated: 2026-07-28
tags: [development, changelog]
---

# Changelog

FactoryNote의 주요 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 양식.
코드/기능 변경을 같은 세션에서 이 파일에 반영한다.

## [Unreleased]

### Added

- [[project-identity]] — FactoryNote 정체성, Plannotator 차이점, 범용성(harness-agnostic), 5대 원칙, 용어집.
- [[multi-agent-pipeline]] — Director/Design/Feedback 에이전트 구조, Design↔Feedback 루프, 6단계 파이프라인, 승인 게이트.
- Workflow Core 설계 산출물 5종(`03-design/workflow-core/01..05`) — Hybrid 실행 모델(프로토콜 본체 + 얕은 코드), Tier 0/1 에이전트 모델, 6단계 dogfood로 자체 검증.
- 문서 시스템 구축: `vault/` Obsidian 볼트(7영역) + Doc-Conventions/How-To-Update-Docs + ADR 템플릿.
- 루트 `AGENTS.md`(상시 프로젝트 오리엔테이션) 추가 — [[ADR-002-hybrid-harness-and-graph-git]].
- graphify 스킬 설치(`~/.pi/agent/skills/graphify/`). 코드 생긴 뒤 첫 빌드 예정.
- [[plannotator-plan-page]] — Plannotator plan 페이지(요소·레이아웃·정보·디자인 패턴) 분석 조사 노트. Orca computer-use 접근성 트리 기반 추출.
- [[core-features]] — Plan 뷰어 핵심 기능(블록 hover-to-comment + MD 파일 렌더링) 사양. React 목업(`prototypes/plan-page-mockup/`)으로 검증, 향후 본 구현 필수 요구사항 체크리스트 포함.
- [[03-design/module-design/features|module-design features]] — Stage 3 모듈 설계 페이지 사양. mermaid 정적 → **react-flow 인터랙티브 에디터** 전환: 노드·엣지 CRUD(생성/제거/이동/편집/방향반전) + **우클릭 컨텍스트 메뉴**(빈 공간=추가·노드=제거·엣지=반전/제거) + 노드·엣지 상세·코멘트·수정 지시 일괄 적용.
- [[03-design/classes/features|classes features]] — Stage 4 클래스 설계 페이지 사양. **모듈 그룹이 클래스를 감싸는 계층 구조**(parent-child) + 모듈 우클릭으로 해당 모듈에 클래스 추가 + 상세 모듈 select로 클래스 이동 + `NodeResizer` 모듈 박스 크기 조절.
- [[03-design/plan-viewer/ui-mapping|ui-mapping]] — Plan 뷰어 Stage별 UI 매핑(1·2·5=문서형·3·4=그래프 에디터형·6=검토형). 두 UI 양식 공유 + `PlanPage` 추출.
- [[ADR-003-viewer-architecture]] — 뷰어/UI 아키텍처 결정: 코어는 산출물 파일만 생산, 뷰어가 렌더(별도 레이어). Pi=마크다운+승인 프롬프트(Tier 0), 웹 React=옵션. 코멘트→'수정 지시'→Design Agent.
- [[03-design/workflow-core/06-viewer-ui|06-viewer-ui]] — Stage별 산출물 포맷(MD/nodes-edges/매트릭스) + 뷰어 인터페이스 계약 + 코멘트→수정 게이트 연결. M1 Stage Registry 강화 근거.

### Changed

- [[03-design/workflow-core/05-implementation-plan|05-implementation-plan]] 재작성 — 구현 가능한 서브태스크(파일·함수 단위) + 검증 게이트 + 뷰어 포맷(`format` 필드, graph 템플릿) 반영. Phase 0–3 마일스톤 명확화.
- `valut/` 오타 폴더 제거 → `vault/`로 재생성.
- PI harness를 `.pi/skills` 단일 → 루트 `AGENTS.md` + `.pi/skills/doc-workflow` **하이브리드**로 변경([[ADR-002-hybrid-harness-and-graph-git]]).
- `graphify-out/` Git 정책: 전체 gitignore → **그래프는 커밋**(`cache/`·`cost.json`만 제외).
- "9단계 파이프라인" → **"6단계 파이프라인"** 으로 전면 정정(`AGENTS.md`, `Home.md`, ADR-001, How-To-Update-Docs, doc-workflow 스킬).
- Stage 6 재설정: "검증 계획 산출" → **사용자 최종 검증 게이트(산출물 없음)**. 파이프라인은 6단계, 산출물은 5개.
- Workflow Core 산출물 경로: `vault/03-design/` → **`<outputDir>`(기본 `designs/`, 설정 가능)**. vault는 FactoryNote 자체 문서용.

### Fixed

- _(없음)_

### Removed

- 빈 `valut/` 폴더.

## [0.0.0] - 2026-07-26

- 리포 초기화(`.gitattributes`, `LICENSE`).
