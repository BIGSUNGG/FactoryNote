---
status: accepted
updated: 2026-07-28
tags: [adr, viewer, ui, architecture]
---

# ADR-003: 뷰어/UI 아키텍처 — 코어는 산출물, 뷰어가 렌더

## 상태

accepted

## 날짜

2026-07-28

## 맥락

workflow-core([[03-design/workflow-core/01-requirements|요구사항]])는 6단계 워크플로 엔진(상태·오케스트레이터·게이트·에이전트)에 집중했다. 사용자가 산출물을 검토하는 **뷰어/UI 레이어**는 미정이었다.

React 목업(`prototypes/plan-page-mockup/`)으로 뷰어 UI 사양을 검증했다 — 세 UI 양식(문서형·그래프 에디터형·검토형, [[03-design/plan-viewer/ui-mapping|ui-mapping]]) + 블록/영역/셀 코멘트 시스템 + '수정 지시' 일괄 적용([[03-design/plan-page/core-features|plan-page]] · [[03-design/module-design/features|module]] · [[03-design/classes/features|classes]]).

결정이 필요했다: 뷰어가 코어(엔진)와 어떤 관계인지, Pi에서 어떻게 동작하는지, UI 양식·코멘트가 게이트에 어떻게 연결되는지.

## 결정

1. **뷰어는 코어 위의 별도 레이어** — 코어(harness-agnostic, Layer 1-2)는 **산출물 파일**만 생산·영속. 뷰어가 그 파일을 읽어 렌더. 코어는 UI를 모른다.
2. **Pi에서는 Tier 0 뷰어**(의존 0): 산출물 **마크다운**을 Pi에 표시 + **Pi 승인 프롬프트**(에이전트가 산출물 제시 → 사용자 확정/수정/정정)로 게이트. React 웹 뷰어는 **옵션**(Pi 밖, 사양은 목업 기준).
3. **UI 양식 매핑**(Stage별): 1·2·5 = 문서형(마크다운), 3·4 = 그래프형(nodes/edges JSON), 6 = 검토형(정합 매트릭스).
4. **코멘트 → '수정 지시' → Design Agent** — 뷰어의 코멘트(블록/영역/셀/노드/엣지)는 pending 큐 → '수정 지시' → workflow-core FR-3(수정 판정)로 Design Agent에 전달. 직접 편집 ❌(5대 원칙).

## 이유

- 코어 harness-중립(Layer 1-2 복사 시 이식)을 유지하려면 UI가 코어에 있으면 안 된다 — 뷰어 분리.
- Pi Tier 0는 의존 0(`.mjs` 순수 Node) 원칙과 일치 — 마크다운 + 프롬프트로 게이트 충분.
- MD 기반(1/2/5)은 이식성 최대; 그래프(3/4)는 nodes/edges 표준으로 어떤 뷰어든 렌더.
- 코멘트 → 일괄 적용은 "직접 편집 금지" 5대 원칙의 UI 강제([[project-identity]]).

## 대안

- **코어에 뷰어 내장**: 거절 — harness/UI 종속이 생겨 이식성 붕괴.
- **웹 뷰어만**: 거절 — Pi 패키지 본질(터미널 워크플로)이 아님; Pi 사용자 접근성 ↓.
- **단일 UI 양식**: 거절 — Stage 3/4(구조)는 그래프, 1/2/5(문서)는 각각에 부적합.

## 결과

- **긍정**: 코어 harness 중립 유지 + 뷰어 UI 사양 명확 + 코멘트/게이트 연결 정의.
- **부정**: Pi(Tier 0)와 웹(옵션) 뷰어 중복 구현 가능(표준 포맷으로 완화).
- **후속**: workflow-core M1 Stage Registry에 **Stage별 산출물 포맷**(MD/nodes-edges/매트릭스) 명세 추가 → [[03-design/workflow-core/06-viewer-ui|06-viewer-ui]].

## 참고

- [[03-design/plan-viewer/ui-mapping|ui-mapping]] — Stage UI 매핑
- [[03-design/plan-page/core-features|plan-page]] · [[03-design/module-design/features|module]] · [[03-design/classes/features|classes]] — 뷰어 UI 사양
- [[03-design/workflow-core/01-requirements|workflow-core 요구사항]] — FR-3(수정 게이트)
- [[ADR-002-hybrid-harness-and-graph-git]] — harness 주입 방식
- [[Home]]
