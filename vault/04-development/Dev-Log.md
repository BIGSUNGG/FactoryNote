---
updated: 2026-08-09
tags: [development, dev-log]
---

# Dev-Log

날짜별 작업 기록. 무엇을 했는지, 왜, 무엇이 남았는지. [[Changelog]]는 외부용 단위, 본 파일은 일일 흐름.

## 2026-08-09

### install.mjs 에이전트 미배포 버그 수정 (Unknown agent 원인)

**증상**: 새 pi 세션에서 `factorynote-design`/`factorynote-feedback-*` 스폰 시 “Unknown agent”. `subagent list` 에 FactoryNote 에이전트 없음.
**원인**: `scripts/install.mjs` 가 (1) `apps/pi-extension/agents/` 를 설치 디렉토리로 복사하지 않고, (2) 배포용 `package.json` 에서 `pi-subagents.agents` 매니페스트를 누락. → 설치된 확장에 에이전트가 발견 안 됨. ADR-014 흐름 전체 차단. 테스트는 소스 검사라 미포횩.
**수정**: 에이전트 디렉토리 복사 + 매니페스트 포함. `bun run build` 후 설치된 확장에 agents/ 33개 + 매니페스트 확인.

### 동적 feedback 에이전트(레지스트리 + Director 선택) 구현 (ADF-014)

**목표**: 이전에 열거한 feedback 검토 축 전부(~32)를 전문 에이전트로 추가 + Director 가 매 사이클 상황에 맞게 추려 병렬 스폰. 정적 단계별 축 세트(ADF-013)에서 동적 선택으로 전환.

**변경**:

- `feedback-agents.ts`(core): `FeedbackAgent` 타입 + `FEEDBACK_AGENTS` 레지스트리(32개: static 24·web 5·graph 3) + `feedbackMenuForStage` + `FEEDBACK_TOOLS`(역량→도구).
- `scripts/gen-feedback-agents.mjs`: 레지스트리 → `factorynote-feedback-<name>.md` 32개 생성(역량별 tools allowlist).
- `types.ts`: `ArtifactPaths.menu` 추가; `spawn-feedback` directive를 menuPath/draftPath/feedbackPath 기반(과제 없이 메뉴 참조)으로 변경.
- `stages.ts`: `feedbackAxes` 제거(레지스트리로 이관).
- `orchestration.ts`: `nextDesignFeedbackStep` spawn-feedback 가 메뉴 참조; `feedbackBatchTasks`/`feedbackAxisTask` → `feedbackAgentTask`; `runDesignFeedbackLoop` 에 `select` 옵션(동기 harness 메뉴 선택).
- `plan-tool.ts`: `buildMenuMarkdown`(현 단계 메뉴 파일 기록) + spawn-feedback 지시문이 Director 동적 선택(runs.all) 지시; `parseFeedbackBatch` [name] 기준.
- `index.ts`: PLAN_MODE_PROMPT 3b 동적 선택 설명로 갱신; `AgentOut`/`promptGuidelines` 정리; gate-server `openBrowser` localhost 가드(방어).
- 제거: 공용 `factorynote-feedback.md`(전문 에이전트로 대체).

**검증**: `bun test` 98 pass/0 fail · `bun run build` exit 0.

**남음**: 모델 티어(강/빠른) 라우팅 · 선택 품질 휴리스틱(메뉴 추천 표시) · 레지스트리 확장 시 생성기 재실행.

### 병렬 Feedback 팬아웃 파이프라인 구현 (ADF-013)

**목표**: design 에이전트 1개 → feedback 다수 병렬 → 수정 1회(조건부) 흐름으로 전환. 속도(직렬 스폰 6→2~3 단위) + 검토 커버리지(축별 깊이) 동시 확보. default 사이클=1, 게이트 “검토 요청” 버튼으로 +1 사이클.

**변경**:

- `types.ts`: `FeedbackAxis`/`FeedbackAxisOutcome` 추가; `DesignFeedbackDirective.spawn-feedback` 를 `tasks:{axis,task}[]` 배치로; `DesignFeedbackReport` feedback 변형을 `outcomes` 집합으로.
- `stages.ts`: `feedbackChecklist:string[]` → `feedbackAxes:FeedbackAxis[]`(3단계 각 3축).
- `orchestration.ts`: `MAX_DESIGN_FEEDBACK_LOOPS=3` → `DEFAULT_MAX_LOOPS=1`(파라미터). `nextDesignFeedbackStep` 병렬 팬아웃 전이 재작성(design v1→병렬 feedback→전 CLEAN 게이트/이슈 수정→수정본 게이트). `feedbackBatchTasks`/`feedbackAxisTask`/`aggregateFeedback`/`parseFeedbackBatch` 헬퍼.
- `gate-server.ts`: `GateEvent {kind:"review-request"}` + `POST /api/review-request` 엔드포인트.
- `plan-tool.ts`: `drivePlan` 병렬 feedback 지시(runs.all)·조건부 revision·review-request 재진입(gateOpen false→preparing→재오픈).
- 뷰어: `GateBar` “🔁 검토 요청” 버튼 + `App` `onReview`(POST /api/review-request → preparing).
- 에이전트: `factorynote-feedback.md`(축 관점 명시)·`factorynote-design.md`(수정 시 전 축 리뷰 통합).
- 테스트 재작성: `orchestration.test.ts`(26개 병렬 팬아웃 전이) + `plan-tool.test.ts`(검토 요청 +1사이클 통합 테스트 포함).

**검증**: `bun test` 99 pass/0 fail · `bun run build` exit 0(tsc -b + viewer + install).

**남음**: 루프 횟수 증가용 런타임 커맨드/설정파일 구현(이번엔 `DEFAULT_MAX_LOOPS` 파라미터 주입점만). 축 구성 단계별 튜닝. 수정 후 2차 검증 패스(품질바 필요 시).

## 2026-08-08

### 자식 스폰 1261 원인 분석 + 도구 allowlist 전환(방향 1·2·3)

