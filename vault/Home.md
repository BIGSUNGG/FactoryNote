---
updated: 2026-07-28
tags: [moc]
---

# FactoryNote 문서 홈

FactoryNote 개발 문서의 중앙 인덱스(MOC)다. 모든 영역과 주요 문서로 연결된다.

## 영역

| 영역 | 용도 | 상태 |
| ------ | ------ | ------ |
| `00-vision/` | 정체성 · 목표 · 5대 원칙 · 용어집 | [[project-identity]] |
| `01-architecture/` | 6단계 파이프라인 · 에이전트 역할 · 3계층 구조 · 패키지 맵 | [[multi-agent-pipeline]] |
| `02-decisions/` | ADR (정해진 사항) | [[ADR-001-documentation-system]] |
| `03-design/` | 기능별 설계 산출물 (워크플로 6단계 출력) | 비어있음 |
| `04-development/` | Changelog · Dev-Log (수정 사항) | [[Changelog]] · [[Dev-Log]] |
| `05-problems/` | 이슈 · 블로커 · 포스트모템 | 비어있음 |
| `06-research/` | 조사 노트 | [[graphify]] · [[plannotator-plan-page]] |
| `90-meta/` | 컨벤션 · 템플릿 · 매뉴얼 | [[Doc-Conventions]] · [[How-To-Update-Docs]] |

## 주요 문서

- [[project-identity]] — FactoryNote 정체성, Plannotator와의 차이, 5대 원칙, 용어집
- [[multi-agent-pipeline]] — 멀티에이전트 구조, 6단계 파이프라인, 승인 게이트
- [[Doc-Conventions]] — 문서 작성 규칙 (이름, 링크, 태그, frontmatter)
- [[How-To-Update-Docs]] — 결정/구현/문제 발생 시 무엇을 기록할지
- [[ADR-001-documentation-system]] — 이 볼트 구조와 도구를 왜 이렇게 정했는가
- [[Changelog]] · [[Dev-Log]] — 변경 이력과 일일 작업 기록
- [[graphify]] — 코드 지식 그래프 도구 조사 노트

## 원칙

> 문서는 코드와 같은 변경에서 함께 갱신한다. 오래된 문서는 버그다.
> 정해진 사항은 ADR로, 수정 사항은 Changelog로, 문제는 05-problems로 적극 기록한다.
