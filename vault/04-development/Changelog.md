---
updated: 2026-08-07
tags: [development, changelog]
---

# Changelog

FactoryNote의 주요 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 양식.
코드/기능 변경을 같은 세션에서 이 파일에 반영한다.

## [Unreleased]

### Changed

- **코멘트 → 실시간 채팅 통합** — 블록/셀/영역 코멘트(`PlanPage`)와 그래프 코멘트(`DesignStage`)를 로컬 큐 적재가 아닌 즉시 `POST /api/chat`(blockId/node 스코프)로 전송. 코멘트가 채팅 메시지(`role:"user"`)로 표시되며 기존 `chatPending` 루프로 에이전트에 즉시 전달(게이트 유지). [[ADR-011-comment-to-chat-consolidation]].

### Removed

- **SidePanel 검토 패널 전체** — `PlanPage` 우측의 검토 코멘트 큐 + Design↔Feedback 루프 + Feedback 이슈 + 어노테이션 제거. 검토 레이아웃이 [문서 | 채팅] 2단으로 단순화. `SidePanel.jsx` 삭제.
- **"✎ 수정 지시" 게이트 버튼** — 공용 `GateBar`에서 제거(확정·정정은 유지). 코멘트가 채팅으로 즉시 전달되므로 일괄 modify 트리거 불필요. `PlanPage`/`DesignStage` 의 `sendModify`/`submit("modify")` 경로 제거.
- **데드 코드 정리(감사)** — `GraphStage.jsx`(bc674f6 의 GraphStage→DesignStage 교체 시 미삭제 잔류; 미사용 + 제거된 `pendingCount` prop 참조) 삭제. 제거된 SidePanel/apply-badge 의 죽은 CSS(`.apply-badge`·`.review-comments`·`.review-comment`·`.rc-target`·`.count`·그룹 선택자의 `.rc-quote`) 제거.

### Fixed

- **코멘트→채팅 즉시 갱신 + 폴링 0.5초** — 블록/셀/영역/그래프 코멘트 전송 시 `fn-chat-update` 윈도우 이벤트로 `ChatSidebar` 를 즉시 갱신(POST 완료 후 발화)해 내 코멘트가 지체 없이 채팅에 표시. `ChatSidebar` 폴링 2초→0.5초(에이전트 회신 등 안전망).
- **여러 블록에 걸친 범위 코멘트** — 두 제약 해소. (1) **하이라이트**: 한 번에 감싸는 기법(멀티 노드 범위에서 에러로 스킵)을 텍스트 노드 순회·각각 `<mark>` 감싸기(`highlightRange`)로 교체 → 여러 블록 드래그도 하이라이트. (2) **스코프**: `Document.jsx` 가 `range.intersectsNode` 로 선택이 걸친 모든 블록 수집 → `PlanPage` 가 `blockId` 쉼표 결합(`b2,b3,b4`)으로 전송(이전엔 시작 블록 하나만). 팝오버 헤더에도 전체 범위 표시.
- **범위 코멘트 인용(quote) 누락** — 채팅 통합 시 드래그 영역 코멘트의 선택 텍스트(`quote`)가 `POST /api/chat` body에서 빠져, 에이전트가 어느 블록인지는 알아도 정확히 어떤 범위인지 몰랐던 것 수정. `ChatMessage.quote` 타입 추가 → `gate-server` `/api/chat` 파싱·저정 → `plan-tool` `formatChat` 이 `(인용: "…")` 로 렌더 → `ChatSidebar` 말풍선에 인용 표시. gate-server 테스트에 quote 왕복 검증 추가.
- **에이전트 채팅 미동작(Bug 1)** — `apps/pi-extension/src/index.ts` 의 `factorynote_plan` 도구가 채팅 프로토콜과 미연결이었던 것 수정. `chatResponse` 파라미터 추가·`execute`→`drivePlan` 전달·`chatPending` 노출(`formatForAgent`)·`PLAN_MODE_PROMPT` 채팅 처리 지시. 이제 게이트 열린 동안 우측 채팅이 에이전트에 전달돼 답변/그 자리 수정이 동작.
- **Stage 2 그래프 안 보임(Bug 2)** — `apps/plan-viewer/src/lib/designMd.js` 파서가 에이전트 출력 편차에 취약했던 것 강화: 후행쉼표/`//` 주석 무경화(`sanitizeJson`), 비 `factorynote-graph` 펜스 fallback, **bare 섹션 객체**(sections 래퍼 누락) 수용. 구조 미검색 시 `DesignStage.jsx` 가 원인 특정 진단 배너(mermaid/```json/no-fence 분류) + 산출물 미리보기 표시.

### Changed

- **`bun run build` = 빌드+배포 자동화** — `tsc -b` + viewer 빌드 + `install.sh` 배포를 한 번에 실행. 소스 수정이 설치 확장(`~/.pi/agent/extensions/factorynote`)에 누락돼 사용자가 구버전을 쓰던 **근본 원인(미배포) 재발 차단**. 순수 타입체크는 `bun run typecheck`. AGENTS.md 빌드 설명 동기화.

### Added

- **실시간 에이전트 채팅 사이드바(Feature 1)** — 게이트가 열린 동안 계획 페이지 우측에서 에이전트와 실시간 채팅. 질문/수정 요청 → `drivePlan` 으로 에이전트에 전달 → 답변 또는 현 산출물 그 자리 반영(뷰어 실시간 갱신, 게이트 유지). 부분 코멘트는 기존 `blockId` 단위. 채팅 수정은 `MAX_LOOPS` modify 루프카운트 미포함. `runGate` 가 `GateEvent({kind:decision|chat})` 로 resolve, `drivePlan` 이 `chatPending` 반환 후 에이전트 재호출로 게이트 재진입. 신규 `ChatSidebar.jsx` + `/api/chat`(POST/GET) + `appendAgentChat`. [[ADR-009-realtime-chat-loop]].
- **Stage 2 설계 md 단일진실(Feature 2)** — Stage 2 산출물을 그래프 JSON(`02-design.json`)에서 마크다운(`02-design.md`)으로 전환. md 의 ```factorynote-graph 펜스(JSON `{sections}`)에서 그래프 파생 + 하단 `## 아키텍처 설명` prose. 그래프 편집은 md 구조 블록으로 역동기화(`parseDesignMarkdown`/`serializeDesignMarkdown`/`applyStructureToMarkdown`). `ArtifactFormat` 을 `"markdown"` 단일로 좁히고 `GateDecision.graphSections`→`artifactMd` 로 채택 일반화. `GraphStage.jsx`→`DesignStage.jsx` 교체. [[ADR-010-md-design-stage]].
- **단계별 프롬프트 품질(Feature 3)** — Stage 1 designPrompt/체크리스트에 미래 확장 포인트·확장성/유지보수성 관점 추가; Stage 2 에 객체지향 적합성·확장성/유지보수성·불필요 관계·모듈·클래스 검증 추가.

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