#### 현상

- develop 에 오케스트레이션 머지 후 `factorynote` 사용 시 `Error: 400: {"code":"1261","message":"Prompt exceeds max length"}` (GLM-5.2/zai). 머지 전엔 발생 안 함.

#### 원인(분석)

- **모델 = GLM-5.2(zai)**. `1261` = Zhipu API "Prompt too long".
- **`toolBudget.block` 가 도구를 프롬프트에서 빼지 못함** (핵심). `pi-subagents` `tool-budget.ts` 의 `shouldBlockToolForBudget` 은 `nextToolCount > hard` 일 때만 차단하는 **런타임 카운트 게이트** — 도구 스키마는 자식 시스템 프롬프트에 잔류. 게다가 `CHILD_SPAWN_OPTIONS` 가 `block` 만 주고 필수 `hard` 를 주지 않아 예산 자체 무효(검증 실패 → 예산 0 + 도구 전부 보존). [[ADR-010-context-overflow-file-protocol]] 결정 2 의 "고정 세금 절감" 주장과 상충.
- 자식이 context-mode·pi-lens·subagent(스키마 ~120KB README 기반)·mcp·`factorynote_plan` 등 풀 도구 세금을 그대로 지고 스폰 → 1261.

#### 조치(방향 1·2·3 구현; 방향 4=모델 격리는 범위 밖)

- **방향 1(핵심)**: `apps/pi-extension/agents/factorynote-{design,feedback}.md` 명명 에이전트 도입 — `tools: read, write, edit, bash`(design)/`read, write, bash`(feedback) 엄격 allowlist + `systemPromptMode: replace` + `package.json` `pi-subagents.agents` 매니페스트 선언. allowlist 에 없는 도구가 자식 프롬프트에서 물리 제거(진짜 세금 절감). `SpawnOptions` 를 `toolBudgetBlock` → `agentName` + `toolBudget{hard,soft}` + `turnBudget{maxTurns}` 로 재설계(역할별 맵).
- **방향 2**: `toolBudget.hard`(design 20 / feedback 15) + `turnBudget.maxTurns` 부여 → 카운트 상한 실제 발동(과도 호출/턴으로 자식 컨텍스트 팽창 시 종료 유도).
- **방향 3(a+b)**: (a) spawnTask 경로 참조(designPrompt 본문 인라인 無)는 기존 paths 모드 동작 유지 + 회귀 단위테스트. (b) `clampReportInput` 가드 — 자식 보고(경로/판정) 가 >4000자면 첫 줄 보존 후 절단(Director 누적 방어, ADR-010 "후속: LLM 비준수 방어" 이행).
- **단위테스트 3종 추가**(정책 / 3b 가드 / 3a+allowlist). 기존 `toolBudgetBlock` 참조 테스트 3곳 갱신. `bun run typecheck`·`bun test`(93 pass / 0 fail) 그린.
- [[ADR-012-child-tool-allowlist-spawn]] 작성(ADR-010 결정 2 정정).

#### 남은 것

- **라이브 1261 비재현 증명**: 목 단위테스트는 "스폰 정책이 정확"을 증명하지, 실제 GLM-5.2 한도에서 1261 이 안 나는 것을 직접 증명하진 않음(비결정적). 사용자 스모크 필요.
- **방향 4(자식 모델 격리)**: allowlist 로 베이스를 줄인 뒤 남는 마진이 빡빡하면 별도 세팅으로 검토.
- **중복 ADR 번호**(ADR-009·010 각 2건) 정리 별도 과제.

### Windows 빌드 수정 — install 순수 Node 이식 + GraphEditor 복구

#### 현상

- `bun run build` 가 마지막 단계 `bash scripts/install.sh` 에서 즉음: `WSL (31003 - Relay) ERROR: execvpe(/bin/bash) failed: No such file or directory`. Windows 환경에서 `bash` 가 WRL bash 로 해석되는데 WSL 배포판이 없어 `/bin/bash` 를 못 찾는 문제. (에이전트의 bash 툴 PATH=Git Bash 라 통과했지만 사용자 환경에선 WRL.)
- 그 이전 단계에서는 별개 에러: `Could not resolve "./GraphEditor" from src/components/Block.jsx` — viewer 빌드가 `GraphEditor.jsx` 부재로 즉음.

#### 원인

