---
updated: 2026-08-03
tags: [moc]
---

# FactoryNote 문서 홈

FactoryNote 개발 문서의 중앙 인덱스(MOC)다. 모든 영역과 주요 문서로 연결된다.

## 영역

| 영역 | 용도 | 상태 |
| ------ | ------ | ------ |
| `00-vision/` | 정체성 · 목표 · 5대 원칙 · 용어집 | [[project-identity]] |
| `01-architecture/` | 6단계 파이프라인 · 에이전트 역할 · 구현 아키텍처 | [[multi-agent-pipeline]] · [[implementation-architecture]] |
| `02-decisions/` | ADR (정해진 사항) | [[ADR-001-documentation-system]] · [[ADR-002-hybrid-harness-and-graph-git]] · [[ADR-003-viewer-architecture]] · [[ADR-004-monorepo-structure]] · [[ADR-005-mvp-implementation]] · [[ADR-006-graph-editor]] · [[ADR-007-pipeline-hardening]] |
| `03-design/` | 기능별 설계 산출물 | [[03-design/plan-page/core-features | plan-page]] · [[03-design/module-design/features | 모듈 설계]] · [[03-design/classes/features | 클래스]] · [[03-design/plan-viewer/ui-mapping | UI 매핑]] · [[03-design/workflow-core/06-viewer-ui | 뷰어 사양]] |
| `04-development/` | Changelog · Dev-Log (수정 사항) | [[Changelog]] · [[Dev-Log]] |
| `05-problems/` | 이슈 · 블로커 · 포스트모템 | [[parallel-worktree-seam-defects]] |
| `06-research/` | 조사 노트 | [[graphify]] · [[plannotator-plan-page]] |
| `90-meta/` | 컨벤션 · 템플릿 · 매뉴얼 · 가이드 | [[Doc-Conventions]] · [[How-To-Update-Docs]] · [[usage-guide]] · [[development-guide]] |

## 주요 문서

- [[implementation-architecture]] — **구현된 코드 구조·모듈 책임·런타임 데이터 흐름·데이터 계약** (구현 이해의 시작점)
- [[project-identity]] — FactoryNote 정체성, Plannotator와의 차이, 5대 원칙, 용어집
- [[multi-agent-pipeline]] — 멀티에이전트 구조, 6단계 파이프라인, 승인 게이트(기획)
- [[Doc-Conventions]] — 문서 작성 규칙 (이름, 링크, 태그, frontmatter)
- [[How-To-Update-Docs]] — 결정/구현/문제 발생 시 무엇을 기록할지
- [[ADR-004-monorepo-structure]] — 코드 레포 폴더 구조(plannotator 모노레포 패턴 채택)
- [[ADR-005-mvp-implementation]] — MVP 구현 결정(plan 모드 토글·웹-as-게이트·통합 런타임 디렉터리·Tier 0)
- [[ADR-006-graph-editor]] — Stage 3/4 다중 섹션 그래프 에디터(직접 편집→에이전트 채택)
- [[ADR-007-pipeline-hardening]] — 파이프라인 경화(다단계 회귀·FR-2 경성 에스컬레이션·게이트 타임아웃·resume·plan 모드 자동 해제)
- [[parallel-worktree-seam-defects]] — 병렬 워크트리 seam 결함 + gate-server `revertTo` drop 포스트모템
- [[usage-guide]] · [[development-guide]] — 설치/사용법 · 빌드/테스트/확장 가이드
- [[ADR-001-documentation-system]] — 이 볼트 구조와 도구를 왜 이렇게 정했는가
- [[Changelog]] · [[Dev-Log]] — 변경 이력과 일일 작업 기록
- [[graphify]] — 코드 지식 그래프 도구 조사 노트

## 원칙

> 문서는 코드와 같은 변경에서 함께 갱신한다. 오래된 문서는 버그다.
> 정해진 사항은 ADR로, 수정 사항은 Changelog로, 문제는 05-problems로 적극 기록한다.
