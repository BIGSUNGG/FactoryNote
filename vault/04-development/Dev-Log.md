---
updated: 2026-08-03
tags: [development, dev-log]
---

# Dev-Log

날짜별 작업 기록. 무엇을 했는지, 왜, 무엇이 남았는지. [[Changelog]]는 외부용 단위, 본 파일은 일일 흐름.

## 2026-08-03

### 파이프라인 경화 — Orca orchestration + metricless /loop

MVP 병렬 3-워크트리 통합(fn-integration) 후 드러난 통합 결함·요구사항 gap을 폐쇄. [[Changelog]] [Unreleased] 파이프라인 경화 항목 참고.

#### 한 일

- **병렬 라운드(Orca supervised orchestration)**: 3 워크트리×pi 에이전트(코어/어댑터/게이트)로 D1~D5 원판 작성·통합. pi 는 Orca `dispatch --inject` 비인식(v1.4.159) → 일반 디스패치 + `terminal send` 수동 주입으로 해결.
- **seam 결함 발견→폐쇄**: 병렬 분할이 "연결 wiring"을 명시하지 않아 신규 심볼이 dead code가 됨(`invalidateArtifactsAfter`·`atLoopCeiling`·`timeoutMs` 미호출). 단일-owner 직접 수정(plan-tool/persistence)으로 연결.
- **review 서브 재심사로 P0 포착**: gate-server 가 `/api/decision` 에서 `revertTo` 를 drop(D5 다단계 회귀가 end-to-end 무력화) — ast-grep audit 는 구조상 검출 불가, 정성 재심사가 포착. forward + 회귀테스트로 수정.
- **FR-2 경성 에스컬레이션**: modify@ceiling 시 에스컬레이션 메시지(잔존 이슈 + 재작성/회귀/재협의 옵션). 기존 advisory-only 에서 경성으로.
- 기타: P1 `Number.isFinite` 가드·doc 주석 정정·Changelog 갱신. 누적 7 코드 커밋 + 1 doc 커밋.

#### 왜

- **병렬 워크트리는 빠르나 seam 관리가 관건** — coordinator 가 호출처를 단일 워커에 명시 귀속해야 이음새가 안 끊김(이번 교훈).
- **metric 측정이 이 머신(pi-loop `spawn bash` ENOENT)에서 깨져** metricless /loop 로 수렴 판단을 coordinator 가 대행 — 종료 판단은 review 서브 재심사(CLEAN, P0/P1=0)로 확정.

#### 남은 것

- [[implementation-architecture]] 런타임 데이터 흐름·결정 표가 **구 동작을 서술**(단일 회귀·advisory-only·타임아웃 無) → 코드와 불일치, 갱신 필요.
- fn-integration(13 커밋) → main 머지: **사용자 승인 대기**(FF 추천).
- (scope-creep, 별도 goal) FR-2 사용자 조정 상한(ADR-005 연기) · gate-server revertTo server-side clamp.

## 2026-08-01

### MVP 구현(Stage 5) — pi 하네스 실동작

모든 진입점이 스텁이던 상태에서 MVP 를 끝까지 구현. [[ADR-005-mvp-implementation]] 참고.

#### 한 일

- **코어(packages/factorynote/src)**: types.ts·stages.ts(6단계 Registry)·persistence.ts(.factorynote/<feature>/state.json atomic write-then-rename + 손상 시 .corrupt-*백업 후 복구 + 산출물 NN-stage.md r/w)·engine.ts(순수 상태기계: confirm/modify/revert 전이). harness-agnostic, node:* 만 사용(런타임 의존 0). engine.test.ts 10건.
- **Pi 확장(apps/pi-extension/src)**: index.ts(/factorynote 명령=모드 토글 + before_agent_start 계획 프롬프트 주입 + factorynote_plan 도구 등록) · gate-server.ts(로컬 node:http 서버 — /api/state·/api/decision + 뷰어 dist 정적 서빙 + 브라우저 오픈 + signal 중단 처리) · plan-tool.ts(drivePlan: 산출물 저장→게이트→결정→상태 전이). gate-server.test.ts·plan-tool.test.ts·load.test.ts 추가.
- **뷰어 연동(prototypes/plan-page-mockup)**: App.jsx 가 /api/state fetch + /api/decision POST 하도록 개편, GateBar.jsx/PlanPage.jsx 게이트 콜백 연결. vite build 재빌드.
- **CLI(bin/factorynote.mjs)**: 순수 Node(ESM) 상태 조회. **설치(scripts/install.sh)**: ~/.pi/agent/extensions/factorynote/ 에 확장 TS + @factorynote/core(로컬 node_modules 패키지) + 뷰어 dist 배치.
- **빌드/의존성**: @types/node·bun-types 추가(tsconfig types 로 bun-types 지정 → node 내장 타입 동시 해석), 루트 build 스크립트를 tsc -b 로 수정. bun run build/typecheck 0 종료, 자체체크 19건 통과.

