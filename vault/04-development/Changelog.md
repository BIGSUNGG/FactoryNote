---
updated: 2026-08-03
tags: [development, changelog]
---

# Changelog

FactoryNote의 주요 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 양식.
코드/기능 변경을 같은 세션에서 이 파일에 반영한다.

## [Unreleased]

### Added

- **MVP 구현(Stage 5)** — FactoryNote 가 pi 하네스에서 실동작. 모든 스텁 진입점을 실구현으로 교체. [[ADR-005-mvp-implementation]].
  - 코어(`packages/factorynote/src`): Stage Registry(6단계) + 순수 상태기계 엔진 + persistence(`.factorynote/<feature>/state.json` atomic r/w + 손상 복구 + 산출물 `NN-stage.md`). harness-agnostic, 런타임 npm 의존 0.
  - Pi 확장(`apps/pi-extension/src`): `/factorynote` plan 모드 토글 + `before_agent_start` 계획 프롬프트 주입 + `factorynote_plan` 도구(6단계 게이트 구동). 웹 페이지가 게이트 — 로컬 HTTP 서버로 뷰어 서빙 + POST `/api/decision` 로 결정 수집. Tier 0 단일 에이전트.
  - 뷰어 연동(`prototypes/plan-page-mockup`): `/api/state` fetch + `/api/decision` POST 하도록 개조, `dist/` 재빌드.
  - CLI(`bin/factorynote.mjs`): 순수 Node 상태 조회(status/list). 설치(`scripts/install.sh`): `~/.pi/agent/extensions/factorynote/` 배치 + 로컬 pi 자동 발견.
  - 자체체크 19건(core 엔진·게이트 서버·확장 로드·drivePlan 종단간) 통과. `bun run build`/`typecheck` 0 종료.
- **구현 문서화** — [[implementation-architecture]](코드 구조·런타임 데이터 흐름·데이터 계약), [[usage-guide]](설치/사용), [[development-guide]](빌드/테스트/확장). 루트 `README.md` 를 구현 상태로 갱신, `AGENTS.md`(5대 원칙·오리엔테이션, 누락분 신규 작성). [[Home]] 링크 연결.
- **Stage 3/4 다중 섹션 그래프 에디터** — 마크다운 텍스트에서 인터랙티브 그래프(react-flow)로 전환. 다중 섹션(프론트/백엔드/인터 등, **독립 그래프**) + 노드/엣지 CRUD(우클릭 메뉴) + 상세 패널 편집 + 클래스 parent-child·`NodeResizer`. **직접 편집 → 에이전트 채택**(게이트 제출 시 편집된 그래프를 `graphSections` 로 POST → `drivePlan` 이 `.json` 산출물로 저장). Stage 3/4 산출물 = `.json`(`GraphArtifact`{sections}), 에이전트는 의미 구조 JSON 생성(위치 생략 → 뷰어 자동 배치). 신규 `GraphStage.jsx`·`core/graph.ts`·`lib/graphNormalize.js`(정규화 분리). 자체체크 33건(그래프 정규화 7건 포함). [[ADR-006-graph-editor]].

