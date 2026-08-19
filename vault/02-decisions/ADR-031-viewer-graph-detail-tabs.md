---
status: accepted
updated: 2026-08-18
tags: [adr, viewer, tabs]
---

# ADR-031: 문서 뷰어 탭 바 + 그래프 상세 탭

> **TL;DR**: 문서 뷰어 섹션 상단에 브라우저 스타일 탭 바를 둔다. md 문서 탭은 닫을 수 없는 고정 탭이고, 그래프 블록(tree·sequence·flowchart 3종) 헤더/캔버스 더블클릭으로 같은 뷰를 크게 보여주는 상세 탭이 열리며 X 버튼으로 닫는다. 같은 그래프 재더블클릭은 탭 복제 없이 포커스, 스테이지 전환에도 탭은 유지된다.

## 상태

accepted

## 날짜

2026-08-18

## 맥락 (Context)

그래프 블록은 문서 흐름 안에 블록으로 렌더되어(tree = ReactFlow 드릴다운, sequence·flowchart = 읽기 전용 SVG) 상세히 살펴보기엔 공간이 부족했다. 브라우저처럼 문서와 그래프 상세 뷰를 탭으로 오가며 보고 싶다는 요구가 있었다. 한편 GraphView 는 이미 노드 더블클릭 드릴다운(ADR-018)을 사용 중이라 더블클릭 의미가 충돌하지 않아야 한다.

## 결정 (Decision)

1. **탭 바 위치·소유**: `PlanPage` 문서 섹션 상단(`.doc-column` > `TabBar`). 탭 상태는 `PlanPage` useState — 스테이지 전환에도 PlanPage 가 마운트 유지되므로 탭도 유지(세션 내 상태, 새로고침 시 초기화).
2. **고정 문서 탭**: 첫 탭 = 기존 md 문서 뷰어(`DOC_TAB`, `pinned: true`). 닫기 버튼이 렌더되지 않아 사라지지 않는다.
3. **상세 탭 열기**: 그래프 블록의 헤더 또는 캔버스 빈 영역 더블클릭 → `graph:<파일명>` 탭 열기. 그래프 파일당 탭 1개 — 재더블클릭은 기존 탭 포커스. **노드 위 더블클릭은 제외**(`e.target.closest(".react-flow__node")` 가드) → ADR-018 드릴다운 동작 무변경.
4. **상세 탭 콘텐츠**: 기존 뷰 컴포넌트(`GraphView`·`SequenceView`·`FlowchartView`)를 탭 콘텐츠 영역 전체에 크게 재렌더. 새 시각화 없음 — tree 는 ReactFlow 줌/팬, SVG 뷰는 스크롤(팬)로 탐색.
5. **탭 전환 = hidden 토글**: 비활성 탭을 언마운트하지 않고 `hidden` 처리 → Document 스크롤 위치·코멘트 DOM 상태 보존.
6. **닫기**: 그래프 탭의 X 버튼으로 닫기. 닫은 탭이 활성이면 이웃 탭(우측 우선)으로 포커스 이동. 탭 로직은 순수 함수(`lib/viewerTabs.js`)로 분리해 자체체크.

## 이유 (Rationale)

- 문서 섹션만 탭 영역으로 한정(전역 탭 아님) — Toc·Stepper·GateBar 등 게이트 크롬은 그대로 유지.
- 같은 뷰 재사용(확대 렌더) — 상세 시각화를 새로 만들면 데이터 계약·배치가 분기되므로 배제.
- 탭 상태 PlanPage 소유 — 스테이지 전환 시 언마운트되지 않는 가장 가까운 조상. 전역(App)으로 올리면 스테이지별 graphData 접근이 복잡해짐.

## 대안 (Alternatives)

- **모달/라이트박스 상세 뷰**: 탭 간 비교·왕복이 어려워 배제.
- **탭 상태 전역(App) 관리**: 스테이지 전환 시 이전 스테이지 그래프 탭의 데이터 접근·표시 문제가 생겨 배제(현 방식은 미존재 시 '데이터 없음' 표시로 충분).
- **탭 드래그 순서 변경·새로고침 지속**: 범위 외(필요 시 후속).

## 결과 (Consequences)

- 신규: `components/TabBar.jsx` · `lib/viewerTabs.js` · 자체체크 6건(viewerTabs 4 + TabBar 렌더 2).
- 변경: `PlanPage.jsx`(탭 상태 + `.doc-column` 구조 + GraphDetail) · `Document.jsx`·`Block.jsx`(`onOpenGraph` 전달 + 더블클릭 핸들러) · `styles/layout.css`(탭 바·팬, `.doc-wrap` 그리드 슬롯 → `.doc-column` 이관).
- 코어 패키지·게이트 서버·API 무변경 — 뷰어 전용 변경(ADR-023 과 동일 경계).

## 참고 (References)

- [[ADR-018-hierarchical-graph-tree]] — 그래프 드릴다운(노드 더블클릭, 본 결정에서도 유지)
- [[ADR-021-sequence-flowchart-graphs]] — sequence·flowchart 읽기 전용 SVG 렌더러
- [[ADR-023-viewer-transition-ux]] — 뷰어 전용 변경 선례
