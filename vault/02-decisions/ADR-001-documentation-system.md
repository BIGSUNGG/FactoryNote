---
status: accepted
updated: 2026-07-26
tags: [adr, docs, tooling]
---

# ADR-001: Obsidian 볼트 + graphify로 문서를 관리한다

## 상태

accepted

## 날짜

2026-07-26

## 맥락

FactoryNote는 9단계 개발 파이프라인, 다수 에이전트 역할, 산출물 상태머신, ADR이 지속적으로 쌓이는 복잡한 프로젝트다. 기획·설계·결정·수정사항·문제를 항상 최신으로 유지하고 적극 기록할 체계가 필요하다. 문서는 코드와 같이 버전 관리되어야 하며, 인간과 PI가 모두 쉽게 갱신할 수 있어야 한다.

## 결정

1. 리포 내 `vault/` 폴더를 Obsidian 볼트로 운영한다(진실의 원천, 커밋 대상).
2. 볼트를 7개 영역으로 구성한다: `00-vision` `01-architecture` `02-decisions` `03-design` `04-development` `05-problems` `06-research` `90-meta`.
3. 코드·문서를 지식 그래프로 만드는 graphify를 도입한다. 출력은 `graphify-out/`(재생성 가능, gitignore).
4. 수기 볼트(`vault/`)와 graphify 출력을 분리한다. graphify는 볼트를 입력으로 그래프를 만든다.
5. PI harness로 문서 작성을 강제한다: 프로젝트 스킬 `.pi/skills/doc-workflow/` + 프로젝트 메모리로 매 세션 컨벤션을 주입.

## 이유

- **Obsidian**: 위키링크·그래프 뷰로 산출물 간 관계(요구사항→시나리오→모듈→코드)를 시각화하기 적합. 마크다운이라 git과 충돌 없음.
- **7영역 분리**: vision/architecture/decisions/design/development/problems/research 책임이 겹치지 않아 문서가 섞이지 않는다. 영역 번호 접두사로 탐색기 정렬 순서도 고정.
- **graphify 분리**: 재생성 산출물을 진실의 원천과 섞으면 수동 편집이 날아간다. 입력/출력 분리가 안전하다.
- **harness 강제**: 컨벤션을 사람 기억에만 의존하면 깨진다. PI가 매 세션 인식하도록 스킬+메모리로 굳힌다.

## 대안

- **단일 Plan 문서 / Plannotator**: 전 과정을 단계별 산출물로 관리하는 요구에 부족.
- **별도 위키(Co`nfluence/Notion)**: 코드와 분리되어 갱신이 늦고, 버전 관리가 끊김.
- **graphify 출력을 vault에 병합**: 재생성 산출물과 수기 문서가 섞여 편집 충돌/손실 위험.
- **최소 4영역 구조**: decisions·research가 design에 섞여 결정 이력 추적이 흐려짐.

## 결과

- 긍정: 산출물·결정·문제의 추적성 확보. PI가 컨벤션을 자동 적용. 그래프로 영향 범위 가시화.
- 부정: 문서 갱신 부담. harness가 강제하더라도 규율은 여전히 사람에게 달림.
- 후속: 각 영역에 실문서 채우기. graphify는 코드가 생긴 뒤 첫 빌드(`/graphify . --obsidian`). 필요시 포스트모템 템플릿·설계 산출물 템플릿 추가.

## 참고

- [[Home]] · [[Doc-Conventions]] · [[How-To-Update-Docs]]
- [[graphify]]
