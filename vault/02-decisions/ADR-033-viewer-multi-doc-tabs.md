---
status: accepted
updated: 2026-08-19
tags: [adr, viewer, tabs, satellites]
---

# ADR-033: 다중 문서 뷰어 탭(위성 design 문서 1:1 탭)

> **TL;DR**: 병렬 위성 design 에이전트(ADR-031)가 각각 작성한 문서(`draft.<role>.md`)가 뷰어에서 파일명 라벨 탭과 1:1로 렌더된다. `/api/state` 산출물 항목에 `satellites` 필드(존재하는 위성 파일만)를 추가하고, 뷰어는 주 문서 탭 뒤에 위성 탭을 고정 탭으로 나열한다. 탭 바는 문서 수와 무관하게 항상 표시. 게이트·검증·승격은 여전히 주 문서 기준(위성은 표시 전용).

## 상태

accepted

## 날짜

2026-08-19

## 맥락 (Context)

ADR-031로 위성 design 에이전트가 주 문서와 병렬로 `draft.<role>.md`를 작성하지만, 뷰어는 단계당 단일 산출물만 렌더해 위성 문서는 볼 수 없었다(`viewer-state.ts` TODO로 유예). 사용자는 각 design 에이전트의 문서를 탭과 1:1로 보기를 요청. 협의에서 2결정 확정: (1) 탭 라벨 = 파일명 그대로, (2) 문서가 1개뿐이어도 탭 바 항상 표시.

## 결정 (Decision)

1. **게이트 페이로드 = `artifacts[].satellites`**: `viewer-state`가 각 단계 산출물 항목에 `satellites?: {file, md}[]` 포함 — 단계 메뉴(`designMenuForStage`) 역할명 기준으로 위성 파일(`satelliteFileName`)을 피처 루트에서 읽어 **존재하는 것만** 메뉴 순서대로. 위성은 승격 없이 피처 루트에 남으므로(ADR-031) 읽기 위치는 루트; 회귀 시 `invalidateArtifactsAfter`가 위성 파일도 삭제하므로 stale 노출 없음. 없으면 필드 생략.
2. **탭 1:1 = 파일명 라벨 고정 탭**: 주 문서 탭(id `doc`, 라벨=서빙 파일명) 뒤에 위성 탭(id `doc:<파일명>`, 라벨=파일명)을 `pinned`로 나열(`viewerTabs.docTabs`). 닫기 불가 — 탭 바가 곧 문서 목록(재개봉 경로 불필요). 문서 1개여도 탭 바 표시.
3. **레이아웃 동기화 = `splitLayout.syncDocTabs`**: 문서 집합 변동(위성 등장·스테이지 전환) 시 전 leaf의 문서 탭을 새 목록으로 교체(라벨 갱신 포함) — 사라진 탭 제거, 새 탭은 첫 leaf의 문서 탭 뒤에 삽입, 그래프 탭·사용자 분할 배치·복제 사본 유지. 문서 탭만 남아 비게 된 leaf는 트리에서 축소.
4. **위성 탭은 읽기 전용 렌더**: 코멘트·범위 코멘트·블록 활성화·scroll-spy 없음(게이트·검증·승격이 주 문서 기준이므로 코멘트 채널도 주 문서로 한정). 그래프 없음(위성 그래프 금지, ADR-031). 글자 배율(`fontScale`)은 주 문서와 공유. 분할·드래그는 주 문서 탭과 동일하게 가능.
5. **목차(Toc)는 주 문서 기준 유지**: 위성 탭 활성일 때도 Toc은 주 문서 헤딩 목록(다중 문서 scroll-spy 중첩은 범위 밖).

## 이유 (Rationale)

- 파일명 라벨: 에이전트 산출 파일과 탭의 대응이 명확(요청 사항). 승격된 주 문서 서빙 파일명(`stageN/` 산출물명)을 그대로 사용 — 게이트 오픈 시점 뷰어가 보는 파일과 일치.
- 항상 탭 바 표시: 문서 수에 따른 레이아웃 흔들림 제거, 탭 모델 일관(요청 사항).
- 표시 전용(승격·게이트 제외): ADR-031의 '주 문서 단일 진실' 계약을 유지하면서 열람만 확장 — 최소 침범.
- syncDocTabs가 기존 문서 탭을 새 목록 버전으로 **교체**: 스테이지 전환 시 주 문서 탭 라벨이 이전 단계 파일명으로 남는 결함 방지(테스트로 포착).

## 대안 (Alternatives)

- **위성 문서를 주 문서에 병합 서빙**: 탭 1:1 요구와 어긋나고 병합 순서·경계 문제가 생겨 배제.
- **위성 탭 closable + 재개방 UI**: 닫으면 다시 열 경로가 필요(목록 메뉴 등) — 고정 탭이면 불필요해 배제.
- **위성 승격(stageN/ 복사)**: 게이트·무효화·검증 경로 전부 수정 필요 — 표시 목적 대비 과잉이라 배제.

## 결과 (Consequences)

- 신규: `data/sat-requirements-scope.md`·`data/sat-scenario-acceptance.md`(테스트 뷰어 예시 위성 문서) · 자체체크 7건(viewerTabs docTabs 1 + splitLayout syncDocTabs 4 + 게이트 satellites 서빙 1 + App 렌더 1 + mock-api 통과 1).
- 변경: `viewer-state.ts`(satellites 조립, TODO 해소) · `viewerTabs.js`(`docTabId`·`docTabs`) · `splitLayout.js`(`syncDocTabs`) · `PlanPage.jsx`(위성 탭 렌더·동기화) · `SplitNode.jsx`(pane 클래스 판정) · `App.jsx`(`satelliteDocs`·`mainDocLabel` 전달) · `vite.config.js`(Stage 1 위성 시나리오).
- 제약: 위성 탭은 코멘트 불가(주 문서만), Toc은 주 문서 기준. 자체체크 261 pass.

## 참고 (References)

- [[ADR-031-parallel-design-satellites]] — 병렬 위성 design 에이전트(본 결정의 기반)
- [[ADR-031-viewer-graph-detail-tabs]] — 탭 바 모델
- [[ADR-032-viewer-tab-splitting]] — 분할 레이아웃(위성 탭도 동일 조작)
- [[ADR-031-viewer-test-viewer-rule]] — 테스트 뷰어 갱신 규칙