#### 왜

- 사용자 시드 5종(모드 토글·웹페이지 게이트·수정/확정 루프·pi 실동작·로컬 설치)을 최소 구현으로 충족(ponytail). ADR-003/FR-8 와 시드가 다른 부분은 사용자 의도 우선으로 [[ADR-005-mvp-implementation]] 에 기록.
- 제어흐름+영속은 코드(테스트 가능), 산출물 판단은 LLM — hybrid 원칙 유지.

#### 문서화

- [[implementation-architecture]] — 3계층 코드 맵·모듈 책임·런타임 데이터 흐름(mermaid 시퀀스)·state.json·/api 계약·설치 레이아웃.
- [[usage-guide]](설치/사용/게이트 UX/트러블슈팅) · [[development-guide]](빌드·테스트·의존성 메모·확장 시나리오: 단계 추가·뷰어 수정·harness 어댑터·Tier 1).
- 루트 `README.md` 를 구현 상태로 갱신(스캐폴드 기술 제거, install + /factorynote 퀵스타트, 문서 인덱스). 누락돼 있던 `AGENTS.md`(5대 원칙·오리엔테이션) 신규 작성. [[Home]] 에 신규 문서 링크.

#### 그래프 에디터(Stage 3/4) — 다중 섹션 인터랙티브 에디터

ADR-005 에서 연기했던 Stage 3/4 그래프 에디터를 본구현([[ADR-006-graph-editor]]).

- **데이터 모델**: Stage 3/4 산출물을 마크다운 → 다중 섹션 그래프 JSON(`03-modules.json`·`04-classes.json`, `{sections:[{id,title,nodes,edges}]}`). 코어 `types.ts`(GraphSection/GraphArtifact) + `graph.ts`(parseGraphArtifact) + `graph.test.ts`.
- **확장**: `gate-server` /api/state 가 `graphSections` 반환·/api/decision 이 수신; `drivePlan` 이 그래프 단계 결정의 `graphSections` 를 `.json` 산출물로 저장(직접 편집 → 에이전트 채택). `plan-tool.test`·`gate-server.test` 그래프 플로우 추가.
- **뷰어**: 신규 `GraphStage.jsx`(Stage 3/4 통일) — `/api/state` graphSections 로 데이터 주동 렌더, 다중 섹션(탭 + 추가·이름·삭제), 노드/엣지 CRUD(우클릭 메뉴), 상세 패널 편집, 클래스 parent-child + NodeResizer, 코멘트. `App.jsx` 가 Stage 3/4 → GraphStage 분기. 게이트 POST 에 graphSections 포함.
- **검증**: build/typecheck 0, 자체체크 33건(그래프 r/w·게이트 graphSections·drivePlan 채택·Stage 4 class 타입 정규화). 뷰어 빌드 통과. 재설치 + pi 로드 스모크 통과.
- **수리(감사 지적)**: Stage 4 designPrompt 의 `type:"class"` 가 뷰어 레지스트리 키 `cls` 와 불일치→ 에이전트 생성 클래스가 빈 박스로 렌더되던 결함. 정규화 로직을 `lib/graphNormalize.js` 로 분리(`group`→modGroup, `class`→cls) + `graphNormalize.test.js` 로 Stage 4 회귀 가드. 클래스 모듈 이동(`move`) 재부모(parentNode) 도 수리.

#### 남은 것 / 다음

- 최종 인간 수락: pi 대화형 세션에서 /factorynote 토글 → 기능 요청 → 브라우저 게이트 클릭으로 종단 간 확인(사용자 수행).
- Tier 1(pi-crew)·Design↔Feedback 상한 루프·정교 자동 레이아웃·Codex/Claude Code 어댑터(그래프 에디터는 본 세션 구현 — 위 참고).

## 2026-07-29

### 재구축 — 최소 스캐폴드

