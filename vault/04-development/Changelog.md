---
updated: 2026-08-07
tags: [development, changelog]
---

# Changelog

FactoryNote의 주요 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 양식.
코드/기능 변경을 같은 세션에서 이 파일에 반영한다.

## [Unreleased]

### Added

- **auto-advance 모드(게이트 자동 승인)** — `/factorynote auto [on|off]` 서브커맨드로 3단계 게이트를 자동 승인한다. 기본 OFF. ON 시 `drivePlan` 이 매 단계 게이트의 사용자 결정 블로킹 대기를 하지 않고 즉시 `confirm` 반환하되, **관찰용**으로 게이트 서버+브라우저는 열어 3단계 산출물 진행을 실시간 관찰 가능하게 한다(새 `observeGate` 헬퍼, `runGate` 와 별개 export). 개발/데모/빠른 프로토타입용 탈출구(escape hatch) — 5대 원칙을 의도적 우회하므로 프로덕션 계획에는 비권장. `planMode` 와 동일한 세션 메모리, 파이프라인 완료 시 자동 해제(#5). 계층: pi-adapter(`index.ts`·`plan-tool.ts`·`gate-server.ts`)에 한정, `@factorynote/core` 미변경. 자체체크 53건 green(`bun run build`·`bun test` 0 종료).

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

- **영속 게이트 서버 + 단계별 탭 유지** — 단계마다 새 서버/포트/탭을 여는 대신 **기능별 하나의 영속 게이트 서버(안정 포트)** 로 전환. 같은 브라우저 탭이 단계 전환을 따라간다.
  - `gate-server.ts`: `runGate` 가 단계마다 `createServer`→`listen(0)`→`openBrowser`→`close` 하던 것을 `getOrCreateGate(root, feature)` 가 기능별 서버를 Map 캐싱해 재사용. `POST /api/decision` 후 서버를 닫지 않음. 신규 `closeGate(root, feature)`(플랜 완료 시 종료, 멱등). 브라우저 오픈은 **탭이 없을 때만** — 뷰어 `/api/state` 2s 폴링이 `gate.lastSeen` 갱신(하트비트); 탭 살아있으면 재오픈 안 함(다중 탭 방지), 닫혔거나 최초면 다음 게이트 시작 시 재오픈. `signal` 중단·`timeoutMs` 만료 시 modify 복귀하되 서버 유지(인터럽트 복구가 같은 탭 재사용).
  - `ViewerState` 에 `gateOpen: boolean` 추가(`/api/state`).
  - `plan-tool.ts`: 플랜 완료(done) 시 `closeGate` 호출.
  - `App.jsx`: **폴링 상태머신**(loading/reviewing/preparing/closed). 결정 POST 후 "다음 준비 중…" 화면으로 1초 폴링 → `gateOpen` 다시 true 시 같은 탭에서 다음 단계 자동 표시 + **알림**(Web Notification + 타이틀 점멸 + `window.focus`). 비-최종 결정 후 마감 화면으로 끊기지 않음.
  - `onReady` 훅을 async 대기하도록 정확화(레이스 가드). 자체체크 52건(서버 재사용·탭 생존 시 비재오픈·탭 닫힘 시 재오픈 테스트 추가) green. `bun run build`/`bun test` 0 종료.

- **뷰어 목업 → production 앱 이동** — `prototypes/plan-page-mockup` → `apps/plan-viewer`(`apps/*` 워크스페이스 멤버). 더 이상 목업이 아닌 게이트 UI의 정식 위치. 패키지명 `plan-page-mockup` → `plan-viewer`.
  - 경로 참조 갱신: `resolveViewerDistDir`(`apps/pi-extension/src/index.ts`), 게이트·drivePlan 테스트 `VIEWER_DIST`, `ensure-viewer-dist.ts` preload, `scripts/install.sh`.
  - `prototypes/` 폴더 제거: 초기 HTML 시안 3개(`module-design/`, `plan-page/` — React 뷰어에 계승, git 복구 가능) 삭제.
  - 루트 `bun install`이 `apps/plan-viewer` 의존성을 hoist. 활성 문서(AGENTS·README·architecture·03-design·90-meta guides) 경로 갱신.
- **6단계 → 3단계 파이프라인 통합** ([[ADR-008-3-stage-pipeline]]) — 게이트 6→3으로 축소.
  - **Stage 1**(구 1+2): 요청 이해 + 동작 시나리오를 한 마크다운 산출물(`01-understanding-and-scenarios.md`)로 통합.
  - **Stage 2**(구 3+4): 모듈·클래스 설계를 한 그래프 산출물(`02-design.json`)로 통합. 종류 판별을 스테이지에서 **노드 타입 per-section 추론**으로 이동(`lib/graphNormalize.js` `sectionIsClass`) — 한 페이지에 모듈 섹션과 클래스 섹션이 공존. `GraphStage.jsx`의 `isClass`를 활성 섹션에서 파생.
  - **Stage 3**(구 5 유지): 구현 계획 — **종료 게이트**(확정 시 파이프라인 완료, `engine.ts` done=Stage 3 confirm).
  - **구 Stage 6(사용자 최종 검증) 폐지** — 정합성 게이트는 이관하지 않음. `ArtifactFormat` `matrix` 제거, `StageId=1|2|3`/`ValidThrough=0..3`.
  - 뷰어: 죽은 목업 5종(`Classes`/`ImplementationPlan`/`ModuleDesign`/`Scenarios`/`FinalReview`) 삭제, `App.jsx`/`GraphStage`/`PlanPage`/`GateBar`/`Stepper` 3단계화, 뷰어 dist 재빌드.
  - 문서: `AGENTS.md`(5대원칙·카운트), [[project-identity]], [[multi-agent-pipeline]], [[implementation-architecture]], [[Home]], [[03-design/plan-viewer/ui-mapping|ui-mapping]] 갱신. (참고: `03-design/module-design`·`classes`·`workflow-core` 사양은 사전 병합 6단계 설계 기록 — 현행은 ADR-008 + Stage 2 designPrompt.)
  - 자체체크 49건 green(`bun run build`·`bun test` 0 종료). `bun test`는 뷰어 dist(gitignore 빌드 산출물)가 없으면 자동 빌드(`ensure-viewer-dist.ts` preload, `bunfig.toml`) — 신규 클론에서도 게이트 테스트가 재현 가능.
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