- **GraphEditor 부재**: `Block.jsx` 가 `./GraphEditor` 임포트하지만 파일이 작업 트리에 없었다. `1bc204c`(graph 통합)에서 `GraphStage.jsx → GraphEditor.jsx` rename 으로 생성됐으나, 이후 `490fdb0 Merge feature/graph` 과정에서 트리에서 떨어져 나감(`1bc204c` 는 HEAD 의 조상이지만 HEAD 트리엔 파일 없음). 이 파일은 Stage 2 설계 md 의 ```factorynote-graph 펜스를 인터랙티브 에디터로 렌더하는 핵심 — 없으면 설계 산출물이 게이트에서 빈 칸이 되므로 import 제거가 아닌 복구가 정답.
- **install WSL 에러**: `scripts/install.sh` 가 bash 스크립트인데, 저장소가 이미 `bun` 런타임 + 순수 Node ESM(`bin/factorynote.mjs`) 컨벤션이므로 bash 의존 자체가 불필요.

#### 조치

- `git checkout 1bc204c -- apps/plan-viewer/src/components/GraphEditor.jsx` 로 700행 파일 복구(700행).
- `scripts/install.sh` → `scripts/install.mjs` 이식(`node:fs`/`node:os`/`node:child_process` 만 사용). `rmSync`/`mkdirSync`/`cpSync`/`copyFileSync`/`writeFileSync` 로 install.sh 의 rm/mkdir/cp/cat 작업 1:1 대응. 뷰어 빌드 보장 스텝은 `execSync("bun run build")` + try/catch(실패 시 명확한 에러).
- `package.json` build/deploy: `bash scripts/install.sh` → `bun scripts/install.mjs`.
- 구 `install.sh` 삭제(단일 진실, 드리프트 방지).

#### 검증 / 남음

- `bun run build` 0 종료: tsc -b + viewer 빌드(287 modules) + install.mjs → `C:\Users\DAESUNG\.pi\agent\extensions\factorynote` 정상 배포. Windows/macOS/Linux 공통 동작 확보.
- 문서 동기화: `AGENTS.md`·`scripts/README.md`·`vault/90-meta/{usage-guide,development-guide}.md`·`vault/01-architecture/implementation-architecture.md` 의 `install.sh` 참조 → `install.mjs`로 갱신. 본 Changelog/Dev-Log 항목 추가.
- 남음: 복구한 `GraphEditor.jsx` 와 신규 `install.mjs` 는 아직 커밋 안 됨(`git status` 추적). `develop` 에 커밋해 머지 재유실을 영구 차단해야 함.

## 2026-08-07

### 코멘트 → 실시간 채팅 통합 — SidePanel·"수정 지시" 버튼 폐지

#### 배경

- 사용자 요청: 문서와 채팅 사이 "코멘트를 남긴 위치를 보여주는 라인"(= 우측 `SidePanel` 검토 큐) 제거, 하단 "수정 요청 버튼"(= "✎ 수정 지시") 제거, 코멘트를 남기면 기존 실시간 채팅으로 즉시 에이전트에게 전달 + 채팅창에 내 코멘트가 채팅처럼 표시. 요약 = "기존 코멘트 기능을 실시간 채팅으로 넘김".
- 기준: `bc674f6`(Feature 1 채팅 사이드바가 들어간 커밋). 본 워크트리 HEAD(`4e63738`)가 1커밋 뒤처져 `git checkout bc674f6 -- apps packages vault AGENTS.md package.json` 로 코드만 가져옴(`.pi-glla` 세션/골 상태는 보존).

#### 조치

- `PlanPage.jsx`: `SidePanel` import·렌더 + `loop`/`feedbackIssues` 목 데이터 제거. `addComment` 가 로컬(인라인 💬 표시용) 추가와 동시에 `POST /api/chat`{text, blockId} 즉시 전송하도록 변경 — 블록/셀/영역 세 entry point 가 한 함수를 통해 일괄 채팅 전달(근본 지점 1곳). `applyComments`/`pendingCount`/`toGateComment`/`sendModify` 및 `applied` 필드 제거.
- `DesignStage.jsx`: 그래프 코멘트 `addComment` 도 동일하게 `POST /api/chat`(blockId=ckey) 즉시 전송. `submit` 에서 `withComments`/modify 코멘트 적재 제거, `pendingTotal` 제거.
- `GateBar.jsx`(공용): "✎ 수정 지시" 버튼 + `onModify`/`pendingCount` prop 제거. "✓ 확정"·"← 정정" 유지.
- `SidePanel.jsx` 삭제(미사용). 신규 [[ADR-011-comment-to-chat-consolidation]].

#### 검증 / 남음

- 계약 7항 전부 PASS: `SidePanel` 잔존 0, `수정 지시`/`onModify`/`sendModify` 잔존 0, 확정·정정 유지, `/api/chat` POST 가 양 코멘트면에 존재.
- `bun run typecheck`(tsc -b) 0, `bun run build:viewer` 0, `bun test` 68 pass / 0 fail.
- 남음: 백엔드 modify-verdict 엔진 경로는 UI 트리거 소멸 상태로 잔존(필요시 복원). Design↔Feedback 루프 표시(라운드/이슈)가 뷰어에서 사라졌으므로, 필요시 채팅 헤더 등으로 재노출.

#### 후속 수정 — 범위 코멘트 인용(quote) 누락

- 사용자 질의 "범위 코멘트가 에이전트에 해당 범위인지 전달되나?" 로 확인한 누락: 채팅 통합 시 `addComment` 가 `quote` 파라미터를 받고도 `POST /api/chat` body 에 안 넣어, 에이전트는 블록은 알아도 드래그한 정확 텍스트(인용)를 몰랐다(이전 `formatComments` 경로엔 있었다).
- 5곳 전면 수정: `ChatMessage.quote?` 타입 · `gate-server` `/api/chat` 파싱·저정 · `PlanPage` `addComment` body 전송 · `plan-tool` `formatChat` `(인용: "…")` 렌더 · `ChatSidebar` 말풍선 인용 표시(`.chat-quote` CSS, 기존 quote 그룹 선택자 재사용). gate-server 테스트에 quote 왕복 검증 추가.
- 검증: `tsc -b` 0, `bun test` 0 fail(quote 왕복 포함), `bun run build` 0(배포). 배포 확장(gate-server·plan-tool·core types)·뷰어 dist 모두 quote 처리 포함 확인.

#### 후속 수정 — 여러 블록에 걸친 범위 코멘트

- 사용자 질의 "여러 블록 선택 코멘트도 정상 동작?" 로 확인. 두 제약: (1) `range.surroundContents()` 가 여러 블록/노드에 걸친 범위에서 `InvalidStateError` 를 던져 하이라이트가 스킵됨(코드 주석도 “다중 노드 범위 — 하이라이트 생략” 명시). (2) `Document.handleMouseUp` 가 `sel.anchorNode` 의 블록 하나만 잡아, b2→b4 드래그해도 `[블록 b2]` 만 갔음.
- (1) `highlightRange(range, cls)` 헬퍼 추가 — `commonAncestorContainer` 아래 `TreeWalker(SHOW_TEXT)` 로 범위 교차 텍스트 노드를 순회하며 `splitText` 로 범위 내 구간만 `<mark>` 로 교체. 단일/멀티 노드 모두 안전. (2) `Document` 에 `mainRef` 를 두고 `range.intersectsNode` 로 `[data-block-id]` 전체 중 선택이 걸친 블록을 수집 → `blockIds[]`. `PlanPage.addComment` 가 다중이면 쉼표 결합(`b2,b3,b4`)으로 `blockId` 스코프 전달(로컬 인라인 표시는 시작 블록). 팝오버 헤더도 전체 범위 표시.
- 검증: `tsc -b` 0, `bun test` 0 fail, `bun run build` 0(배포). 배포 번들에 `intersectsNode`/`highlightRange` 존재·`surroundContents` 부재 확인.

### 사용자 보고 버그 2건 수정 — 에이전트 채팅 미동작 · Stage 2 그래프 안 보임

#### 현상

- 사용자 보고: (1) 계획 페이지 에이전트 채팅 섹션에 코멘트를 남겨도 동작 안 함. (2) Stage 2(2페이지)에서 모듈·클래스 그래프가 안 보임.

#### 원인

- **Bug 1(채팅)**: F1 워커가 `plan-tool.ts` 에 채팅 루프(`chatPending`/`chatResponse`)를 구현했으나, **실제 pi 도구 등록층(`apps/pi-extension/src/index.ts`)에 연결이 누락** — 도구 parameters 에 `chatResponse` 없음·`execute` 미전달·`formatForAgent` 가 `chatPending` 삼킴 → 에이전트가 사용자 채팅을 전혀 못 받음.
- **Bug 2(그래프) 근본**: 코드 수정이 **설치 확장(`~/.pi/agent/extensions/factorynote`)에 배포되지 않아** 사용자가 구버전을 쓰고 있었다. pi 는 설치 확장을 로드하고 게이트도 설치 viewer dist 를 서빙(env → `<extDir>/viewer/dist` → dev 순서) → 소스만 고친 6회 반복이 무효. 추가로 `designMd.js` 파서가 에이전트 출력 편차(후행쉼표·비 `factorynote-graph` 펜스·bare 섹션)에 취약.

#### 조치

- `index.ts`: `chatResponse` 파라미터 + `execute`→`drivePlan` 전달 + `AgentOut.chatPending`/`formatForAgent` 노출 + `PLAN_MODE_PROMPT` 채팅 지시(f).
- `designMd.js`: `sanitizeJson`(후행쉼표·`//` 주석 제거) + 비 factorynote-graph 펜스 fallback(`ANY_FENCE_RE`) + **bare 섹션 객체**(sections 래퍼 누락) 수용. `designMd.test.js` 8건(왕복·무경화·fallback·bare 섹션·designPrompt bare-노드 렌더 계약).
- `DesignStage.jsx`: 구조 미검색 시 원인 특정 진단 배너(mermaid/```json/no-fence 분류) + 산출물 미리보기(접기식).
- **배포 동기화**: `install.sh` 재배포 → `diff -rq packages/factorynote/src ↔ 설치 core` 빈 결과로 전 컴포넌트 byte-identical 확인(index.ts·plan-tool·gate-server·core·viewer dist).
- **재발 방지**: `bun run build` = `tsc -b` + viewer 빌드 + `install.sh` 배포 자동화(루트 package.json `build`/`build:viewer`/`deploy`/`typecheck`). AGENTS.md 빌드 설명 갱신. — 미배포(근본 원인) 재발 차단.

#### 검증 / 남음

- `bun test` 68 pass / 0 fail(신규 designMd 8). `bun run build` 0 종료(빌드=배포). 설치 확장 = 소스 동기화 확정.
- 런타임 증명: designPrompt 그대로의 bare 노드 md 가 `parse→normalize` 를 거쳐 react-flow 렌더 가능 노드로 정규화됨(dmtest2 진단).
- **남음(사용자 경험적 1회 확인)**: pi 세션 재시작 후 `/factorynote` → Stage 1 채팅 동작·Stage 2 그래프(또는 진단 배너) 확인.

### 3단계 산출물·렌더링 통일 — md + 내장 그래프

#### 현상

- Stage 2(설계)에서는 그래프가 정상 출력되지만 **그래프를 제외한 나머지 텍스트가 Stage 1·3과 다르게** 출력됨. 원인: Stage 2만 `format:"nodes-edges"` 로 `.json` 산출물을 `GraphStage.jsx` 가 단독 렌더(그래프 섹션만 있고 md 서사 없음), 1·3은 `PlanPage.jsx`(`mdToBlocks`) 로 렌더 — **두 개의 다른 렌더링 경로**.

#### 한 일

- 산출물 모델 통일: 3단계 모두 단일 `.md`. 그래프는 md 내 ` ```factorynote-graph ` 펜스로 `{sections:[...]}` JSON 내장.
  - `packages/factorynote/src/stages.ts`: 3단계 모두 `format:"markdown"`, Stage 2 `artifactFile` `02-design.json`→`02-design.md`. Stage 2 designPrompt 재작성(모듈 관계도 + 클래스 구조도 펜스 **적극** 내장, 필수); Stage 1·3은 펜스 사용법 안내(선택).
  - `types.ts`: `ArtifactFormat` → `"markdown"` 단일; `GateDecision` 의 `graphSections` 제거 → `md?: string` 추가(사용자 편집 전체 md 채택).
- 뷰어 단일 렌더링 경로:
  - `App.jsx`: `isGraph = state.stage === 2` 하드코딩 라우팅 제거 → 항상 `PlanPage`.
  - `GraphStage.jsx` → `GraphEditor.jsx` 추출·재명명: 페이지 크롬(Topbar/Stepper/GateBar)·게이트 제출·내부 코멘트 시스템 제거, 캔버스+다중섹션+CRUD+상세패넄만 남김. `sections` 변경 시 `onChange(serializedSections)` 로 상위 통지(최초 마운트 정규화는 제외 — 사용자 편집만 dirty).
  - `PlanPage.jsx` + `Document.jsx` + `Block.jsx`: `type:"graph"` 블록을 `<GraphEditor>` 인라인 렌더. 그래프 편집은 `graphEdits` 맵에 저장, 제출 시 `replaceGraphFence` 로 해당 펜스만 갱신한 전체 md 를 `decision.md` 로 POST. 캔버스 조작은 `stopPropagation`(상위 블록 코멘트 핸들러와 분리), 헤더 영역만 블록 코멘트 활성화(텍스트 블록과 동일 방식).
- 왕복 직렬화(`mdToBlocks.js`): `factorynote-graph` 펜스 → `{type:"graph", fenceIndex, sections}` 블록; 신규 `replaceGraphFence(md, fenceIndex, json)` — N번째 펜스 내용만 교체, 나머지 md 바이트 불변.
- 게이트/도구 md 단일화: `gate-server.ts`(그래프 `.json`→`graphSections` 서빙 분기 제거, md 만 서빙, `decision.md` passthrough), `plan-tool.ts`(`graphStage`/`nextGraph` 분기·`graphSections` 채택 제거 → `decision.md` 채택 저장, 메시지 md 통일).
- 테스트: 구 그래프 JSON 테스트(engine invalidate의 `02-design.json`, gate-server graphSections serving, plan-tool graph adoption) md 모델로 갱신; 신규 `mdToBlocks.test.js`(펜스 인식 + 왕복 idempotent 5건). 총 57건 green.

#### 왜

- 사용자 요구: (1) 1·2·3 단계가 같은 방식으로 문자·그래프를 출력, (2) 모든 단계가 기존처럼 md 를 내면서 2단계처럼 클래스·모듈 그래프도 출력 가능, (3) 2단계는 적극적으로 모듈·클래스 그래프를 내장. 두 렌더링 경로를 하나로 통합하고 산출물 포맷을 md 하나로 좁혀 세 요구를 한 번에 해결. 그래프는 문서의 일부(펜스)가 되어 서사와 함께 같은 경로로 렌더.

#### 결정·근거

- 저장 구조 선택(그릴 때 사용자 확인): **단일 md 에 그래프 내장**(별도 `.json` 사이드카 대신). 파일 1개, 서사·그래프가 한 문서 흐름. 왕복은 펜스 내용만 교체해 md 바이트를 보존 → 서사 포맷 손상 없음.
- 그래프 범위: **Stage 2 필수 / 1·3 선택**(사용자 확인).
- 범위 밖: 기존 `02-design.json` 레거시 산출물 마이그레이션(신규 실행 기준), react-flow 그래프 렌더링 자체 동작 변경, 엔진 규칙(회귀/에스컬레이션/타임아웃) 변경 — 없음.

#### 남은 것

- 그래프 블록의 코멘트는 현재 블록 단위(그래프 전체). 노드/엣지 단위 코멘트는 `GraphEditor` 추출 시 제거됨 — 필요시 블록 코멘트 인용(quote)으로 보완 가능.
- 사용자가 그래프를 편집한 뒤 modify 시 에이전트가 md 를 재작성하는데, 이때 편집된 그래프 펜스를 보존하도록 메시지로 안내 중(정책) — 정합성 강제는 추후 과제.

### auto-advance 모드 — 게이트 자동 승인 명령 추가

#### 현상

- 3단계 게이트가 매 단계 사용자의 수동 승인을 요구. 빠른 프로토타입/데모/개발 시 매번 클릭하는 게 번거로움. 사용자 요구: “사용자 확인 없이 자동으로 다음 단계로”.

#### 한 일

- `gate-server.ts`: 신규 `observeGate(opts)` export — 영속 게이트 서버 확보 + 브라우저 오픈(필요 시)만 하고 결정을 기다리지 않는 관찰용 오픈. `runGate` 의 오픈 로직(getOrCreateGate + 하트비트 기반 브라우저 오픈)과 동일 조건이되 블로킹 `decided` 대기 없음.
- `plan-tool.ts`: `DrivePlanInput.autoAdvance?: boolean` 추가. `runOpenGate` 에서 auto 면 `observeGate` 호출 후 `{ verdict: "confirm", comments: [] }` 즉시 적용, 아니면 기존 `runGate` 블로킹 대기. resume 경로 포함 모든 단계에 동일 적용.
- `index.ts`: `let autoAdvance = false`(planMode 와 동일 세션 메모리). `/factorynote auto [on|off]` 서브커맨드 파싱(공백 split). `autoLine()` 경고 notify(ON 시 ⚠ 게이트 우회 안내). `factorynote_plan` execute 에 `autoAdvance` 전달. `done` 시 `autoAdvance=false` 자동 해제(#5, planMode 와 함께).
- 테스트: `plan-tool.test.ts` “auto-advance bypasses gate” — `onReady` 가 결정을 POST 하지 않음에도 `drivePlan`이 43ms 만에 `confirm` 으로 stage 1→2 전이 + 산출물 저장(블로킹 없음 증명). 총 53건 green.
- 문서: [[Changelog]] Added, [[usage-guide]] auto 탈출구 한 줄.

#### 왜

- “게이트를 건너뛰되 진행은 보고 싶다” — 순수 자동(브라우저도 안 옴)이 아닌 **우회 + 브라우저 관찰** 선택. 산출물이 이상하면 에이전트 중단으로 개입 가능. 5대 원칙을 의도적 우회하는 탈출구이므로 기본 OFF + 경고 notify로 안전장치.

#### 남은 것

- auto 를 영구 기능으로 다룰지(ADR)는 후속 — 현재는 개발/데모용 탈출구로 명시.
- 영속 저장(세션 간 유지)은 범위 외 — planMode 와 동일 세션 메모리.

### 오케스트레이션 컨텍스트 한도(1261) 해소 — 파일 경로 프로토콜 + 자식 스폰 제약

#### 배경

- 오케스트레이션 도중 `Error: 400: {"code":"1261","message":"Prompt exceeds max length"}`. `PI_MODEL=glm-5.2`(Z.AI/Zhipu, 기본 202K; 1M 은 `glm-5.2[1m]` opt-in). 1261 = "Prompt too long".
- 누적 원천 추적: (1) Director(영구) 가 designPrompt/draft/feedback 본문을 인라인으로 매 루프 누적 — **주벅**, (2) 자식 도구/스킬 고정 세금(~50–75KB), (3) fork 상속, (4) 자식 vault 문서 읽기. Director 가 루프 내내 살아있어 (1) 레버리지 최대.

#### 결정(사용자 확정)

- 시행: **구조화** — core 지시문이 스폰 옵션을 전달(soft 프롬프트 아님).
- 범위: ⑤⑥ **풀버전** — designPrompt(불변)·Feedback 상세리뷰까지 파일화.
- 검증: 코어 단위테스트 + build/test green(에러가 간헐적이라 '절대 안 남' 직접 증명 대신 구조 증명).

#### 한 일

- 코어 `types.ts`: `SpawnOptions`·`ArtifactPaths` 타입; spawn 지시문에 `spawnOptions` 필드(필수).
- 코어 `orchestration.ts`: `CHILD_SPAWN_OPTIONS` 상수; `nextDesignFeedbackStep(..., paths?)` 옵셔널 paths — pi 경로는 파일 프로토콜(task 가 파일 경로 참조·본문 無), 동기 목 루프는 inline(기존 호환). `designTask`/`feedbackTask`/`designRevisionTask` 가 paths 분기. 게이트 artifact 는 paths 모드에서 draft 경로(어댑터가 resolve).
- 어댑터 `plan-tool.ts`: `resolvePaths(root,feature,def)` 로 designPrompt/draft/feedback 경로 계산; designPrompt(불변) 파일 기록; `nextDesignFeedbackStep` 에 paths 주입; 게이트 직전 `readArtifact(draftFile)` 로 경로→내용 resolve. `DrivePlanOutput`·`AgentOut` 에 `spawnOptions`·`draftPath`·`feedbackPath`.
- 어댑터 `index.ts`: `PLAN_MODE_PROMPT` 를 파일 프로토콜로 재작성(Director 가 스폰 옵션 필수 적용·자식은 파일에 쓰고 경로/판정만 보고·본문 전달 금지).
- 검증: **71건 green**(orchestration paths·spawnOptions 5건 + drivePlan 파일 프로토콜 종단간). `bun run build`(tsc -b)/`bun test` 0 종료. lens 진단 에러 0.

#### 왜 / 트레이드오프

- 영구 에이전트(Director) 를 직격 — 파일 경로화로 인라인 본문 순환을 끊어 컨텍스트 평탄화. (2)·(3) 은 같은 `subagent` 옵션 1줄로 가성비 잡힘.
- core 정책 소유 → `orchestration.test.ts` 가 role 별 옵션·경로 참조를 결정론적 검증("신뢰성은 코드"). core harness-agnostic 유지(파일 I/O 無, 경로는 데이터 주입).
- 한계: LLM 비준수 시 Director 가 여전히 본문 흘릴 수 있음(프롬프트 강제이나 하드 보장 아님) — 후속 과제.

#### 남음

- 라이브 e2e 런 증거(1261 재현 안 됨 확인) — 목 테스트는 구조 증명이지 라이브 GLM 한도 증명 아님.
- LLM 비준수 방어(자식 반환에 본문 섞이면 Director 가 거부) 옵션.

### Tier 1 에이전트 오케스트레이션 구현 (Tier 0·NFR-7 폐지)

#### 배경

- 사용자 요구: "단일 에이전트가 계획하도록 하지 말고 FactoryNote 자체 기능으로 에이전트 오케스트레이션이 동작". vault([[multi-agent-pipeline]]·M4)는 Director/Design/Feedback 모델을 정의하나, MVP([[ADR-005-mvp-implementation]])는 Tier 0(단일 에이전트 인라인 자기검토)로 출하 — 자기검토는 독립 검토가 아니다.

#### 핵심 제약 발견

- pi SDK 조사(`ExtensionAPI`/`ExtensionContext` — execute 의 ctx): 스폰/서브에이전트 API 없음. `subagent` 도구는 에이전트 전용 → 확장 코드가 동기 스폰 불가. 그러므로 Tier 1 은 **에이전트 매개**로 실현(`factorynote_plan` 이 단계 지시문 반환 → Director 가 `subagent` 도구로 스폰·보고). 이 제약이 설계를 강제했고, 사용자가 확정한 목표("Director 에이전트가 스폰")와 정합.

#### 한 일

- 코어 `orchestration.ts`(신규): `AgentSpawn` 계약 + 순수 전이 `nextDesignFeedbackStep` + 동기 루프 `runDesignFeedbackLoop(spawn)`. 내부 루프 상한(`MAX_DESIGN_FEEDBACK_LOOPS`=3) + FR-2 에스컬레이션(잔존 이슈 노출). `types.ts`/`engine.ts`/`persistence.ts`: `dfPhase`/`dfLoop` 추가 + 구 state.json 마이그레이션.
- 어댑터 `plan-tool.ts`: `drivePlan` 을 오케스트레이션 단계 드라이버로 재작성(spawn-design/spawn-feedback/gate 지시문 relay). `index.ts`: `PLAN_MODE_PROMPT` Tier 1 절차 재작성 + 파라미터 `designArtifact`/`feedbackResult`.
- 검증: orchestration 전이 12건(목 AgentSpawn 으로 spawn→루프→상한→에스컬레이션→게이트) + drivePlan Tier 1 종단간 갱신 → **65건 green, build 0**.
- 문서: [[ADR-009-tier-1-agent-orchestration]] 신규, [[ADR-005-mvp-implementation]] 결정 #4·NFR-7 폐기 표시, Changelog, `packages/factorynote/orchestrator/README.md` Tier 1 runbook.

#### 왜 / 트레이드오프

- **신뢰성은 코드**(Hybrid): 루프 전이·상한·에스컬레이션을 결정론적 코드에 두어 목 단위테스트로 게이트. pi 경로도 같은 `nextDesignFeedbackStep` 공유 → 테스트가 실동작을 게이트(비결정론적 라이브 스폰 없이 증명).
- NFR-7 폐지: 서브에이전트 스폰 불가 환경에선 동작 안 함(ADR-009 트레이드오프).
- Stage 당 `factorynote_plan` 호출 수 증가(스폰·보고 단계마다) — plan 모드 다중턴 특성상 수용.

#### 남음

- 라이브 end-to-end 런 증거(트랜스크립트 캡처) — 본 ADR 범위 밖(목 테스트가 하드 게이트).
- Codex/Claude 어댑터(동기 스폰 가능 시 `runDesignFeedbackLoop` 에 `AgentSpawn` 구현 직접 주입).

## 2026-08-06

### 실시간 채팅 · md 설계 · 프롬프트 품질 (Feature 1·2·3)

#### 한 일

- **F1(실시간 채팅 사이드바)**: `runGate` 반환을 `GateEvent({kind:decision|chat})` 유니온으로 변경. `POST /api/chat`(사용자 메시지)·`GET /api/chat`(뷰어 폴링)·`appendAgentChat`(에이전트 답변). `drivePlan`/`runOpenGate` 가 `chat` 이벤트 시 `chatPending` 반환 → 에이전트 재호출(`chatResponse`+선택 `artifactMd`)로 게이트 유지 재진입. **채팅 수정은 `loopCount` 미포함**(사전 다듬기). 부분 코멘트는 `blockId` 단위(PlanPage 가 선택 블록을 상위로 lift). 우측 `ChatSidebar.jsx`. [[ADR-009-realtime-chat-loop]].
- **F2(Stage 2 md 단일진실)**: Stage 2 산출물을 `02-design.md`(markdown)로 전환. `## 구조` 의 ```factorynote-graph 펜스(JSON)에서 그래프 파생 + 하단 `## 아키텍처 설명` prose. 역동기화(`applyStructureToMarkdown`)로 시각 편집 → md 반영. 게이트 제출 `decision.artifactMd` 채택. `ArtifactFormat="markdown"` 단일화, `graphSections`→`artifactMd`. `GraphStage.jsx`→`DesignStage.jsx` 교체. [[ADR-010-md-design-stage]].
- **F3(프롬프트 품질)**: `stages.ts` Stage 1(미래 확장 포인트·확장성/유지보수성 참고 명시)·Stage 2(객체지향 적합성·불필요 관계/모듈/클래스 검증) designPrompt/feedbackChecklist 갱신(엔진 로직 변경 없음).

#### 검증

- `bun run build`(tsc -b) exit 0. `bun test` **60 pass / 0 fail**(기존 49 + F1 채팅 루프 6 + F2 md 왕복·채택 갱신 5). `apps/plan-viewer` vite 빌드 exit 0(287 모듈).
- 단위 테스트로 보증: 게이트 `/api/chat`·runGate 채팅→결정 경쟁·chat 왕복(loopCount 0 유지); md 파싱/직렬화/역동기화 왕복 일관성; Stage 2 `artifactMd` 채택 경로.

#### 남은 것 / 수동 검증

- **수동 게이트 흐름**(단위 테스트가 못 담는 브라우저 UI 종단): (a) `/factorynote` ON → Stage 1 게이트 → ChatSidebar 에서 질문→에이전트 답변, 블록 수정 요청→산출물 실시간 갱신(게이트 유지) 후 confirm; (b) Stage 2 md 산출물→그래프+설명 렌더, 노드 편집→md 역동기화 확인; (c) Stage 1/2 designPrompt 확장성·OOP 항목이 산출물에 반영되는지. — pi 세션에서 실구동 후 확인 예정.
- 작업 분할: Orca(codex 미설치·claude 온보딩 블록) → pi 서브에이전트 `worker`(fresh 컨텍스트) F1·F2 순차, F3 는 코디네이터 직접 적용.

### 하트비트 기반 브라우저 재오픈 (고착 browserOpened 플래그 교체)

#### 현상

- 첫 단계에서 웹 페이지가 열리지 않는다는 보고. 재현/조사 결과: `start "" url` 자체는 정상 작동(서버 hit 확인), fresh 게이트에서 오픈 로직도 정상 호출됨. 원인은 영속 게이트의 `browserOpened` 플래그가 한 번 true 가 되면 영구 고착되어, 같은 feature 재시도/재개/탭 닫힘 시 재오픈이 막힘.

#### 한 일

- `gate-server.ts`: `browserOpened`/`openCount` 제거 → `lastSeen`(마지막 뷰어 요청 시각) 하트비트로 교체. `runGate` 오픈 조건 = `open && now - lastSeen > BROWSER_REOPEN_AFTER_MS(5s)`. 핸들러는 모든 요청에서 `lastSeen` 갱신. `reopenAfterMs` 옵션(테스트용) 추가.
- `App.jsx`: 폴링을 preparing 전용에서 항상(2s, closed 제외)으로 변경 → 상태 동기화 + 탭 생존 하트비트 동시 수행.
- 테스트: "탭 살아있으면 비재오픈" + "탭 닫힘(하트비트 경과) 시 재오픈" 2건(총 52건 green).
- 문서 갱신: implementation-architecture gate-server 불릿, Changelog.

#### 왜

- 사용자 요구: 첫 단계에서 페이지가 열려야 함. 고착 플래그가 재오픈을 막아 실패. 하트비트로 “탭이 살아있으면 한 탭 유지, 없으면 다시 연다”를 모두 만족(다중 탭 방지 + 재오픈 보장).

#### 남은 것

- 게이트 리뷰 중(블로킹) 탭을 닫은 경우: 결정 안 오면 30min 타임아웃 후 modify 복귀 → 다음 게이트에서 재오픈(자가 치유). 즉시 복구 원하면 타임아웃 단축 고려.

### 영속 게이트 서버 — 단계마다 탭·포트 바뀌는 문제 수정

#### 한 일

- `gate-server.ts`: `runGate` 를 단계마다 `createServer`→`listen(0)`→`openBrowser`→`close` 하던 모델에서 **기능별 영속 서버**(`getOrCreateGate` Map 캐싱)로 전환. 같은 기능은 항상 같은 포트/URL. 결정 후 서버 유지, `closeGate` 로 완료 시만 종료. 브라우저 오픈 1회 가드(`browserOpened`).
- `ViewerState` + `/api/state` 에 `gateOpen`(이미 엔진에 있던 필드) 추가.
- `plan-tool.ts`: `done` 시 `closeGate`.
- `App.jsx`: `gateOpen` 구동 폴링 상태머신. 결정 후 "준비 중" 폴링 → 다음 단계 ready 시 같은 탭 교체 + Notification/타이틀 점멸/포커스 알림. 마감 화면은 done/서버 종료시만.
- `onReady` async 대기로 테스트 레이스 수정(30ms flush 제거 후 발생).
- 테스트 2건 추가(연속 게이트 동일 포트 재사용, 오픈 1회). 51건 green.

#### 왜

- 단계 전환마다 포트가 바뀌고 새 탭이 열려 사용자가 매번 페이지를 다시 봐야 했음. "페이지를 유지한 채 다음 단계가 준비되면 같은 탭에서 보고 싶다"는 요구. 영속 서버 + 폴링으로 하나의 탭이 플랜 전체를 따라가게 함.

#### 남은 것

- 중단 후 미이행 플랜의 서버는 완료 전까지 포트를 점유(`ponytail:` 주석). 프로세스 종료로 정리. 빈도 높아지면 LRU/유휴 종료 고려.
- pi 재시작 후 영속 서버 재연결은 범위 밖(기존 인터럽트 복구 경로가 새 서버로 재오픈).

### 뷰어 이동 — prototypes/plan-page-mockup → apps/plan-viewer

뷰어(게이트 UI)가 목업 폴더(`prototypes/`)에 있었으나 이제 production 코드이므로 `apps/plan-viewer`로 이동.

#### 한 일

- `prototypes/plan-page-mockup` → `apps/plan-viewer` 이동 + 패키지명 `plan-page-mockup`→`plan-viewer`. 루트 워크스페이스(`apps/*`) 멤버가 되어 의존성 hoist.
- 경로 참조 갱신: `resolveViewerDistDir`(`index.ts`)·게이트/drivePlan 테스트 `VIEWER_DIST`·`ensure-viewer-dist.ts`·`install.sh` 모두 `apps/plan-viewer`로.
- `prototypes/` 제거: 초기 HTML 시안 3개 삭제(React 뷰어에 계승, git 복구 가능).
- 활성 문서 경로 일괄 갱신 + README 배포 산출물 라인·6단계 잔류 정정.

#### 왜

- 목업이 아닌 정식 게이트 UI가 `prototypes/plan-page-mockup`에 있는 것이 오해를 유발.
- `apps/*` 워크스페이스 멤버로 두어 의존성 hoist + 빌드 파이프라인 일원화.

#### 남은 것

- `03-design/*` 스펙은 사전 병합(3단계) 설계 기록으로 일부 컴포넌트 참조가 부실(ModuleDesign/Classes.jsx 등은 GraphStage로 병합됨) — 별도 정리 필요 시 후속.

### 6단계 파이프라인 → 3단계 통합

사용자 요청으로 계획 파이프라인을 6단계에서 3단계로 재구성. [[ADR-008-3-stage-pipeline]]. [[Changelog]] [Unreleased] 3단계 통합 항목 참고.

#### 한 일

- **엔진 코어**: `StageId=1|2|3`, `ValidThrough=0..3`, `ArtifactFormat`에서 `matrix` 제거, `STAGES` 3개로 재정의(병합 designPrompt/체크리스트), `engine.ts` done=Stage 3 confirm, `persistence.ts` stage 상한 3.
- **그래프 병합의 핵심**: 종류 판별을 스테이지(`stage===4`)에서 **노드 타입 per-section 추론**으로 이동. `graphNormalize.js`에 `sectionIsClass` 추가 → 한 페이지에 모듈 섹션·클래스 섹션이 공존. 기존 정규화 테스트 케이스도 동일 결과(규칙이 노드 의미를 그대로 존중).
- **뷰어**: 죽은 목업 5종 삭제(어디서도 import 안 됨 — 삭제가 최소비용), `GraphStage`의 `isClass`를 활성 섹션에서 파생, `App.jsx`/`PlanPage`/`GateBar`/`Stepper` 3단계화, dist 재빌드.
- **문서**: ADR-008 신규 + 5대원칙(AGENTS/identity)·파이프라인·정체성·구현아키텍처·Home·ui-mapping 갱신.
- 테스트 49건 green(`bun run build`·`bun test` 0 종료). 엔진·게이트·drivePlan 종단 테스트 전부 새 파일명/단계에 맞춰 갱신.
- **테스트 재현성**: 게이트 테스트가 gitignore된 뷰어 `dist`에 하드 의존해, dist 없는 환경(신규 클론/샌드박스)에서 `bun test`가 실패하던 문제 수정 — `ensure-viewer-dist.ts` preload(`bunfig.toml`)가 dist 부재 시 자동 빌드.

#### 왜

- 게이트 6회는 과다 — 요구↔시나리오, 모듈↔클래스는 같은 맥락이라 한 번에 보는 편이 자연스럽다.
- Stage 6 정합 게이트는 순차 승인이 이미 각 산출물을 검토하므로 한계 효용 < 게이트 비용.

#### 남은 것

- `03-design/module-design`·`classes`·`workflow-core` 사양은 사전 병합 6단계 설계 기록으로 남음(현행은 ADR-008). 필요 시 별도 goal로 정리.
- 병합으로 Stage 1·2 내 세분 회귀 불가(예: "모듈만 다시" → Stage 2 전체 재검토). 회귀는 Stage 1/2 단위로 동작.

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
