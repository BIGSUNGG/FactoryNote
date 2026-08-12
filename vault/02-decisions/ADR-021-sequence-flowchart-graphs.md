---
status: accepted
updated: 2026-08-12
tags: [adr, graph, sequence, flowchart, viewer, data-model]
---

# ADR-021: 그래프 종류 확장 — Sequence 다이어그램 · Flowchart

## 상태

accepted ([[ADR-018-hierarchical-graph-tree]]·[[ADR-020-multi-named-graphs]] 확장 — 참조 코멘트 프로토콜·자유 네이밍·승격·서빙 경로는 승계하고, 계층 트리 단일 종류에 sequence·flowchart 2종을 추가)

## 날짜

2026-08-12

## 맥락 (Context)

ADR-018·020 이후 그래프는 계층 트리(모듈→클래스→메서드 드릴다운) 한 종류만 지원한다. 설계 산출물이 표현하려는 관계가 전부 계층 구조인 것은 아니다:

1. **시간축 상호작용** — 로그인·배포 승인 같은 시나리오는 참여자 간 메시지 순서(시퀀스 다이어그램)가 자연 표현이다.
2. **분기 흐름** — 빌드/검증 파이프라인, 예외 처리 경로는 노드·판단·흐름선(플로우차트)이 맞다.

사용자 요구: "그래프 종류를 추가하자 — Sequence 와 flow chart 그래프 추가해줘." 문답으로 확정한 선택: 전용 JSON envelope + 커스텀 렌더러(mermaid 아님), 종류 선언은 파일 envelope 의 type 필드, 모든 단계 허용, 렌더러는 둘 다 신규 SVG, 시퀀스 모델에 alt/loop/opt fragment 포함.

## 결정 (Decision)

1. **종류 판별 = 파일 envelope 의 `type` 필드** — `type: "sequence"` · `type: "flowchart"`. **type 필드 없음 = 계층 트리**(ADR-018 산출물 무변경 하위 호환). 참조 코멘트(`<!-- graph: <파일명> -->`)·추출·승격·무효화 경로는 종류 무관 — 그대로 둔다.
2. **Sequence envelope(단일 파일)** — `{version:2, type:"sequence", id?, title?, participants:[{id, name?, ...}], body:[...]}`. body 는 순서 목록: 메시지 `{from, to, label, kind?: "call"|"reply"}` 또는 fragment `{kind: "alt"|"loop"|"opt", label?, body:[중첩]}`(임의 깊이, 상한 16). 검증: 참여자 id 유일, 메시지·fragment 가 존재 참여자만 참조, fragment 판별은 `body` 배열 존재 여부(메시지 `kind:"reply"` 와 충돌 방지).
3. **Flowchart envelope(단일 파일)** — `{version:2, type:"flowchart", id?, title?, nodes:[{id, label, shape?: "terminal"|"process"|"decision"}], edges:[{from, to, label?}]}`. 검증: 노드 id 유일·label 필수, 엣지가 존재 노드만 참조, shape 열거형.
4. **sequence·flowchart 는 단일 파일 그래프** — 자식 디렉터리 트리 없음. 승격(`promoteGraphTree`)은 루트 파일 1개 복사로 자연스럽게 동작(`collectGraphChildFiles` 가 비트리 파일에서 빈 목록 반환).
5. **렌더러 = 신규 읽기 전용 SVG 2종** — ReactFlow 미사용(시간축·플로우 표현에 부적합/과도). `SequenceView`: 참여자 컬럼 + 라이프라인 + 시간축 메시지 화살표(reply 점선) + fragment 구간 박스(중첩, 스팬은 내부 메시지가 쓰는 컬럼만). `FlowchartView`: 랭크 = 소스로부터 최장 경로(Kahn, 사이클 노드는 입력 순서 폴백), 행 내 barycenter 정렬, terminal·process·decision shape 구분, 백엣지 점선. 배치 로직은 순수 함수(`lib/layoutSequence.js`·`lib/layoutFlowchart.js`)로 컴포넌트와 분리 — 결정적, **데이터에 좌표 필드 금지**(ADR-016 원칙 승계), 노드 겹침 0.
6. **검증·필수 규칙은 종류 무관** — `checkRequiredGraph` 는 `parseAnyGraphKind`(트리·sequence·flowchart 아무거나 유효 1개 이상)로 판정. Stage 2 필수([[ADR-019-stage-2-graph-required]])·단계 분기 의미 불변.
7. **서빙·뷰어 분기** — `ViewerState.artifacts[].graphs[] = {file, type, data}`(tree = 조립 트리, 그 외 = 파싱 파일 그대로). 뷰어 `Block` 이 type 별로 GraphView·SequenceView·FlowchartView 분기. 코멘트는 현행 블록 단위 유지(캔버스 조작 없음).

## 이유 (Rationale)

- type 필드 판별은 참조 문법·코어 추출·승격·서빙·무효화를 전부 무변경으로 둔다 — 새 종류 추가 비용이 envelope + 렌더러에만 머문다.
- mermaid 텍스트는 에이전트 작성 비용은 낮지만, 검증(envelope 강제)·표현 통제(좌표 금지·결정적 배치)·향후 노드 코멘트 확장성이 전부 사라진다. 전용 envelope 는 기존 계층 트리와 동일한 검증·거부 기제를 재사용한다.
- fragment 판별을 `kind` 필드가 아닌 `body` 배열 존재 여부로 한 이유는 메시지 `kind:"reply"` 와의 충돌 때문이다(실제 테스트에서 적발).
- 단일 파일(sequence·flowchart) + 파일 트리(tree) 비대칭은 의도적: 드릴다운이 필요한 것만 트리다. 승격 코드는 손대지 않았다.

## 대안 (Alternatives)

- **Mermaid 텍스트 저장·렌더링** — 배제. 위 Rationale. 단 미래에 "에이전트가 그린 mermaid 를 가져오는" 수요가 생기면 별도 종류로 추가 가능(문법이 닫혀 있어 확장 비용이 낮다).
- **참조 코멘트에 종류 명시(`<!-- graph: f.json sequence -->`)** — 배제. md 만 보고 종류가 보이지만 코어 정규식·승격·뷰어 전부 수정이고, 파일이 이미 자기 종류를 아는데 참조가 반복 선언하는 것은 드리프트 위험이다.
- **flowchart 도 ReactFlow 재사용** — 배제. 자동 배치(layer·barycenter)는 이미 순수 함수로 새로 쓸 수밖에 없고, ReactFlow 의 드래그/줌 인프라는 읽기 전용 플로우에 불필요한 무게다.

## 결과 (Consequences)

- 산출물 md 에 계층 트리·시퀀스·플로우차트가 혼합 렌더링된다(종류별 헤더 라벨 구분).
- 코어는 envelope 3종 검증(`coerceGraphSequenceFile`·`coerceGraphFlowchartFile`·기존 트리)을 보증하고 표시 필드는 불투명 — 기존 분업 유지.
- 새 종류를 더 추가하려면: type 분기 1곳 + envelope coerce + 렌더러 1개. 참조·승격·서빙·필수 규칙은 무변경.
- 노드/메시지 단위 코멘트는 미지원(블록 코멘트만) — 필요 시 별도 ADR.
