---
status: superseded
updated: 2026-08-11
tags: [adr, stage-2, design, markdown, data-model, viewer]
---

# ADR-010: Stage 2 설계 — 마크다운 단일진실 + 그래프 파생/역동기화

## 상태

superseded by [[ADR-016-graph-json-externalization]] — **마크다운 단일진실(산출물 = md) 원칙은 유지**하되, 인라인 ```` ```factorynote-graph ```` 펜스 임베드·역동기화(`applyStructureToMarkdown`·`artifactMd`)는 폐지. 그래프 구조는 md 옆 동반 `.json` 파일 + `<!-- graph: -->` 참조로 분리.

## 날짜

2026-08-06

## 맥락 (Context)

Stage 2(모듈·클래스 설계)는 그래프 JSON(`02-design.json`, `nodes-edges`) 전용이어서 Stage 1/3(마크다운)과 포맷이 불일치했고, 구조 외에 **아키텍처 설명(prose)** 을 담을 곳이 없었다. 에이전트와 사용자가 구조와 설명을 하나의 일관된 문서에서 함께 다루기 어려웠다.

## 결정 (Decision)

1. Stage 2 산출물을 **마크다운(`02-design.md`, `format:"markdown"`)** 단일 파일로 통일.
2. md 가 단일 진실. 두 절: `## 구조` 섹션의 ```` ```factorynote-graph ```` 펜스(JSON `{sections:[...]}`)에서 그래프를 파생하고, `## 아키텍처 설명` 에 구조의 객체지향 근거를 prose 로 담는다.
3. 뷰어(`DesignStage.jsx`, 기존 `GraphStage.jsx` 흡수·교체)가 펜스에서 그래프를 렌더(react-flow)하고 하단에 설명을 표시. 그래프 편집(노드/엣지 CRUD)은 제출 시 `applyStructureToMarkdown` 로 md 의 구조 블록에 **역동기화**.
4. 게이트 제출 시 `decision.artifactMd` 로 현재 md 를 전송 → `drivePlan` 이 산출물로 채택(직접편집→채택 원칙 유지, `graphSections`→`artifactMd` 로 일반화). `ArtifactFormat = "markdown"` 단일로 좁힘.
5. `parseDesignMarkdown`/`serializeDesignMarkdown`/`applyStructureToMarkdown` 왕복 일관성을 보증(parse(serialize(x))===x).

## 이유 (Rationale)

md 단일진실로 구조와 설명을 한 문서에서 일관되게 관리하고, Stage 1/3 과 포맷을 통일한다. [[ADR-009-realtime-chat-loop]]의 채팅 루프로 에이전트가 구조와 설명 모두를 그 자리에서 수정할 수 있다. 역동기화로 시각 편집 UX(react-flow)를 유지하면서 텍스트(md)를 진실로 둬 양쪽 장점을 취한다. [[ADR-006-graph-editor]]의 그래프 에디터 UX와 채택 원칙은 그대로 유지된다(저장 포맷만 변경).

## 대안 (Alternatives)

- **그래프 JSON 유지 + 하단 설명 패널만 추가** — "Stage 2 를 md 로 작성" 요구 미충족, 포맷 불일치 지속. 배제.
- **순수 md(그래프 뷰 제거)** — "기존처럼 구조를 보고 편집" 요구 상실. 배제.

## 결과 (Consequences)

- 긍정: 포맷 통일(1/2/3 모두 md), 구조+설명 동시 편집, 채팅 기반 구조/설명 수정, 진실=md 한 곳.
- 부정/트레이드오프: md↔그래프 역동기화 구현 부담(parse/serialize/apply), `GraphStage.jsx`(846줄)→`DesignStage.jsx` 교체 비용, `ArtifactFormat`/`GateDecision` 타입 변경 파급.

## 참고

- [[ADR-006-graph-editor]] — 데이터 모델 보강 대상(그래프 에디터 UX·채택 원칙)
- [[ADR-009-realtime-chat-loop]] — 채팅으로 구조/설명을 수정하는 근거
- [[implementation-architecture]]
