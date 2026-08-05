---
updated: 2026-08-06
tags: [design, plan-viewer, ui, architecture]
---

# Plan 뷰어 UI 매핑 — Stage별 UI/UX

FactoryNote Plan 뷰어의 3단계 Stage 페이지가 **어떤 UI/UX 패턴**을 쓰는지 정의. 두 가지 핵심 UI 양식(문서형 / 그래프 에디터형)으로 Stage를 묶고, 한 양식을 여러 Stage가 공유한다.

> 기준: React 목업 `apps/plan-viewer/`. 본 구현에서도 이 매핑을 유지한다.

---

## Stage → UI 매핑

| Stage | 산출물 | UI 양식 | 컴포넌트 | 진입 |
| --- | --- | --- | --- | --- |
| 1 | 요청 이해 · 동작 시나리오 (마크다운) | **문서형 (plan)** | `PlanPage` | `#/` |
| 2 | 모듈 · 클래스 설계 | **그래프 에디터형** | `GraphStage` (모듈 섹션 + 클래스 섹션 공존) | `#/design` |
| 3 | 구현 계획 (마크다운) | **문서형 (plan)** | `PlanPage` | `#/impl` |

> 과거 6단계(요청 이해/시나리오/모듈/클래스/구현계획/최종검증)는 [[ADR-008-3-stage-pipeline]] 로 3단계로 통합되었다. 구 검토형(최종 검증) UI는 폐지.

---

## 양식 1 — 문서형 (plan UI)

- **마크다운 파일을 인자**로 받아 렌더 (`PlanPage({ mdSource, stage })`).
- 블록 단위 hover-to-comment, 드래그 영역 코멘트, 표 셀 코멘트, '수정 지시' 일괄 적용.
- 목차·타이틀·메타가 마크다운에서 자동 파생.
- 사양: [[03-design/plan-page/core-features|plan-page core-features]].
- **Stage 1·3** 이 공유 (산출물 내용만 MD로 교체). `PlanPage` 컴포넌트 추출로 중복 제거.

## 양식 2 — 그래프 에디터형 (module UI)

- react-flow 인터랙티브 에디터. 노드·엣지 CRUD + 우클릭 컨텍스트 메뉴 + 상세 패널 + 코멘트.
- **Stage 2** 하나가 모듈 관계도 섹션과 클래스 구조도 섹션을 모두 담는다(병합 — [[ADR-008-3-stage-pipeline]]). 종류는 섹션별 노드 타입으로 자동 판별한다. 사양: [[03-design/module-design/features|module-design features]] · [[03-design/classes/features|classes features]].

## 양식 3 — 검토형 (review UI) — 폐지

- 과거 최종 검증(구 Stage 6) 전용이었으나, [[ADR-008-3-stage-pipeline]] 로 단계 자체가 폐지되어 이 UI 양식도 사라졌다.

---

## 공통 프레임

모든 Stage 페이지가 공유:

- `Topbar`(Stage 표시) · `Stepper`(3단계, 클릭 시 해당 Stage로 전환) · `GateBar`(정정/수정 지시/확정 — **확정 시 다음 Stage로 이동**).
- hash 라우트로 전환(`App.jsx`가 라우터).

---

## 본 구현 메모

- Stage 3(구현 계획) 확정이 파이프라인 종료. 각 Stage의 산출물 **내용**(문구)은 Stage 고유이되, **UI/UX**는 위 매핑을 따른다(본 구현에서도 준수).
- 편집·코멘트는 본 구현에서 Design Agent 제안/명령으로 처리 (5대 원칙).

## 참고

- [[03-design/plan-page/core-features|plan-page core-features]] — 문서형 양식 사양
- [[03-design/module-design/features|module-design features]] — 그래프 에디터 양식
- [[03-design/classes/features|classes features]] — Stage 4 모듈 계층
- [[multi-agent-pipeline]] — 3단계 파이프라인
- [[Home]]
