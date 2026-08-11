---
status: accepted
updated: 2026-08-11
tags: [adr, graph, viewer, stage-2, data-model, layout]
---

# ADR-016: 그래프 JSON 외부 파일화 + 전 단계 동일 문서 렌더 + 관계 기반 자동 배치

## 상태

accepted ([[ADR-006-graph-editor]]·[[ADR-010-md-design-stage]] 를 대체 — 그래프 직접편집·인라인 펜스·수동 배치 폐지)

## 날짜

2026-08-11

## 맥락 (Context)

세 가지 사용자 불만이 결합되어 있었다.

1. **스테이지별 렌더 불일치** — Stage 1·3 은 문서 뷰(`PlanPage`: TOC + 본문 + 블록/영역 코멘트), Stage 2 만 전용 에디터(`DesignStage`: 섹션 탭 + react-flow 캔버스 + 드래그 + 우클릭 CRUD + 상세 편집 패널)로 완전히 다른 UX 였다. 같은 '산출물 검토'인데 단계마다 조작 방식이 달라 학습·유지비가 컸다.
2. **그래프 데이터가 md 안에 인라인 임베드** — Stage 2 산출물(`02-design.md`)은 ```` ```factorynote-graph ```` 펜스에 노드 전체 JSON 을 통째로 담아, 문서가 거대해지고 md diff/편집이 어려웠으며 에이전트가 포맷을 어기면(mermaid·```json 편차) 뷰어가 구조를 못 찾는 취약점이 있었다.
3. **수동 노드 배치** — 노드 드래그·`NodeResizer` 로 위치를 직접 맞추게 되어 있어, 같은 구조라도 렌더마다 배치가 달랐고 노드 겹침·모듈 경계 밖 클래스가 빈번했다.

## 결정 (Decision)

1. **그래프 데이터 외부 파일화** — 그래프 노드·관계(토폴로지)는 산출물 md 와 같은 `stageN/` 폴더의 `<산출물 base>-graph.json`(예: `02-design-graph.json`)에 저장한다. md 는 `<!-- graph: <json 파일명> -->` HTML 코멘트 참조 한 줄만 가진다(인라인 JSON 금지). draft 단계에서도 동일 규약(`draft.md` + `draft-graph.json`)이며, 게이트 오픈 시 `drivePlan` 이 참조를 최종 파일명으로 재작성하고 json 을 산출물 폴더로 승격한다. 회귀(`invalidateArtifactsAfter`)는 md 와 동반 json 을 함께 삭제한다.
2. **position 금지·자동 배치 단일 출처** — 그래프 JSON 에 `position`·`width`·`height` 등 좌표·크기 필드를 쓰지 않는다. 좌표는 뷰어 `layoutGraph` 가 렌더 시 계산하는 유일한 출처다. 배치는 결정적(deterministic): 모듈 관계도는 layer(API→Service→Repository→Util→External)·관계 방향(위상 깊이) 행 + 행 내 barycenter 정돈, 클래스 구조도는 클래스를 소속 모듈 그룹 안 그리드에 두고 그룹 간 관계를 축약한 위상 순서로 그룹을 배치한다. 축적 좌표 + 간격 보장으로 노드·그룹 겹침 0, 클래스는 항상 모듈 경계 내부.
3. **전 단계 동일 문서 렌더** — Stage 1·2·3 모두 `PlanPage`(마크다운 → 블록 → 문서 + 블록/영역 코멘트)로 출력한다. 그래프는 md 참조 위치에서 읽기 전용 자동 배치 블록(`GraphView`)으로 렌더된다. `DesignStage.jsx`·`GraphEditor.jsx`·펜스 파서(`designMd.js`, core `parse/serialize/applyStructureToMarkdown`)·`artifactMd` 역동기화 경로를 제거한다. 그래프를 포함한 모든 산출물 수정은 우측 에이전트 채팅으로 요청한다(게이트 유지, Design 자식 재작성).
4. **호환 정책 없음** — 기존 인라인 펜스 파서는 폴백 없이 완전 제거한다. 구 펜스 포맷 산출물은 뷰어에서 그래프 블록 없이 prose 만 표시된다.

## 이유 (Rationale)

- 문서 렌더 통일은 '검토'라는 행위를 단계 무관하게 만들고, 스테이지 분기·전용 컴포넌트·역동기화 코드를 삭제해 유지면을 줄인다(5대 원칙상 채택 경로는 채팅 하나로 수렴).
- 데이터(md)와 구조(json) 분리는 각 파일의 역할을 명확히 하고, 에이전트가 구조를 망쳐도 문서 자체는 무사하며, json 유효성만 검증하면 된다.
- 자동 배치 단일 출처는 '같은 구조 = 같은 그림'을 보장하고 수동 배치 잔재(좌표 동기화)를 원천 제거한다. layer·방향 기반 정돈은 아키텍처 다이어그램의 관습(위→아래 의존)과 일치한다.

## 대안 (Alternatives)

- **펜스 유지 + 파서 강화**: md 단일진실은 지키지만 문서 비대·편차 취약이 남고, json 분리 요구를 충족 못 함. 배제.
- **그래프 직접편집 유지(위치 드래그만 제거)**: 스테이지 간 차이가 남고 write-back 경로(json 저장)가 추가로 필요. '동일 방식 출력' 요구와 충돌. 배제.
- **force(힘) 기반 레이아웃**: 관계가 복잡할 때 유연하나 렌더 비결정성·계층 의미 약화. layer·방향 정돈을 채택하고 force 는 배제.
- **position 을 json 에 유지(자동 배치 결과 저장)**: 재렌더 동일성은 얻지만 자동 배치 단일 출처 원칙이 약해지고 에이전트·뷰어 좌표 동기화 이슈가 남음. 배제.

## 결과 (Consequences)

- `DesignStage.jsx`(27KB)·`GraphEditor.jsx`(19KB)·`designMd.js`·`graphNormalize.js` 삭제, 뷰어에 `GraphView.jsx`·`layoutGraph.js` 추가. `mdToBlocks` 는 `<!-- graph: -->` 참조를 graph 블록으로 변환.
- gate-server 는 `/api/state` 의 `artifacts[]` 에 동반 json 파싱 결과(`graph: {file, artifact}`)를 포함. `decision.artifactMd` 필드 제거.
- Stage 2·3 `designPrompt` 가 2파일 규약(json 저장 + 참조 코멘트 + position 금지)을 지시; Feedback 에이전트는 md 참조를 따라 json 도 함께 검토.
- 그래프 수정은 채팅 경유만 가능 — 즉석 노드 추가 같은 직접 조작은 불가(트레이드오프, 5대 원칙과 일관).
- 구 펜스 산출물은 그래프가 표시되지 않음(현재 확정 산출물 부재로 실질 영향 없음).
- 자동 배치 알고리즘은 자체 테스트(겹침 0·그룹 포함·결정성)로 회귀 가드.

## 참고

- [[ADR-006-graph-editor]] — 대체됨(그래프 에디터·직접편집→채택 폐지)
- [[ADR-010-md-design-stage]] — 대체됨(인라인 펜스 임베드 폐지, md 단일진실은 유지)
- [[ADR-015-stage-artifact-folders]] — 동반 json 이 `stageN/` 폴더에 함께 승격
- [[implementation-architecture]] — 뷰어·게이트 서버 구조
