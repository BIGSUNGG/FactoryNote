---
updated: 2026-08-12
tags: [problems, graph, gate, postmortem, resolved]
status: resolved
---

# 그래프 미출력 — 낡은 design-prompt.md 로 인한 ADR-018 프로토콜 이탈

## 현상

`C:\Projects\Test\.factorynote\chat-program` Stage 2 산출물에 계층 그래프 데이터(`graph/*.json`)가 존재하는데 웹 게이트 뷰어에 그래프가 아예 렌더되지 않았다.

## 원인 (2겹)

1. **게이트 전이 시 작성 지시 파일 미갱신(근본 원인)**: 게이트 confirm 으로 Stage 1 → Stage 2 전이 후 Design 자식은 `design-prompt.md` 파일을 읽어 산출물을 작성한다. 그런데 이 파일은 design 보고가 `drivePlan` 에 돌아온 시점에만 갱신되어, 전이 직후 스폰되는 자식은 **이전 단계(Stage 1)의 지시**를 읽었다. Stage 1 지시에는 [[ADR-018-hierarchical-graph-tree]] 그래프 프로토콜이 없으므로 자식은 자유 형식(`root`/`edges`/`classes` 키)으로 `graph/` 폴더에 파일을 썼다.
2. **참조 코멘트 규약 위반**: md 참조가 `<!-- graph: graph/chat-program.graph.json -->` 처럼 경로를 포함 — 코어 `GRAPH_REF_RE` 는 traversal 차단상 **파일명만** 허용해 매치 자체가 실패, 뷰어가 그래프를 읽지 않았다. `checkRequiredGraph` 는 design 보고 시점에 검증하지만 (1)의 반려 라운드 재작성 자식도 지시 파일 갱신 전에 조기 리턴되어 같은 낡은 지시를 다시 읽는 구조였다.

## 조치

- `plan-gate.ts`: 게이트 결정(confirm/modify/revert) 후 전이 시 다음 단계의 `design-prompt.md` + `feedback-menu.md` 를 즉시 기록.
- `plan-tool.ts`: `design-prompt.md`/`feedback-menu.md` 기록을 그래프 검증·반려 앞으로 이동 — 반려 라운드 재작성 자식도 현 단계 지시를 읽는다.
- `artifact.ts`: `checkRequiredGraph` 가 참조 시도 흔적(`<!-- graph:`)은 있으나 규약 불일치(경로 포함 등)인 경우를 구분하는 메시지 반환.
- 데이터 복구: chat-program 의 자유 형식 그래프를 ADR-018 규격(`draft-graph.json` + `draft-graph/`, `version:2` envelope, `refs {to,comment}`)으로 변환, draft.md 참조 규격화, 구 `graph/` 삭제.
- 회귀 테스트 2건(전이 시 지시 파일 갱신 · 경로 포함 참조 반려).

## 영향

- 다음 게이트 오픈 시 `promoteGraphTree` 가 규격 트리를 `stage2/` 로 승격해 뷰어에 그래프가 렌더된다(draft.md 기준 `loadGraphTree` 검증 완료 — 39 노드).
- 미승인 draft 를 수동 승격하지 않음(5대 원칙 2 유지) — 렌더는 정상 파이프라인 재개 시점에 반영.

## 교훈

자식이 읽는 파일 프로토콜(지시·메뉴)은 **전이가 일어나는 지점에서 즉시** 갱신해야 한다. "다음 보고 시 갱신"은 스폰 순서가 앞서면 낡은 지시를 주입한다.
