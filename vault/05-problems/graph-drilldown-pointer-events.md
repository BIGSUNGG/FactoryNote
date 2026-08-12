---
updated: 2026-08-12
tags: [problems, graph, viewer, reactflow, postmortem, resolved]
status: resolved
---

# 그래프 드릴다운 미출력 — ReactFlow v11 의 노드 `pointer-events: none` 주입

## 현상

웹 게이트 검토 페이지에서 그래프 블록([[ADR-018-hierarchical-graph-tree]])의 모듈 노드를 더블클릭해도 하위 레벨 패널이 나오지 않았다. 카드 제목의 "노드 더블클릭" 힌트는 표시(데이터·트리 조립 정상)되나 더블클릭 자체가 무반응.

## 원인

ReactFlow v11 `wrapNode` 는 노드 wrapper 의 인라인 스타일을 이렇게 결정한다:

```js
const hasPointerEvents = isSelectable || isDraggable || onClick || onMouseEnter || onMouseMove || onMouseLeave;
pointerEvents: hasPointerEvents ? "all" : "none"
```

GraphView 는 읽기 전용 뷰(`nodesDraggable={false}` · `elementsSelectable={false}`)에 `onNodeDoubleClick` 만 전달했고, **`onDoubleClick` 은 위 조건에 없다** → wrapper 에 인라인 `pointer-events: none` 주입 → 브라우저 히트테스팅이 노드를 건너뜀(`elementFromPoint` 가 `react-flow__pane` 반환 확인) → 더블클릭이 핸들러에 영원히 도달하지 못함.

함정: happy-dom 단위 테스트는 `dispatchEvent` 로 히트테스팅을 우회해 수정 전에도 통과(가양성)했다. 인라인 스타일 검증 assertion 을 추가해 진짜 회귀 가드로 만들었다.

## 조치

- `GraphView.jsx`: 의도적 no-op `onNodeClick` 1줄 추가 — 클릭 계열 핸들러 존재를 알려 `pointer-events: all` 유지(주석으로 이유 명시). CSS `!important` 해킹 대신 API 내 해결.
- 회귀 체크 2종:
  - `bun test` — `GraphView.test.jsx`(happy-dom): 드릴다운 토글·패널 렌더 + wrapper 인라인 `pointerEvents !== "none"` assertion.
  - `bun repro-drilldown.mjs` — 실제 Chrome headless(CDP)로 게이트 페이지 서빙(실제 chat-program 데이터) 후 마우스 더블클릭 → 패널 증가·"선택:" 제목 검증. Chrome 설치 필요(기계 의존).

## 영향

- 드릴다운(모듈 → 클래스 하위 패널, 재더블클릭 해제, 다중 선택 병합) 전 경로 복구. `bun test` 117 pass, 실브라우저 재현 PASS.
- 데이터·코어 무변경 — 뷰어 이벤트 경로 1줄 수정.

## 교훈

- 라이브러리의 **이벤트 핸들러 허용 목록에 내 핸들러가 없는 경우**가 있다 — 읽기 전용 구성일수록 히트테스팅(포인터 이벤트) 기본값을 의심하라.
- `dispatchEvent` 기반 DOM 테스트는 `pointer-events` 계열 버그를 못 잡는다. 실제 히트테스팅 경로를 검증하려면 실브라우저 재현(또는 인라인 스타일 assertion)이 필요하다.
- Windows + bun 환경에서 playwright `launch()` 는 타임아웃 — Chrome 직접 실행 + `connectOverCDP`(node 런타임) 경로 사용. bun 프로세스에서 `spawnSync` 는 서빙 이벤트 루프를 블록한다.
