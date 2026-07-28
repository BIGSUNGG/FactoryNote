---
updated: 2026-07-28
tags: [design, plan-viewer, ui, architecture]
---

# Plan 뷰어 UI 매핑 — Stage별 UI/UX

FactoryNote Plan 뷰어의 6단계 Stage 페이지가 **어떤 UI/UX 패턴**을 쓰는지 정의. 두 가지 핵심 UI 양식(문서형 / 그래프 에디터형)으로 Stage를 묶고, 한 양식을 여러 Stage가 공유한다.

> 기준: React 목업 `prototypes/plan-page-mockup/`. 본 구현에서도 이 매핑을 유지한다.

---

## Stage → UI 매핑

| Stage | 산출물 | UI 양식 | 컴포넌트 | 진입 |
| --- | --- | --- | --- | --- |
| 1 | 요청 이해 (마크다운) | **문서형 (plan)** | `PlanPage` | `#/` |
| 2 | 시나리오 | **문서형 (plan)** | `PlanPage` + `scenarios.md` | `#/scenarios` |
| 3 | 모듈 아키텍처 | **그래프 에디터형 (module)** | `ModuleDesign` | `#/modules` |
| 4 | 클래스 설계 | **그래프 에디터형 (module)** | `Classes` (모듈 그룹 계층) | `#/classes` |
| 5 | 구현 계획 | **문서형 (plan)** | `PlanPage` + `impl.md` | `#/impl` |
| 6 | 최종 검증 | **검토형 (review)** | `FinalReview` | `#/review` |

---

## 양식 1 — 문서형 (plan UI)

- **마크다운 파일을 인자**로 받아 렌더 (`PlanPage({ mdSource, stage })`).
- 블록 단위 hover-to-comment, 드래그 영역 코멘트, 표 셀 코멘트, '수정 지시' 일괄 적용.
- 목차·타이틀·메타가 마크다운에서 자동 파생.
- 사양: [[03-design/plan-page/core-features|plan-page core-features]].
- **Stage 1·2·5** 가 공유 (산출물 내용만 MD로 교체). `PlanPage` 컴포넌트 추출로 중복 제거.

## 양식 2 — 그래프 에디터형 (module UI)

- react-flow 인터랙티브 에디터. 노드·엣지 CRUD + 우클릭 컨텍스트 메뉴 + 상세 패널 + 코멘트.
- 사양: [[03-design/module-design/features|module-design features]].
- **Stage 3**(모듈 노드) · **Stage 4**(모듈 그룹이 클래스를 감싸는 계층 — [[03-design/classes/features|classes features]]) 가 공유.

## 양식 3 — 검토형 (review UI)

- Stage 6 전용. 산출물 간 정합 매트릭스 + 검증 체크리스트 + 판정 배너.
- 코멘트 시스템 없음(읽기·체크 중심). 추후 plan UI로 통합 가능.

---

## 공통 프레임

모든 Stage 페이지가 공유:

- `Topbar`(Stage 표시) · `Stepper`(6단계, 클릭 시 해당 Stage로 전환) · `GateBar`(정정/수정 지시/확정 — **확정 시 다음 Stage로 이동**).
- hash 라우트로 전환(`App.jsx`가 라우터).

---

## 본 구현 메모

- Stage 6(검토형)은 현재 자체 UI. 사용자 요청 시 plan/module UI로 통합 가능.
- 각 Stage의 산출물 **내용**(문구)은 Stage 고유이되, **UI/UX**는 위 매핑을 따른다(본 구현에서도 준수).
- 편집·코멘트는 본 구현에서 Design Agent 제안/명령으로 처리 (5대 원칙).

## 참고

- [[03-design/plan-page/core-features|plan-page core-features]] — 문서형 양식 사양
- [[03-design/module-design/features|module-design features]] — 그래프 에디터 양식
- [[03-design/classes/features|classes features]] — Stage 4 모듈 계층
- [[multi-agent-pipeline]] — 6단계 파이프라인
- [[Home]]