- [[project-identity]] — FactoryNote 정체성, Plannotator 차이점, 범용성(harness-agnostic), 5대 원칙, 용어집.
- [[multi-agent-pipeline]] — Director/Design/Feedback 에이전트 구조, Design↔Feedback 루프, 6단계 파이프라인, 승인 게이트.
- Workflow Core 설계 산출물 5종(`03-design/workflow-core/01..05`) — Hybrid 실행 모델(프로토콜 본체 + 얕은 코드), Tier 0/1 에이전트 모델, 6단계 dogfood로 자체 검증.
- 문서 시스템 구축: `vault/` Obsidian 볼트(7영역) + Doc-Conventions/How-To-Update-Docs + ADR 템플릿.
- 루트 `AGENTS.md`(상시 프로젝트 오리엔테이션) 추가 — [[ADR-002-hybrid-harness-and-graph-git]].
- graphify 스킬 설치(`~/.pi/agent/skills/graphify/`). 코드 생긴 뒤 첫 빌드 예정.
- [[plannotator-plan-page]] — Plannotator plan 페이지(요소·레이아웃·정보·디자인 패턴) 분석 조사 노트. Orca computer-use 접근성 트리 기반 추출.
- [[core-features]] — Plan 뷰어 핵심 기능(블록 hover-to-comment + MD 파일 렌더링) 사양. React 목업(`prototypes/plan-page-mockup/`)으로 검증, 향후 본 구현 필수 요구사항 체크리스트 포함.
- [[03-design/module-design/features|module-design features]] — Stage 3 모듈 설계 페이지 사양. mermaid 정적 → **react-flow 인터랙티브 에디터** 전환: 노드·엣지 CRUD(생성/제거/이동/편집/방향반전) + **우클릭 컨텍스트 메뉴**(빈 공간=추가·노드=제거·엣지=반전/제거) + 노드·엣지 상세·코멘트·수정 지시 일괄 적용.
- [[03-design/classes/features|classes features]] — Stage 4 클래스 설계 페이지 사양. **모듈 그룹이 클래스를 감싸는 계층 구조**(parent-child) + 모듈 우클릭으로 해당 모듈에 클래스 추가 + 상세 모듈 select로 클래스 이동 + `NodeResizer` 모듈 박스 크기 조절.
- [[03-design/plan-viewer/ui-mapping|ui-mapping]] — Plan 뷰어 Stage별 UI 매핑(1·2·5=문서형·3·4=그래프 에디터형·6=검토형). 두 UI 양식 공유 + `PlanPage` 추출.
- [[ADR-003-viewer-architecture]] — 뷰어/UI 아키텍처 결정: 코어는 산출물 파일만 생산, 뷰어가 렌더(별도 레이어). Pi=마크다운+승인 프롬프트(Tier 0), 웹 React=옵션. 코멘트→'수정 지시'→Design Agent.
- [[03-design/workflow-core/06-viewer-ui|06-viewer-ui]] — Stage별 산출물 포맷(MD/nodes-edges/매트릭스) + 뷰어 인터페이스 계약 + 코멘트→수정 게이트 연결. M1 Stage Registry 강화 근거.
- **모노레포 스캐폴드** — [plannotator](https://github.com/backnotprop/plannotator) 폴더 패턴(`apps/`+`packages/`+`docs/`+`bin/`+`scripts/`+`tests/`, bun workspaces) 채택. `apps/{pi-extension,claude-code,codex}`(Layer 3 어댑터) + `packages/factorynote`(Layer 1-2 코어: `protocol/stages`·`protocol/templates`·`orchestrator` 마크다운 + `src/` 배럴). 3계층↔폴더 1:1 매핑. 현재 **폴더 골조 + 설정만**(`src/` M3 persistence·M4 인터페이스·타입 스텁은 Stage 5 구현 시 추가). `vault/`·`.pi/`는 배포 제외 참고. [[ADR-004-monorepo-structure]]. `bun install` + `tsc -b` typecheck 통과.

### Changed

- **파이프라인 경화(hardening, fn-integration)** — MVP 병렬 3-워크트리 통합 후 식별된 통합 결함·요구사항 gap을 단일-owner 직접 수정으로 폐쇄. Orca supervised orchestration(3 워크트리×pi 에이전트) + metricless /loop(review 서브 재심사 구동)로 진행.
  - **FR-7 다단계 회귀 end-to-end 완결** — `GateDecision.revertTo` + 엔진 clamp + `PipelineState.validThrough` + `invalidateArtifactsAfter(root,feature,state.stage)`(회귀 시 대상 이후 산출물 무효화) + 뷰어 회귀대상 Stage 셀렉터(`GateBar.jsx`→`revertTo` POST) + gate-server forward. 기존엔 엔진 역량만 있고 뷰어/서버 seam이 끊겨 1단계 회귀만 동작.
  - **FR-2 반복 상한 경성 에스컬레이션** — `MAX_LOOPS`/`atLoopCeiling(state)` 헬퍼 + modify@ceiling 시 에스컬레이션 메시지(잔존 이슈 노출 + (a)재작성 (b)회귀 (c)재협의 옵션). 기존 advisory-only → 경성.
  - **#4 게이트 타임아웃 활성화** — `runGate` `timeoutMs`(기본 30min) + `settled` 1회-resolve 가드 → 사용자 이탈 시 좀비 게이트 자동 modify 복귀.
  - **#3 gateOpen 인터럽트 resume** — `drivePlan`이 gateOpen+산출물 존재 시 재작성 요구 없이 게이트 재오픈.
  - **#5 plan 모드 자동 해제** — 파이프라인 완료(done) 시 `planMode=false` → 사용자가 매번 `/factorynote` 토글하지 않도록.
- `05-implementation-plan`(이후 제거 — Removed 참조) 재작성 — 구현 가능한 서브태스크(파일·함수 단위) + 검증 게이트 + 뷰어 포맷(`format` 필드, graph 템플릿) 반영. Phase 0–3 마일스톤 명확화.
- `valut/` 오타 폴더 제거 → `vault/`로 재생성.
- PI harness를 `.pi/skills` 단일 → 루트 `AGENTS.md` + `.pi/skills/doc-workflow` **하이브리드**로 변경([[ADR-002-hybrid-harness-and-graph-git]]).
- `graphify-out/` Git 정책: 전체 gitignore → **그래프는 커밋**(`cache/`·`cost.json`만 제외).
- "9단계 파이프라인" → **"6단계 파이프라인"** 으로 전면 정정(`AGENTS.md`, `Home.md`, ADR-001, How-To-Update-Docs, doc-workflow 스킬).
- Stage 6 재설정: "검증 계획 산출" → **사용자 최종 검증 게이트(산출물 없음)**. 파이프라인은 6단계, 산출물은 5개.
- Workflow Core 산출물 경로: `vault/03-design/` → **`<outputDir>`(기본 `designs/`, 설정 가능)**. vault는 FactoryNote 자체 문서용.

### Fixed

- **gate-server `revertTo` 탈락(P0)** — `/api/decision` 핸들러가 decision 재조립 시 `revertTo`를 drop 해 D5 다단계 회귀가 end-to-end 무력화됨. forward 추가 + 회귀 테스트. (review 서브 재심사로 발견 — ast-grep audit는 구조상 검출 불가.)
- **`validThrough` NaN 가드(P1)** — `validateState` 마이그레이션이 `typeof==='number'`라 `NaN`을 통과시킴 → `Number.isFinite`로 전부 가드. null/undefined/NaN → 0.

### Removed

- 빈 `valut/` 폴더.
- `03-design/workflow-core/05-implementation-plan` — 구현 순서(Phase 0–3) 계획 문서. workflow-core의 6단계 파이프라인 설계(Stage 5 "구현 계획" 단계)는 유지, dogfood 산출물 예시 파일만 제거(구현 순서는 코드와 함께 Dev-Log로 추적).

## [0.0.0] - 2026-07-26

- 리포 초기화(`.gitattributes`, `LICENSE`).