모노레포 스캐폴드를 한 차례 제거(`021410c`) 후 **폴더 골조 + 최소 파일**로 재구축. TS+bun(plannotator 동일). `src/` 는 패키지 유효성 유지용 배럴(`export {}`)만 두고, M3/M4/타입 스텁은 **Stage 5 구현 시 추가**(사용자 선택: 인터페이스 스텁 제외). `bun install` + `tsc -b` typecheck 통과. 아래 첫 스캐폴드 기록은 참고용(src 스텁은 현재 미포함).

### 한 일

- vault 문서 정리: `workflow-core/05-implementation-plan.md` 제거(구현 순서/Phase 0–3 계획). 파이프라인 설계(Stage 5 "구현 계획" 단계)는 유지, dogfood 산출물 파일만 삭제. 구현 순서는 코드 진행과 함께 본 로그로 추적.
- 모노레포 스캐폴딩: [plannotator](https://github.com/backnotprop/plannotator) 폴더 패턴(`apps/`+`packages/`+`docs/`+`bin/`+`scripts/`+`tests/`, bun workspaces) 채택.
- **`packages/factorynote/`**(Layer 1-2 코어): `protocol/stages/`·`protocol/templates/`(M1 Stage Registry) + `orchestrator/`(M2 Director 규칙, 마크다운) + `src/`(배럴만 — `types.ts`·`agent-adapter.ts`·`persistence.ts` 스텁은 Stage 5).
- **`apps/`**(Layer 3 어댑터): `pi-extension/`(메인 — `PiAgentSpawn` M4 Tier1 pi-crew + `factorynote()` M5 진입점, Stage 5 구현) + `claude-code/`·`codex/`(뼈대).
- `docs/`·`bin/factorynote.mjs`(Tier 0 순수 Node)·`scripts/`·`tests/` 보조 디렉토리. 루트 `README.md`·`CONTRIBUTING.md`·`tsconfig.json`(solution)·`package.json`(workspaces).
- `bun install` + `tsc -b` typecheck 통과.
- [[ADR-004-monorepo-structure]] 작성.

### 왜

- 구현 착수 전 폴더 레이아웃 확정 필요. 사용자 지시로 plannotator(동일 harness 통합 패키지 도메인) 패턴 매핑 — 3계층(Layer 1-2 코어 / Layer 3 어댑터)을 `packages/`·`apps/` 폴더와 1:1 매핑해 이식성 경계(NFR-1)를 코드 구조로 표현.
- vault 설계(3계층·5모듈)가 이미 apps/packages 분리를 시사. 코어를 단일 패키지로 둬 과잉 분할 회피(ponytail).

### 남은 것 / 다음

- Stage 4(클래스 설계)에서 패키지 내 파일명·클래스 확정.
- `orchestrator/` 마크다운 규칙(M2)·`protocol/templates/` 6단계 산출물 템플릿 채우기.
- M3/M4 Tier1/M5 구현(Stage 5).

## 2026-07-28

### 한 일

- FactoryNote 핵심 기획 문서 2종 작성:
  - `00-vision/project-identity.md` — 정체성, Plannotator와의 차이(one-shot vs 6단계 반복 승인), harness-agnostic 범용성(Codex/Pi/Claude Code), 5대 원칙, 용어집.
  - `01-architecture/multi-agent-pipeline.md` — Director→Design+Feedback 멀티에이전트 구조, Design↔Feedback 내부 루프, 6단계 파이프라인, 사용자 게이트, 확장성.
- 사용자 검증으로 기획 핵심 확정: 파이프라인은 6단계(기존 "9단계"는 오해), 에이전트는 현재 3종(Director/Design/Feedback) 단계별 변형·확장 가능.
- "9단계" 참조 전면 정정: `AGENTS.md`, `Home.md`, ADR-001, How-To-Update-Docs, doc-workflow 스킬.
- `Home.md` MOC 갱신: 00-vision/·01-architecture/ 상태 "비어있음" → 문서 링크로 교체.
- Workflow Core 설계를 FactoryNote 자체 6단계로 dogfood 수행(전 단계 사용자 게이트):
  - 01 요구사항: FR-1..8 / NFR-1..7, Tier 0(인라인)/Tier 1(pi-crew) 에이전트 모델, 게이트 결정 5종.
  - 02 시나리오: S1 시작·S2 단계완료·S3 루프·S4 완료·S5 resume·S6 회귀.
  - 03 모듈 아키텍처: 3계층(Protocol/Engine/Adapter) · 5모듈(M1..M5).
  - 04 클래스 구조: state.json 스키마(권위), AgentSpawn 인터페이스, 파일 레이아웃.
  - 05 구현 계획: Node `.mjs`+JSDoc, Tier 0 수직 슬라이스 우선, 4 Phase.
- 게이트에서 포착한 정정 2건: (a) vault 결합 오류 → `outputDir` 도입; (b) Stage 6 산출물 → 최종 검증 게이트. 인간 게이트가 오류를 잡는 것 실증.
- Plannotator plan 페이지 분석: `localhost:56665`(Dark Mode 지원 plan)를 Orca computer-use 접근성 트리로 추출(SPA라 HTTP fetch는 빈 셸). 요소·3단 레이아웃·10섹션 정보 구조·디자인 패턴·협업 기능을 정리해 `06-research/plannotator-plan-page.md` 작성. Plannotator = 단일 `Approve` 게이트(one-shot)로 FactoryNote 6단계 게이트와 대비됨을 재확인.
- Plannotator 분석 보강 2건: (a) **고정 템플릿 골격 vs 에이전트 동적 생성 내용** 엄격 분리(§4 재구성 — 섹션 헤더/포맷은 고정, Dark Mode 코드·파일·수치는 동적 예시로 명시); (b) 저장 HTML의 6.1MB 인라인 CSS에서 디자인 시스템 직접 추출(§5 재작성) — shadcn/ui + Tailwind v4, oklch 다크 단일 테마(`--primary: oklch(75% .18 280)` 보라), 16개 코드 하이라이트 테마, Monaco/Mermaid/KaTeX 내장.
- Plan 페이지 시안 4종 HTML(`prototypes/plan-page/`, sleek→모노톤) → 시안 A 기반 React 목업 구현(`prototypes/plan-page-mockup/`): **블록 단위 hover-to-comment**(좌클릭 팝오버·전역 단일·블록 좌측 정렬·표 셀 portal+fixed로 레이아웃 보호) + **MD 파일 기반 렌더링**(markdown-it→blocks, 마크다운 전 문법·목차/타이틀 자동 파생). 두 기능을 향후 본 구현 **필수 사양**으로 `03-design/plan-page/core-features.md`에 문서화.
- 모듈 설계(Stage 3) 페이지 목업 추가(`ModuleDesign.jsx`, `#/modules`): mermaid 의존 관계도(모노톤) + **노드(모듈)·엣지(의존 A→B) 양쪽 상세·코멘트**(그래프 화살표 클릭 + 모듈 상세 의존 목록 두 진입). 의존 `DEPS` 데이터(설명 포함)로 관계 단위 검토. 사양을 `03-design/module-design/features.md`에 문서화. mermaid 의존 추가, App hash 라우팅(`#/modules`) 도입.
- 모듈 설계 에디터 고도화: mermaid → **react-flow** 인터랙티브 에디터 전환. **노드 CRUD**(빈 공간 우클릭=추가, 노드 우클릭=제거, 드래그 이동, 상세에서 이름/계층/역할 편집) + **엣지 CRUD**(핸들 연결=추가, 엣지 우클릭=방향 반전/제거, 상세에서 설명 편집). **우클릭 컨텍스트 메뉴**로 통일(버튼 제거). 우클릭 메뉴 즉시 닫힘 버그(useEffect close 리스너를 setTimeout으로 지연) 수정. `features.md` 재작성(기능 4 그래프 편집 추가).
- **Stage 전체 UI 통일**: `PlanPage` 컴포넌트 추출(mdSource·stage prop) — Stage 1·2·5가 마크다운 문서 UI(블록/영역/셀 코멘트) 공유, Stage 3·4가 react-flow 그래프 에디터 UI 공유. Stage 6는 검토형(정합 매트릭스). Stepper 클릭 + 확정 버튼으로 6단계 탐색. 시나리오/구현계획 콘텐츠는 각 `.md`(문구 유지)로 PlanPage에 주입.
- **클래스 설계(Stage 4) 계층 구조**: 모듈 그룹 노드가 클래스를 감싸는 parent-child 구조. 모듈 우클릭 → 해당 모듈에 클래스 생성, 상세 모듈 select로 클래스 이동, `NodeResizer`로 모듈 박스 크기 조절. 사양을 `03-design/classes/features.md`에, 전체 UI 매핑을 `03-design/plan-viewer/ui-mapping.md`에 문서화.
- **설계 보강 (목업→workflow-core)**: 뷰어/UI 레이어를 workflow-core에 통합. `ADR-003`(뷰어 아키텍처 — 코어는 산출물 파일만, 뷰어가 렌더; Pi=마크다운+승인 프롬프트 Tier 0, 웹=옵션; 코멘트→'수정 지시'→Design Agent) + `workflow-core/06-viewer-ui.md`(Stage별 산출물 포맷: 1·2·5=MD, 3·4=nodes/edges JSON, 6=매트릭스 + 뷰어 계약 + 코멘트→게이트). M1 Stage Registry 강화 근거 마련.
- **구현 계획 정확화**: `workflow-core/05-implementation-plan.md` 재작성 — 각 태스크를 파일·함수 서브태스크로 분해(state.mjs 함수 시그니처, SKILL Tier 0 규칙, entry 바인딩) + Phase별 검증 게이트 + 뷰어 포맷(`format: document|graph|review`) 반영. Phase 0(스캐폴드+Stage Registry) → Phase 1(Tier 0 스모크 `/factorynote demo`) → Phase 2(pi-crew) → Phase 3(폴리싱) 마일스톤. 이제 구현 진입 가능.

### 왜

- 00-vision/·01-architecture/가 비어있었고, 프로젝트 정체성과 아키텍처를 명문화해야 다음 설계(Workflow Core, 모노레포 스캐폴딩)의 기준이 선다.
- 단계 수를 정확히 6단계로 고정해 향후 산출물 템플릿과 게이트 로직의 기준을 통일.
- Workflow Core를 자체 6단계로 dogfood해 프로토콜(인간 게이트·Design↔Feedback 루프)을 실전 검증.

### 남은 것 / 다음

- Workflow Core 설계 완료(5 산출물 @ `03-design/workflow-core/`). 다음: Phase 0 구현(리포 스캐폴드 + M1 Stage Registry) 착수.
- 모노레포 스캐폴딩.
- 6단계별 산출물 템플릿 추가(`90-meta/templates/`).
- 코드 생긴 뒤 graphify 첫 빌드 후 `graphify-out/` 검증.

## 2026-07-26

### 한 일

- FactoryNote 프로젝트 요구사항(9단계 Human-Gated 워크플로 PI 패키지) 파악 및 프로젝트 메모리 저장.
- graphify 조사: Pi 공식 지원 확인, CLI 0.9.27 + Obsidian 설치됨 확인, Pi 통합 문서 인덱싱.
- graphify 스킬을 PI에 설치(`graphify install --platform pi` → `~/.pi/agent/skills/graphify/`).
- 문서 볼트 구조 설계 및 검증: `vault/` 7영역(vision/architecture/decisions/design/development/problems/research/meta).
- 볼트 스캐폴드 + 핵심 문서 작성: Home, Doc-Conventions, How-To-Update-Docs, ADR 템플릿, ADR-001, Changelog, Dev-Log, graphify 조사 노트.
- 이전 세션 메모리(5개)와 충돌 발견: 디스크는 그린필드(이전 산출물 없음), 메모리만 남아 하이브리드 harness·graphify-out 커밋 등 다른 결정 포함.
- 사용자 검증으로 harness·Git 정책 재확정: 하이브리드(루트 `AGENTS.md` + `.pi/skills/doc-workflow`) + `graphify-out/` 커밋(`cache/`·`cost.json` 제외) → [[ADR-002-hybrid-harness-and-graph-git]].
- 루트 `AGENTS.md` 작성(상시 오리엔테이션), `.gitignore` 정책 변경, 프로젝트 메모리 stale 항목 정리 예정.

### 왜

- AI가 의도 파악 전 코드를 서두르는 문제를 통제하려면 결정·설계·문제를 단계별로 기록하는 체계가 선행되어야 함.
- 문서 규율을 사람 기억이 아닌 harness로 굳혀 갱신 누락을 방지.

### 남은 것 / 다음

- 볼트 영역에 실문서 채우기(00-vision Overview/Goals/Glossary, 01-architecture).
- 모노레포 스캐폴딩 또는 Workflow Core 설계 착수.
- 코드 생긴 뒤 graphify 첫 빌드(`/graphify . --obsidian`) 후 `graphify-out/` 검증(graph.json 크기 모니터, 필요시 `--no-viz`).
- 필요시 설계 산출물·포스트모템 템플릿 추가.
