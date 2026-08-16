---
updated: 2026-08-15
tags: [development, dev-log]
---

# Dev-Log

날짜별 작업 기록. 무엇을 했는지, 왜, 무엇이 남았는지. [[Changelog]]는 외부용 단위, 본 파일은 일일 흐름.

## 2026-08-16

### df-transition 케이스 핸들러 분리 — 경고 0

**맥락**: 하드닝 루프 이터레이션 12. 백로그 df-transition.ts(nextDesignFeedbackStep 복잡도 27·long-param).

**작업**: 공개 시그니처 유지한 채 내부 3층 분리 — 디스패처 + 케이스별 핸들러 3개 + 지시문 생성자 3개(gate/spawnDesign/spawnFeedback). 반복 객체 리터럴 8건 통일.

**검증**: pi-lens full df-transition 0건 · `bun test` 200 pass(전이 케이스 전부 무변경 통과) · `bun run build` 0 종료.

### graph.ts async 스타일 통일 — 모듈 경고 0

**맥락**: 하드닝 루프 이터레이션 11. 백로그 graph.ts mixed-async 4건 — 실측 결과 잔여 혼용은 `await readRel(x).catch(()=>null)` 2개 호출점.

**작업**: 모듈 헬퍼 `readOrNull()`(try/catch)로 교체 — 누락/IO 실패 null 처리 정책 단일화. delete 제거(이터레이션 10)에 이어 graph.ts pi-lens 경고 0 달성.

**검증**: pi-lens full graph.ts 0건 · `bun test` 200 pass · `bun run build` 0 종료.

### graph.ts delete 제거 — coerceNode rest 분해

**맥락**: 하드닝 루프 이터레이션 10. 백로그 graph.ts delete-연산자 2건.

**작업**: `{...o}` 스프레드 + `delete out.refs/children` 후처리 → rest 분해로 원시 키를 미리 제외하는 구성. 검증된 값만 담는다는 의도가 구조로 표현됨. 동작 불변(불투명 필드 보존·refs/children 검증 테스트 전부 통과).

**검증**: graph.ts `delete` 잔여 0 · `bun test` 200 pass · `bun run build` 0 종료.

### runOpenGate 메시지 조립 추출 — plan-gate 경고 0

**맥락**: 하드닝 루프 이터레이션 9. 백로그 plan-gate.ts(runOpenGate 복잡도 22·fan-out 24·STAGES[2]! 단언).

**작업**: 결과 메시지 4분기 합성을 순수 `gateOutcomeMessage()` 로 추출, `STAGES[2]!` → `stageById(3)` 로 단언 제거. 직전 이터레이션 커밋 후 포매터가 재정렬한 plan-tool.ts 잔여 8줄 승차 커밋.

**검증**: pi-lens full plan-gate 경고 0 · `bun test` 200 pass · `bun run build` 0 종료.

### drivePlan 그래프 강제 추출 — plan-tool 복잡도 경고 소멸

**맥락**: 하드닝 루프 이터레이션 8. 백로그 plan-tool.ts 항목(drivePlan 복잡도 23·no-return-await 4).

**작업**: Stage 2 그래프 강제 블록(반려 스폰·에스컬레이션)을 `enforceRequiredGraph()` 로 추출 — drivePlan 은 재개/재작성/라우팅/추락 4역할만 남음. `return await` 4건은 try/catch 밖 확인 후 제거(의미 동일). 편집 도중 콘텐츠 드리프트로 부분 적용 1회 — 재독 후 수습. 중간 조사: viewer-state.ts 은 lcov 실측 라인 100% (표의 80%는 함수 커버리지·콜백 카운트) → 백로그에서 제외(추격은 화장술).

**검증**: pi-lens full 재스캔 plan-tool 경고 0(복잡도·return-await 소멸) · `bun test` 200 pass(그래프 반려 경로 포함 무변경 통과) · `bun run build` 0 종료.

### gate-server 죽은 export 제거·중복 추출

**맥락**: 하드닝 루프 이터레이션 7. 백로그의 gate-server.ts 항목(knip 미사용 export 2·jscpd 17줄 중복).

**작업**: knip 지적 라인이 스털였던 것을 실측으로 재확인 — `resolveViewerDist` 는 정의→gate-server 재export→무소비 죽은 사슬(본체 포함 삭제), `GateEvent` 재export도 무소비(gate-http 는 gate-events 직접 import). runGate·observeGate 중복 17줄(게이트 확보+SSE 하트비트 조건부 브라우저 오픈)을 `acquireGateAndMaybeOpen()` 으로 추출, 두 함수는 사용 옵션만 구조분해로 정리.

**검증**: `tsc -b` 클린 · `bun test` 200 pass · `bun run build` 0 종료 · jscpd gate-server.ts 소스 중복 소멸(테스트 스캐폴드 중복은 별개 잔존).

### state·graph 거부 분기 테스트 — 스펙 지명 저커버리 영역 완료

**맥락**: 하드닝 루프 이터레이션 6. 스펙 지명 저커버리(state.ts·graph.ts)의 미커버 라인이 전부 '거부 분기'(validateState invalid-shape throw · coerceRef/coerceNode throw)였음을 확인 — 방어 코드가 테스트 무방비 상태.

**작업**: engine.test.ts 에 invalid-shape 8건(valid JSON, 형태 위반 → 백업+undefined), graph.test.ts 에 refs/노드 거부 6건 추가.

**검증**: state.ts 브랜치 96.36→100 · graph.ts 브랜치 98.73→100 · `bun test` 200 pass(신규 1+6 케이스) · `bun run build` 0 종료.

### Stage Registry 불변식 테스트 — stages.ts 커버리지 100%

**맥락**: 하드닝 루프 이터레이션 5. 스펙이 지명한 저커버리 영역 중 첫 번째(stages.ts 66.67%).

**작업**: `stages.test.ts` 신규 9건 — 단계 순서/산출물 규약/그래프 의무(none·required·optional = 게이트 분기 원천)/프롬프트 비었음/Stage 2 그래프 규약 지시/stageById 조회·방어. 중간에 내 기대치 오타(`version:2` → 실제 `"version":2`)로 1fail → 수정. 부산물: graph.test.ts 의 JSON.parse 픽스처 파싱에 대한 ast-grep 오탐 2건 false-positive 처리(테스트 실패 은폐 방지 목적).

**검증**: stages.ts 커버리지 66.67→100 · `bun test` 199 pass(신규 9) · `bun run build` 0 종료.

### 뷰어 XSS 차단 — mdToBlocks html:false 전환 + 그래프 참조 감지 이전

**맥락**: 하드닝 루프 이터레이션 4. 백로그 최우선이었던 `Block.jsx` `dangerouslySetInnerHTML`(CWE-79, 4건) 추적.

**분석**: 위협 모델 — 산출물 .md 는 Design/web feedback 자식이 작성, 외부 콘텐츠 인용 포함 → 프롬프트 인젝션으로 `<img onerror>` 삽입 → 게이트 오리진에서 실행 → `POST /api/decision` 자동 확정(원칙 1 무력화). 오탐이 아닌 실제 권한 상승 경로로 판정.

**작업**: `html:true→false`(원시 HTML 전부 이스케이프, 구조적 차단). 실측 확인 후 `html_block` 소멸에 따라 그래프 참조 감지를 문단 텍스트 매칭으로 이전. 회귀 3건 추가. [[viewer-xss-gate-bypass]] 작성(위협 모델 기록).

**검증**: `bun test` 190 pass(신규 3) · `bun run build` 0 종료. 그래프 기존 테스트 3건 무변경 통과(동일성 확인).

### 코어 순환의존 해체 — feedback-agents 타입을 types/ 로 이동

**맥락**: 하드닝 루프 이터레이션 3. pi-lens full 이 잡은 madge 순환의존 3건(`feedback-agents.ts` ↔ 변형 데이터 파일) 처리.

**작업**: `FeedbackAgent`·`FeedbackCapability` 를 `types/feedback.ts`(오케스트레이션 타입의 기존 주거지)로 이동. 변형 3파일은 `./types/feedback.ts` 에서 import, 레지스트리는 재export 로 공개 API 호환 유지. `types/index.ts` 배럴에도 추가. StageId 는 `./gate.ts`(무import 순수 타입 모듈)에서 — 새 사이클 없음 확인.

**검증**: `bunx madge --circular` 전체(코어+pi-extension) 0 순환 · `bun test` 187 pass · `bun run build` 0 종료.

**남은 백로그**: Block.jsx dangerouslySetInnerHTML XSS 검증, gate-server.ts 미사용 export 2·17줄 중복, stages.ts 커버리지 66%, CSS 중복, plan-tool.ts no-return-await 4건.

### 하드닝 루프 시작 — 진단 스캔 + 게이트 브라우저 오픈 명령 주입 구조 제거

**맥락**: 무계량 하드닝 루프(max 25) 이터레이션 1-2. 1차: 누락된 devDependency(`@happy-dom/global-registrator`) 설치로 실패 4건 복구(181 pass). 2차: pi-lens full 스캔으로 전체 건강 상태 파악.

**작업**:

- pi-lens full 진단: 차단 1(CWE-78)·순환의존 3(feedback-agents*)·XSS 후보(Block.jsx)·중복/복잡도 다수 — 향후 이터레이션 백로그 원천.
- `gate-browser.ts`: `exec`(셸 문자열 조립) → `spawn`(인자 배열, shell:false) 재작성 — 명령 주입 경로 구조적 제거. 플랫폼별 사양을 순수 함수 `browserCommand`로 분리(중첩 삼항 제거), 신규 테스트 6건(주입 페이로드 거부 포함). taint 룰 잔여 경고는 근거 주석과 함께 억급.
- 문서 동기화: Changelog Fixed 항목 추가, 누락돼 있던 05-problems 노트 2건([[chat-rewrite-gate-reopen]]·[[chat-loop-reentry]]) 보강 작성(Changelog/Dev-Log에만 링크되던 고아 결함 기록), Home 테이블 MD056(위키링크 별칭 `|` 파이프) 수정, `[[ADR-026]]` 전체 파일명 링크 수정.
- `bun test` 187 pass(신규 6), `bun run build` 0 종료.

**남은 것**: 순환의존(feedback-agents* 3건), Block.jsx dangerouslySetInnerHTML XSS 검증, gate-server.ts 미사용 export 2건·중복 17줄, stages.ts 커버리지 66%, CSS 중복 다수.

## 2026-08-15

## 2026-08-15 (2)

### 테스트 뷰어 큐 무동작 — dev-mock 재작성(실서버 의미론 모방)

**맥락**: 사용자 보고 — 테스트 뷰어(`apps/plan-viewer` `bun run dev`, vite 5180)에서 큐가 정상 동작하지 않음.

**원인**: vite.config.js 의 dev-mock 이 최신 게이트 프로토콜보다 오래됨. GET /api/chat `{messages}`(queue 없음)·POST text 전용(stage-request 무시)·cancel 부재·SSE 부재. 특히 ADR-022 로 뷰어 폴링이 제거된 뒤 목업에는 갱신 채널 자체가 없어 3초 가짜 회신도 화면에 뜨지 않았다(주석은 폴링 시절 스테일).

**작업**:

- `apps/plan-viewer/dev/mock-api.js`(신규 순수 모듈): 실서버 의미론 — idle 즉시 전달, busy(3초 회신 창) 큐 적재, 회신 완료마다 선두 1개 드레인, stage-request(대기 채팅 뒤 적재·채팅 거부·이중 거부·선두 실행=단계 진행+fulfilled·idle 즉시 실행), cancel(already-sent), GET {messages,queue}, subscribe(변동 이벤트). 타이머/시각 주입 가능해 bun test 로 검증.
- `vite.config.js`: 미들웨어 재구성 — 모든 /api/* 경로 exact 매칭(state·events SSE·chat GET/POST·cancel·decision·review-request), mock 구독 → SSE push(state·chat). 데모 산출물 6단계(1·2·5) → 3단계(1·2·3) 정리.
- `dev/mock-api.test.js`(신규 8건): 가짜 클록으로 (a) 즉시 전달/큐 적재 (b) 확정 뒤 적재·채팅 거부 (c) 선두 1개씩 승격 (d) stage-request 실행·잠금 해제 (d2) idle 즉시 실행 (e) cancel·이중·read-wins (f) messages·queue (부가) 최종 confirm → done.
- `bun test` 181 pass(신규 8), `bun run build` 0 종료(배포).

**교훈**: 뷰어 프로토콜이 바뀔 때(SSE·큐·stage-request) '실서버 + 목업' 양쪽을 함께 갱신하지 않으면 데모 경로가 썩는다 — 목업도 의미론 단위(ADR)로 추적해야 했다. 이번에 목업을 순수 모듈로 분리해 테스트로 고정했으므로 재발 여지가 줄었다.

### 큐 후속 UX 4건 — 1개씩 순서 전달·미리보기·취소 버튼 대비·게이트 바 대기 유지 ([[ADR-026-stage-request-queue-transit]] 개정)

**맥락**: 사용자 보고 4건 — ① 대기 채팅 2개가 응답 완료 시 한 번에 배출돼 큐가 한꺼번에 비워짐(하나씩 기다리게 해야 함) ② 큐에서 무엇이 대기 중인지 안 보임 ③ 확정 요청 대기 항목에 취소 버튼이 안 보임 ④ 확정 요청 실행 시 게이트 바가 대기 상태로 전환되지 않고 다음 단계 페이지로 바로 넘어감.

**원인 분석**:

1. `gate-server.ts` 드레인 `while` 루프가 선행 채팅을 전부 한 chat 이벤트로 배출.
2. 이전 세션의 '플레이스홀더만' 요구 반영으로 본문 전체를 가렸더니 식별 불가(요구 반전).
3. ✕ 버튼은 렌더링되지만 `--muted` 회색이 `--primary` 배경과 대비가 없어 시각적으로 사라짐(CSS 문제).
4. `applyState`가 `gateOpen=true`마다 `setPending(false)` — 채팅 응답 루프의 게이트 재오픈이 로딩을 해제했고, 실행 시엔 pending 이 이미 풀린 상태.

**작업**:

- `gate-server.ts`: 드레인을 선두 1개만 전달로 변경(채팅 1건 씩; stage-request 선두 시 decision 은 유지).
- `ChatSidebar.jsx`: 큐 미리보기(`previewOf` — 첫 줄 ~40자 말줄임) + '대기' 태그 + `[blockId]`.
- `chat.css`: `.chat-queued-preview`(한 줄 말줄임), `.chat-queued-msg.stage-request .chat-cancel` `--on-color` 대비 규칙.
- `App.jsx`: `stageQueued` 상태 + `fetchQueue`(마운트·SSE chat·확정 직후 동기화), `applyState` gateOpen=false + 단계 진행 감지 시 `setPending(true)` 재설정, `loading={pending || stageQueued}` + `loadingLabel` 상황별 전달.
- `GateBar.jsx`/`PlanPage.jsx`: `loadingLabel` prop 추가·전달.
- 테스트: 서버 시나리오 1개씩 전달 검증(재진입마다 1건 + 중간 큐 상태), 뷰어 미리보기(40자 말줄임·blockId)·취소 POST 호출, App 로딩 유지 시나리오(재오픈 유지 → 실행 → 기본 라벨 → 해제). `bun test` 173 pass, `bun run build` 0 종료(배포).

**교훈**: '미리보기 없는 플레이스홀더' 요구는 하루 만에 반전됨 — 큐 UI는 '무엇이' 대기 중인지가 핵심 정보. 스펙 확정 시 식별성과 프라이버시(본문 비노출)를 함께 물었어야 했다.

## 2026-08-14

### 다음 단계 요청의 큐 경유(단일 채널) — 응답 중 확정 드롭·큐 미표시 수정 ([[ADR-026-stage-request-queue-transit]])

**맥락**: 사용자 보고 — 큐에 채팅 2개가 대기 중인 상태에서 확정 버튼을 눌러도 '다음 단계 요청'이 채팅 2개 뒤 3번째 칸으로 보이지 않고, 실제 진행도 채팅 응답이 끝난 뒤에 이루어지지 않음. 추가 요구: 확정 대기 중 채팅 입력 잠금+안내, 큐 항목은 본문이 아닌 대기 콘텍스트 플레이스홀더.

**원인 분석**(`/goal` 검증 계약 하에 조사):

1. `gate-http.ts` stage-request 분기가 `chatLog` 에 직접 push(주석 그대로 '전달/큐 미경유') — 큐(`pendingChats`)에 안 들어가 순서 표시가 불가능했다.
2. `/api/decision` 핸들러가 `currentResolver` null(에이전트가 채팅 응답 중)이면 `r?.()` 로 **확정 결정을 조용히 드롭** — 기록만 남고 진행은 안 되어 재클릭이 필요했다.

**작업**:

- `types/gate.ts`: `ChatMessage.decision?: GateDecision` 추가(큐 항목이 실행될 결정을 운반 — 서버 내부용).
- `gate-http.ts`: stage-request → `pendingChats` 마지막 칸 적재(+이중 확정 `already-pending` 거부). 게이트 열림+유일 항목이면 즉시 fulfilled 기록 후 decision resolve. 텍스트 채팅 POST 는 큐에 stage-request 대기 중 `stage-request-pending` 거부.
- `gate-server.ts`: runGate 드레인 재작성 — 선두가 채팅이면 선행 채팅만 chat 이벤트(단계 요청 직전까지), 선두가 stage-request 면 fulfilled 기록 + `decision(confirm)` resolve. 구 `chatLog` pending 승격 스캔 제거.
- `App.jsx`: `onGate` 분기 — 비최종 confirm 은 `/api/chat stage-request(decision 포함)` 단일 채널, 최종/modify/revert 만 `/api/decision`.
- `ChatSidebar.jsx`: 큐 플레이스홀더('대기 중 · 채팅', 본문 미노출), stage-request 대기 중 입력 잠금 + `.chat-lock-notice` 안내, 전송 거부 시 draft 유지, 취소 ✕ 를 단계 요청에도 부여.
- `chat.css`: `.chat-lock-notice` 스타일.
- 테스트: 서버 5단계 시나리오(즉시 전달→2건 적재→확정 3번째 칸→채팅 거부→취소→재확정→드레인 chat→decision 실행·코멘트 페이로드 검증) + 즉시 resolve 경로, 뷰어 플레이스홀더·잠금 2건, App 채널 단일화(decision 미경유) 1건. `bun test` 172 pass, `bun run build` 0 종료(배포 완료).
- 문서: ADR-026 작성, ADR-025 superseded 처리.

**남은 것**: modify/revert 를 응답 중(resolver null)에 누르면 여전히 드롭된다(사전 존재 동작, 범위 밖 — 필요 시 동일 큐 패턴으로 `kind:'decision-request'` 확장 가능). 구 뷰어와 신 서버 혼용 시 비최종 confirm 이 빈 코멘트로 즉시 실행되나 빌드=배포로 실질 동시 갱신.

## 2026-08-13

### 다음 단계 요청 채팅 강조 기록(pending→fulfilled) + 큐 재디자인 ([[ADR-025-stage-request-chat-record]])

**맥락**: 사용자 요청 — '확정 → 다음 단계' 버튼을 누르면 '다음 단계 요청'이 채팅처럼 채팅창에 나타나야 하고, 큐에도 올라갈 수 있으며, 채팅·큐 양쪽에서 특별한 메시지로 강조. 추가로 큐 전반 디자인 개선·둥근 테두리.

**조사**: 게이트 결정(`/api/decision`, 단계 진행)과 채팅(`/api/chat`, 정제)은 [[ADR-009-realtime-chat-loop]] 가 분리한 별개 채널. 단계 요청을 실제 전달 큐(`pendingChats`)에 넣으면 결정 채널과 resolver 경쟁·이중 전달이 생긴다. → 결정 채널은 그대로 두고, 단계 요청을 **채팅 로그 기록 전용**(전달 X, 취소 불가)으로 분리. 게이팅 사용자 선택: '결정 진행 + 강조 기록'(companion) 모델, 디자인은 '채운 액센트 배경'.

**작업**:

- `types/gate.ts`: `ChatMessage` 에 선택 필드 `kind?:"stage-request"`·`status?:"pending"|"fulfilled"`·`targetStage?:number` 추가(후방 호환).
- `gate-http.ts`: `POST /api/chat` 에 `kind:"stage-request"` 분기 — `chatLog` 에 `status:"pending"` 으로 push 하되 `currentResolver`/`pendingChats` 건드리지 않음(게이트 유지, 결정 채널로만 진행).
- `gate-server.ts`: `runGate` 시작(currentResolver 설정 직후, `onReady` 이전)에 `chatLog` 내 `pending` 단계 요청을 `fulfilled` 로 전환 + `broadcastSse("chat")`.
- `App.jsx`: `onGate` 가 `verdict:"confirm"` 且 `state.stage<3` 일 때 `/api/decision` 외에 `/api/chat {kind:"stage-request", targetStage:stage+1}` POST.
- `ChatSidebar.jsx`: `pendingStageReqs` 계산 — pending 단계 요청은 큐 영역에 강조(✕ 없음), fulfilled 은 채팅 본문에 강조(messages.map 에서 pending 은 skip). thinking 표시에서 stage-request 제외.
- `chat.css`: 단계 요청 `--primary` 채운 배경 + 10px 둥근 카드, 큐 아이템 점선→실선 둥근 카드·태그 pill.
- 테스트: `gate-server.test.ts` +1(stage-request pending 기록·게이트 유지·runGate 오픈 시 fulfilled 전환), `ChatSidebar.test.jsx` +2(pending 큐 강조·✕ 없음 / fulfilled 본문 강조), `App.test.jsx` +1(confirm 시 stage-request POST). 자체체크 171 pass(신규 4).

**남음**: 없음.

### 채팅 전송 대기 큐 도입 — 에이전트 응답 중 큐 적재·취소·승격·read-wins ([[ADR-024-chat-send-queue]])

**맥락**: 사용자 요청 — 에이전트가 채팅을 바로 읽지 못할 때(응답 중) 메시지를 가시 대기 큐에 두고, 각 메시지를 전송 취소할 수 있어야 한다. 단 읽기와 취소가 동시에 일어나는 경쟁에선 '읽힌 것'을 우선(취소 거부).

**조사**: 기존 `POST /api/chat`(gate-http.ts)는 `chatLog.push` + `pendingChats.push` 를 같은 순간에 하고 대기 중 resolver 를 즉시 발화시켰다 → 메시지가 곧바로 '전송됨'으로 표시되어 취소 불가. 단, 에이전트 응답 중(resolver null)엔 `pendingChats` 버퍼에 쌓이고 재진입 시 splice 되는 '보이지 않는 큐' 가 이미 존재했다(gate-server.ts 재진입 보호). 이를 가시 큐로 승격시키면 된다.

**작업**:

- `gate-http.ts`: `POST /api/chat` 전송 경로를 `currentResolver` 유무로 분기 — 있으면(에이전트 대기) 즉시 전송(`chatLog`+전달), 없으면(응답 중) `pendingChats` 에만 적재(`chatLog` 미진입 → 취소 시 완전 삭제). `POST /api/chat/cancel {id}` 추가 — 큐에 있으면 제거(`ok:true`), 없으면 거부(`ok:false already-sent` = read-wins). `GET /api/chat` 응답에 `queue` 추가. `makeGateHandler` 시그니처에 `broadcast` 주입 추가(순환 import 회피).
- `gate-manager.ts`: `getOrCreateGate` 가 `makeGateHandler(gate, (type,data)=>broadcastSse(gate,type,data))` 로 호출.
- `gate-server.ts`: 재진입 보호 블록에서 `pendingChats.splice` 전에 큐 메시지를 `chatLog` 로 승격(= '읽기' 시 전송됨 확정) + `broadcastSse("chat")`.
- `ChatSidebar.jsx`: `queue` state + `cancelQueued`, 본 채팅과 분리된 '전송 대기 중' 영역(✕ 버튼) 렌더. `chat.css` 대기 영역 스타일.
- 테스트: `gate-server.test.ts` +1(즉시전송·큐적재·취소·승격·read-wins 한 흐름), `ChatSidebar.test.jsx` 신규 +2(대기 렌더·취소 POST).

**남음**: 없음. `bun run build`(tsc -b + viewer 빌드 + install.mjs) 종료 0, `bun test` 167 pass(신규 3).

### 읽기 전용 이전 단계 뷰 버그 2건 수정 ([[ADR-023-viewer-transition-ux]])

**맥락**: 사용자 리포트 — (1) 이전 단계로 전환한 뒤 스테퍼에서 원래(현재) 단계로 돌아와도 상단 읽기 전용 배너가 사라지지 않음. (2) 이전 단계로 전환하면 이미 작성된(승인된) 단계들도 '아직 안 쓴 단계'처럼 보여 헷갈림.

**조사**:

- 버그1: `App` 의 `readOnly = viewStage !== null`. 스테퍼 클릭은 `onSelect(s.n)` → `setViewStage(s.n)` 만 호출. '현재 단계' 스텝을 클릭해도 `viewStage = state.stage`(null 아님) 가 되어 readOnly 가 해제되지 않았다. 배너의 '현재 단계로 돌아가기' 버튼만 `setViewStage(null)` 을 호출해 기능했기 때문에, 스테퍼 경로로는 복귀가 불가능.
- 버그2: `stagesFor(cur)`가 현재 보고 있는 단계(`curStage`) 기준으로 done/current/locked 를 매겼다. 이전 단계(예: 1)를 보면 2·3이 모두 locked(흐림·선택불가)로 렌더 → 실제로는 작성했는데 '미작성'처럼 보임. 작성 여부의 유일한 진실은 서버 `state.stage`(그 값 미만의 산출물은 존재/승인됨)인데 그걸 안 씀.

**작업**:

- `App.jsx`: `onSelectStage={(n) => n === state.stage ? setViewStage(null) : setViewStage(n)}` — 현재 단계 스테퍼 클릭 시 읽기 전용 해제. `PlanPage` 에 `activeStage={state.stage}` 전달.
- `PlanPage.jsx`: `stagesFor(viewed, real)` 로 재작성 — `s.n > real`만 `locked`, `s.n === viewed`만(viewed===real 이면 `current`, 아니면 `view`), 그 외는 `done`(작성됨·선택 가능). 기존 `.map` 의 `view` 오버라이드 제거(함수 내 포함).
- 테스트: `App.test.jsx` +2건 — (3) 읽기 전용에서 현재 단계 스테퍼 클릭 시 배너·게이트·채팅 재활성, (4) Stage 2 에서 Stage 3(미작성)만 locked·Stage 1 done·Stage 2 current. 자체체크 157 pass.

### 단계 전환 UX — 대기 화면 제거 + 이전 단계 읽기 전용 보기 ([[ADR-023-viewer-transition-ux]])

**맥락**: 사용자 요청 — (1) 확정 같은 게이트 결정 후 다음 단계로 넘어갈 때 전체 '다음 준비 중' 화면이 뜨지 않고 기존 뷰어 페이지(게이트 바 프레임 포함)를 그대로 유지한 채 확정 버튼이 로딩 연출하며, 다음 단계가 작성 완료되면 넘어간다. (2) 이전 단계 계획을 읽기 전용으로 볼 수 있고(기존 '정정' 기능과 무관), 읽기 전용이면 코멘트/채팅을 작성할 수 없다.

**조사/설계 포인트**:

- `applyState` 가 `gateOpen=false` 만 보면 전체 화면 `PreparingScreen` 으로 전환하던 것이 원인. 취지는 단계 전환 알림이지만, 이미 검토 페이지(reviewing)를 보는 중엔 전환할 필요가 없다.
- 이전 단계 산출물은 `buildViewerState` 가 `stage <= state.stage` 를 전부 `state.artifacts` 에 담으므로 데이터·백엔드 변경 없이 뷰어 단에서 조회할 수 있었다.
- 코멘트는 실시간 채팅(`/api/chat`)으로 즉시 전달되므로, 읽기 전용 잠금은 PlanPage 의 핸들러를 no-op(`commentFreeze`)으로 대체하는 것만으로 채널이 완전히 막혔다(GateBar 미렌더 + ChatSidebar.disabled 로 이중 안전).

**작업**:

- `App.jsx`: `onGate`/`onReview` 의 `setPhase("preparing")` 제거 → `setPending(true)`. `applyState` 의 `gateOpen=false` 분기에서 `reviewing` 이면 phase 유지. `viewStage` 상태로 읽기 전용 이전 단계 선택. `pickMarkdown`·그래프를 `curStage` 기준으로 재계산.
- `GateBar.jsx`: `loading` prop — 확정 버튼 스피너 + '다음 단계 작성 중…', 액션 비활성.
- `ChatSidebar.jsx`: `disabled` prop — 입력/전송/블록 스코프 체크박스 비활성.
- `PlanPage.jsx`: `readOnly` prop — 코멘트 핸들러 no-op, GateBar 미렌더, `readonly-banner`(현재 단계로 돌아가기). Stepper 에 `onSelect` 연결.
- `Stepper.jsx`: 클릭 → `onSelect(stage)`(레거시 해시 라우팅 유지). 이전 단계에 `view` 상태 스타일.
- 스타일: `.spinner`(gate.css) · `.readonly-banner`(pages.css) · `.step.view`(layout.css).
- 테스트: `App.test.jsx` 2건 신규 — 페이지 유지+확정 로딩 / 읽기 전용 전환·복귀. 자체체크 155 pass.

### 뷰어 갱신 폴링 → SSE push 전환 ([[ADR-022-viewer-sse-push]])

**맥락**: 사용자 요청 — 뷰어가 md 를 2초 폴링으로 갱신하는 대신, 에이전트가 파일을 기록한 타이밍에만 갱신하게(이벤트 push). 사용자는 md 파일을 직접 건드리지 않으니 에이전트 수정·추가 시에만 갱신되는 게 낫다고 판단.

**조사**: (1) `/api/state` 2초 폴링은 md 갱신 외에 탭 생존 하트비트 역할도 담당(`gate.lastSeen` → `BROWSER_REOPEN_AFTER_MS` 재오픈 판정). 폴링을 그냥 없애면 재오픈 로직이 붕괴. (2) `ChatSidebar` 도 `/api/chat` 0.5초 폴링. (3) 에이전트가 md 를 기록하는 경로(`writeArtifact`)는 core 에 있지만 **모든 호출자가 pi-extension**(`plan-tool.ts`·`plan-gate.ts`) — core 내부 호출(`promoteGraphTree`) 도 `runOpenGate → promoteGraphArtifact` 경로. 즉 트리거 소스가 이미 서버 쪽에 있어 core 건드릴 필요 없음. (4) 핵심 한 지점: 뷰어에 보이는 산출물 md 는 `runOpenGate` 의 `writeArtifact` + 직후 게이트 오픈(`runGate`/`observeGate`) 시퀀스 한 곳에서 발생.

**작업**:

- `gate-manager.ts`: `PersistentGate` 에 `sseClients: Set<ServerResponse>` 추가. `broadcastSse(gate, type, data?)` 헬퍼(프레임 송신 + 실패 클라이언트 자동 제거). `notifyViewerState(root, feature)` 래퍼. `appendAgentChat` 에 `broadcastSse(gate, "chat")` 연결. `closeGate` 가 SSE 클라이언트 정리.
- `gate-http.ts`: `/api/events` 핸들러 추가(`text/event-stream`, `sseClients.add`, `req.on("close")` 해제). 인라인 gate 타입에 `sseClients` 필드.
- `gate-server.ts`: `runGate`/`observeGate` 재오픈 판정에 `gate.sseClients.size === 0 &&` 조건 추가(SSE 연결 = 하트비트 흡수). `notifyViewerState` re-export. (덤: `closeGate`·`appendAgentChat`·`moduleDir`·`resolveViewerDist` 상단 import 가 re-export 와 중복 unused → 상단 import 를 실사용분만 남겨 정리.)
- `plan-gate.ts`: `runOpenGate` 에서 `saveState` 직후 `notifyViewerState(root, feature)` 호출(산물 기록 타이밍 = push). resume 여부 무관.
- `App.jsx`: `setInterval(fetchState, HEARTBEAT_MS)` 제거 → 단일 `EventSource("/api/events")` 로 `state` 이벤트 → `fetchState()`, `chat` 이벤트 → `fn-chat-update` dispatch. `HEARTBEAT_MS` 상수 삭제.
- `ChatSidebar.jsx`: `setInterval(fetchChat, 500)` 제거. `fn-chat-update` 리스너 유지(이제 SSE chat 이벤트가 유일한 갱신 트리거).
- 테스트(`gate-server.test.ts`) 2건 추가: `/api/events` SSE broadcast(`appendAgentChat`·`notifyViewerState` → 클라이언트에 `chat`/`state` 프레임 도달), SSE 연결 살아있으면 하트비트 경과해도 재오픈 생략.

**결정 근거**: Long polling(매 요청 오버헤드·동시 연결 제한) · `fs.watch`(OS별 신뢰성·core 침범) · `ws`(builtins-only 위반) 대안 대비, SSE 가 raw `node:http` builtins 로 가능하고 트리거 소스가 서버에 이미 있어 가장 작은 변경. → [[ADR-022-viewer-sse-push]]

**남은 것**: 수동 웹 검증(실제 에이전트가 산물 기록 후 게이트 오픈 시 뷰어가 폴링 없이 즉시 갱신·SSE 연결 끊김 시 자동 재연결)은 사용자 확인. 자체체크 153 pass.

### 채팅 수정 요청 게이트 깨짐 수정 — gateOpen 상태 designArtifact 재호출 미처리 ([[chat-rewrite-gate-reopen]])

**맥락**: 사용자 보고 — 채팅으로 수정 요청하니 draft.md 만 수정되고 게이트가 닫히며, 뷰어는 갱신 안 되고 클릭 등 상호작용이 먹통인 상태가 된다.

**조사**: (1) `closeGate` 는 파이프라인 완료/`state.done` 시에만 호출 — 채팅 수정으로 닫힐 리 없다. (2) `drivePlan` 에서 `gateOpen=true` + `designArtifact` 정의된 경우를 추적: resume 경로는 `designArtifact===undefined` 요구(스킵), 메인 경로는 `!state.gateOpen` 요구(스킵) → “도달 불가 — 안전 추락” 폴백으로 빠져 spawn-design 만 반환. 재작성 draft 가 스테이지 산물로 반영되지도, 게이트가 갱신 내용으로 재오픈되지도 않는다. (3) 뷰어는 App.jsx 가 `/api/state` 를 2초 폴링(`setInterval`) → 게이트가 살아있고 산물이 갱신되면 자동 갱신. 즉 “뷰어 멈춤/갱신 안 됨”은 폴백으로 게이트가 orphan 돼 resolver 가 없어 클릭이 먹통인 것의 결과.

**작업**:

- `plan-tool.ts` `drivePlan`: resume 블록 뒤에 `gateOpen && designArtifact` 분기 추가 — `draft.md` 내용을 읽어 `runOpenGate(resume=false)` 로 산물 반영 + 게이트 재오픈. `chatResponse` 도 함께 오면 runOpenGate 가 답변을 chatLog 에 push.
- 게이트 서버·`runOpenGate`·뷰어는 무변경(뷰어는 이미 폴링 중).
- 회귀 테스트(`plan-tool.test.ts`): 게이트 열린 상태에서 `designArtifact(+chatResponse)` 재호출 → 산물 반영·게이트 유지·답변 push. 단 `appendAgentChat` 이 `runGate→getOrCreateGate` 보다 먼저라 첫 오픈엔 게이트가 없으므로 `getOrCreateGate` 로 게이트를 사전 시드(실동작에선 채팅이 이미 열린 게이트에서 발생해 무관).

**남은 것**: 수동 웹 검증(실제 에이전트가 designArtifact 재호출로 게이트 갱신)은 사용자 확인. 자체체크 151 pass.

### 게이트 채팅 루프 끊김 수정 — chatPending 수신 후 에이전트 턴 종료 ([[chat-loop-reentry]])

**맥락**: 사용자 보고 — 에이전트 채팅을 치면 FactoryNote 모드가 꺼진다. 정확히는 채팅 응답이 돌아오지 않고, 에이전트가 게이트 대기 상태로 재진입하지 않은 채 하네스에서 턴이 종료된다.

**조사**: (1) `planMode` 는 `disablePlanMode()`(파이프라인 완료 시) 또는 `/factorynote off` 로만 꺼짐 — 코드상 채팅만으로는 꺼질 리 없음(`index.ts:108`). (2) 채팅 이벤트 경로는 `done:false` 반환(`plan-gate.ts`). (3) 게이트 서버 재진입 로직은 `gate-server.test.ts`(“runGate resolves chat event while waiting, then decision on re-entry”) 로 이미 검증 — 채팅→재진입→결정 루프 정상. (4) 따라서 끊김의 원인은 에이전트가 `chatPending` 수신 후 자발적으로 `factorynote_plan(chatResponse)` 를 재호출하지 않아 턴이 종료되는 것. 툴 호출 모델에서는 에이전트 재호출 없이 게이트 유지 불가.

**작업** (방향: 재호출 유도 강화):

- `format.ts`: 채팅 블록을 본문 `message` 앞(상단)으로 옮기고, “턴을 종료하지 말 것” + `factorynote_plan(chatResponse)`(산물 수정 필요시 `designArtifact` 포함) 재호출을 명령형으로 명시.
- `index.ts`: `factorynote_plan` `promptGuidelines` 에 chatPending 시 재호출 의무(턴 종료 금지) 라인 추가.
- 게이트 서버·`plan-gate.ts` 재진입 로직은 무변경(이미 검증).
- 회귀 테스트: `format.test.ts`(chatPending → 재호출 지시문 명령형 포함 + 상단 배치), `plan-tool.test.ts`(게이트 대기 중 채팅 → chatPending → chatResponse 재진입 시 agent 답변 chatLog push + 게이트 유지 confirm).

**남은 것**: 수동 웹 검증(실제 에이전트가 재호출하는지)은 사용자 확인 필요 — 결정적 기반(재진입 코드 경로 + 지시문)은 단위·통합 테스트로 검증 완료. 자체체크 150 pass.

## 2026-08-12

### 그래프 쇼케이스 미출력 수정 — 낡은 뷰어 dist 서빙 ([[graph-showcase-stale-dist]])

**맥락**: 사용자 보고 — `bun repro-graph-kinds.mjs` 실행 시 그래프 박스는 나오나 "그래프 데이터(...)를 찾을 수 없습니다" 빈 상태. 그래프 파일을 못 찾았다며 안 보인다.

**조사**: (1) repro 서버의 `/api/state` 를 curl — stage-2 산물의 `graphs` 배열에 4종(tree·sequence·flowchart·legacy) 이 모두 정상 인라인. 백엔드/코어는 정상. (2) 그런데 게이트가 서빙하는 dist(`apps/plan-viewer/dist`, gitignore) 의 graphData 조립 로직이 구 버전 — `f?.graph ? {[f.graph.file]: f.graph.tree} : {}` (단일 그래프 API). 현재 state 는 `graphs`(배열). 그래서 `graphData={}`. (3) dist 빌드 시각(08-11) 이 소스 App.jsx 커밋(08-12) 보다 **이전** — dist 가 stale. (4) `gate-server.test.ts` 는 통과하지만 /api/state JSON(백엔드)만 검증하고 렌더링(dist 소비)은 안 돌려서 이 클래스를 못 잡음. `ensure-viewer-dist.ts` preload 도 dist 가 없을 때만 빌드하고 stale 일 때는 빌드 안 함.

**작업**:

- `ensure-viewer-dist.ts` 재작성: staleness 인식 — dist 가 없거나 `apps/plan-viewer` 소스(node_modules·dist 제외) 보다 낡았으면 `vite build` 재빌드. 순결정 helper `viewerDistIsStale(distMtimeMs, srcMtimeMs)` 추출. `bun:test` preload 도 같이 개선(소스 변경 후 테스트 시 자동 재빌드). `import.meta.dir` → `fileURLToPath(import.meta.url)`(루트 파일은 tsconfig 밖이라 pi-lens 기본 TS 가 bun-types 미인지).
- `repro-graph-kinds.mjs`: 서빙 전 `import "./ensure-viewer-dist.ts"`(모듈 로드 시 ensureViewerDist 사이드이펙트 → stale 이면 재빌드).
- 테스트 `ensure-viewer-dist.test.ts`: `viewerDistIsStale` 결정 4케이스(null→stale / fresh / stale / 동일-순간→fresh).

**검증**: repro 재기동 → /api/state 4종 그래프 정상 + dist fresh 로 `cur.graphs` 소비 → 빈 박스 없음. `gate-server.test.ts` 12 pass. `bun test` 140 pass(기존 @happy-dom 2 실패는 무관 유지). `bun run build` 0 종료. `bun test` 실행 자체가 stale dist 를 재빌드하는 것도 확인(수정이 런타임에 작동).

**메모**: 이 버그는 백엔드 state 가 맞고 dist 가 낡은 비대칭이어서 정적 분석만으론 '경로가 다 맞는데 왜 안 되지' 였음 — 실제 /api/state 덤프가 결정적. 루트 툴링 파일(ensure-viewer-dist.ts, repro-*.mjs) 은 tsc -b 대상이 아니라 pi-lens 가 bun-types 없이 검사 → `bun:test`/`import.meta.dir` 계열 false-positive.

### 그래프 종류 확장 — Sequence · Flowchart ([[ADR-021-sequence-flowchart-graphs]])

**맥락**: 사용자 요구 — 계층 트리 외에 시퀀스 다이어그램·플로우차트 추가. 문답 확정: 전용 JSON + 커스텀 렌더러(mermaid 아님) · 종류는 파일 envelope type 필드 · 모든 단계 허용 · 렌더러는 둘 다 신규 SVG · 시퀀스에 alt/loop/opt fragment 포함.

**작업**:

- 코어: `types/graph.ts` envelope 2종 + `GraphKind` · `graph.ts` coerce/parse(`coerceGraphSequenceFile`·`coerceGraphFlowchartFile`·`parseAnyGraphKind`·`graphKindOf`) · `artifact.ts` `checkRequiredGraph` 가 종류 무관 유효성 판정. 참조 추출·승격·무효화 무변경(sequence·flowchart 단일 파일은 `collectGraphChildFiles` 빈 목록으로 자연 승격).
- 서빙/뷰어: `viewer-state.ts` `graphs[].{file,type,data}` 타입 분기 · `App.jsx`·`Block.jsx` 분기 · 신규 `SequenceView.jsx`·`FlowchartView.jsx` + 순수 배치 `lib/layoutSequence.js`(컬럼·시간축·fragment 중첩 박스)·`lib/layoutFlowchart.js`(Kahn 랭크 + barycenter, 사이클 폴백, 백엣지 플래그) + `graph.css`.
- 지시: `df-task.ts` graphLine 3종 규약 명시 · `feedback-agents-graph.ts` structure 체크리스트 3종 envelope 갱신 + 에이전트 md 재생성(32개).
- 테스트: envelope 유효/불량 파싱 · `parseAnyGraphKind` 하위 호환 · checkRequiredGraph 종류 수락 · 3종 혼합 게이트 서빙 · 3종 혼합 승격(drivePlan 전체) · 배치 순수 함수(컬럼 순서·시간축·fragment 포함 관계·겹침 0·결정성) · happy-dom 렌더(요소 개수·shape·읽기 전용). 142 pass + `bun run build`.
- 문서: [[ADR-021-sequence-flowchart-graphs]] 신규, [[Changelog]]·[[Home]]·[[implementation-architecture]] 갱신.

**메모**: fragment 판별을 `kind` 필드가 아닌 `body` 배열 존재 여부로 — 메시지 `kind:"reply"` 와 충돌(테스트에서 적발 후 수정). flowchart 백엣지 테스트에서 `find(e.to==="build")` 가 정방향 엣지를 먼저 잡아 실패 — from·to 동시 매칭으로 수정.

### 다중 그래프 + 에이전트 자유 네이밍 ([[ADR-020-multi-named-graphs]])

**맥락**: 사용자 요구 — 그래프를 여러 개 둘 수 있게, 이름은 고정(`02-design-graph.json`)하지 말고 에이전트가 내용에 맞게 짓게. 문답으로 확정: (1) 폴더는 루트 json 이름에서 파생 (2) 승격 시 이름 그대로 유지 (3) Stage 2 필수 = 1개 이상·상한 없음.

**작업**:

- 코어 `graph.ts`: `graphRefFiles`(전체 참조 추출)·`isSafeGraphName`(`.json` 끝·`..` 금지)·`graphRefAttemptCount`(규약 위반 감지). `graphJsonNameFor` 제거(고정 이름 파생 폐지).
- 코어 `paths.ts`: `stageSubdir` 이름 추론(`-graph.json`→소유 md 역추적) 폐지 → `stageN/` 접두 경로 통과. 그래프 승격·서빙·무효화가 단계를 명시 전달.
- 코어 `artifact.ts`: `checkRequiredGraph` 다중화(1개 이상·파일 존재·envelope·이름 중복 거부, 구분 메시지) · `promoteGraphTree` 수집-후-쓰기로 src·dst 동일 안전 · `invalidateArtifactsAfter` md 읽어 참조별 트리 삭제.
- 어댂터 `plan-gate.ts`: `promoteGraphArtifact` 가 참조마다 `stage<id>/<이름>`으로 승격 — md 재작성 없음. `viewer-state.ts`: `artifacts[].graphs` 배열 서빙. 뷰어 `App.jsx`: 참조별 `graphData` 맵 조립.
- 프롬프트 `df-task.ts`: 자유 네이밍·여러 개 허용·본문 표시 위치 코멘트 지시로 갱신.
- 테스트: 다중 참조 추출·안전 이름·다중 승격(이름 보존·고아 제외)·다중 서빙(신규 이름+구 고정 이름 호환)·무효화·중복 거부·mdToBlocks 다중 블록. 122 pass + `bun run build` 0 종료. 부수: 미설치던 `@happy-dom/global-registrator` 등 16개 패키지 `bun install` 로 복구(기존 GraphView 테스트 실패 요인).
- 문서: [[ADR-020-multi-named-graphs]] 신규, [[ADR-016-graph-json-externalization]]·[[ADR-018-hierarchical-graph-tree]] 갱신 주석, [[Home]] 링크.

**메모**: draft 그래프는 feature 루트에 남아 재작성 재료가 됨(승격은 복사) — 자유 네이밍 후 잔여 파일 누적 가능성은 기존 고정 이름 시절과 동일 수준이라 정리 로직 추가 안 함(YAGNI).

### 그래프 드릴다운 미출력 수정 — ReactFlow pointer-events 주입 ([[graph-drilldown-pointer-events]])

**맥락**: 사용자 보고 — 게이트 검토 페이지에서 모듈 노드 더블클릭 시 하위 그래프가 안 나옴. 힌트 문구는 표시(데이터 정상)되나 더블클릭 무반응.

**특정 과정**: happy-dom 단위 재현은 통과(가양성) → 실제 Chrome headless(CDP) 재현 구성(`repro-drilldown.mjs`: bun 이 실데이터 게이트 서빙 + node 가 playwright 브라우저 구동) → `elementFromPoint` 가 노드 위치에서 pane 반환 + wrapper 인라인 `pointer-events: none` 발견. ReactFlow v11 `wrapNode` 가 클릭 계열 핸들러 없는 읽기 전용 노드에 `pointer-events: none` 을 주입하는데 `onDoubleClick` 은 그 조건에 없음.

**작업**: `GraphView.jsx` no-op `onNodeClick` 1줄(주석 포함) · `GraphView.test.jsx` 드릴다운 DOM 테스트 3건(pointerEvents 가드 포함) · `repro-drilldown.mjs` + `repro-drilldown-browser.mjs` 실브라우저 회귀 체크. 117 pass + `bun run build`. 환경 메모: Windows 에서 playwright `launch()` 타임아웃 → Chrome 직접 실행 + `connectOverCDP`(node), bun 에서 `spawnSync` 는 서빙 루프 블록.

### 그래프 미출력 근본 원인 수정 — 전이 시 지시 파일 갱신 ([[graph-output-stale-design-prompt]])

**맥락**: 사용자 보고 — `chat-program` 피처에 그래프 정보가 있는데 뷰어 출력이 안 됨. 조사 결과 (1) 게이트 전이 후 Design 자식이 이전 단계의 낡은 `design-prompt.md`(Stage 1 지시, 그래프 프로토콜 없음)를 읽어 자유 형식 그래프를 출력, (2) md 참조가 경로 포함(`graph/...`)이라 `GRAPH_REF_RE` 매치 실패 → 뷰어가 그래프를 읽지 못함.

**작업**:

- `plan-gate.ts`: 게이트 결정 후 전이 시 다음 단계 `design-prompt.md` + `feedback-menu.md` 즉시 기록.
- `plan-tool.ts`: 지시 파일 기록을 그래프 검증 앞으로 이동 — 반환 라운드 재작성 자식도 현 단계 지시를 읽는다.
- `artifact.ts`: `checkRequiredGraph` 규약 위반(경로 포함 등) 구분 메시지.
- 데이터: `graph/*.json` 자유 형식 → ADR-018 규격 변환(`draft-graph.json` + `draft-graph/`, 39 노드), draft.md 참조 규격화, 구 디렉터리 삭제. 미승인 draft 수동 승격은 하지 않음(5대 원칙 2).
- 테스트: 전이 시 지시 파일 갱신 · 경로 포함 참조 반려. 114 pass + `bun run build`.

### Stage 2 그래프 필수 강제 + 단계별 스폰 명령 ([[ADR-019-stage-2-graph-required]])

**맥락**: 사용자 요청 — 2단계 그래프를 프롬프트 권장에서 코드로 강제하고, 이를 위해 1·2·3단계에 서로 다른 스폰 명령을 내려달라. 기존엔 `designTask` 가 전 단계 공통 문구(“지시에 그래프 작성이 포함되면…”)를 쓰고 검증 코드가 없어, 그래프 없이 md만 넘겨도 Feedback·게이트로 그대로 진행됐다.

**작업**:

- core `stages.ts`: `StageDefinition.graph: "none"|"optional"|"required"` 추가 — Stage 1 none · Stage 2 required · Stage 3 optional. 데이터가 명령·검증을 분기.
- core `df-task.ts`: `designTask`·`designRevisionTask` 가 `def.graph` 로 그래프 지시 문구 분기(required = “필수·자동 반려” 명시, optional = 선택 규약, none = 언급 없음).
- core `artifact.ts`: `checkRequiredGraph` — md 참조 코멘트 → 루트 json 존재 → `version:2` 파싱 3단 검증, 미충족 시 이슈 문자열.
- pi `plan-tool.ts`: design 보고 + required 단계면 Feedback 전에 검증 — 미충족 시 `designRevisionTask` 로 재작성 지시(dfLoop+1), 상한 소진 시 게이트 에스컬레이션. 별도 카운터 없이 기존 상한 공유.
- 테스트: 단계별 명령 분기(1=그래프 언급 없음·2=필수·3=선택), 그래프 없는 draft 자동 반려 → 완성 후 게이트 진행, 상한 소진 에스컬레이션. 112 pass + `bun run build` 통과.

## 2026-08-11

### 계층 그래프 트리 + 드릴다운 뷰어 ([[ADR-018-hierarchical-graph-tree]])

**맥락**: 사용자 요청 — 그래프를 모듈/클래스/… 계층으로 파일 분할하고, 뷰어는 기본 모듈 뷰 → 모듈 더블클릭 시 클래스 뷰 하단 추가 → 다중 선택 병합(모듈 간 클래스 관계 포함) → 재더블클릭 선택 해제. 모듈→클래스 2단계 고정이 아닌 모든 노드가 하위 N개를 가질 수 있는 임의 깊이 확장 구조(메서드 레벨 포함).

**결정 포인트(사용자 확정)**: 참조는 나가는 방향만 소스 파일에(`refs:{to,comment}`, 단방향 한쪽·양방향 양쪽, 전 노드 동일 규칙) · 에이전트가 계층 트리를 직접 작성(코어는 검증만) · 뷰어는 임의 깊이 스택 패널 · 메서드 레벨 그래프까지 이번 범위 · 루트 파일 유지 + 서브디렉터리 미러 배치 · 미선택 대상 참조는 렌더 숨김.

**작업**:

- core: `graph.ts` 트리 프로토콜 재작성 — `coerceGraphLevelFile`(version:2·refs comment 필수·children 경로 안전·파일 내 id 유일), `loadGraphTree`(중첩 조립, 자식 누락 시 해당 노드만 children 생략), `collectGraphChildFiles`(도달 가능 순회), `isSafeChildPath`(traversal 차단). `sections` API 제거.
- persistence: `<base>-graph/` 경로 stageN 라우팅(stageSubdir), 회귀 시 루트 json + 서브디렉터리 `rm -r`, `promoteGraphTree`(도달 가능 파일만 복사 — 고아·잔여 자연 제외, 기존 대상 트리 삭제 후 작성).
- gate-server: 루트에서 트리 조립해 `/api/state` `artifacts[].graph.tree`(중첩 레벨)로 서빙.
- viewer: `lib/graphTree.js` 순수 로직(`refsToEdges` 가시 대상만·`toggleSelect`·`mergeChildLevels` 다중 선택 시 그룹 합성) + `GraphView.jsx` `LevelPanel` 재귀 드릴다운 + `GenericNode`(임의 레벨 폴백). `layoutGraph` 무변경(합성 섹션 재사용).
- prompts: Stage 2 designPrompt 트리 규약(3레벨: 모듈→클래스→메서드, id 유일·참조 규칙) 전면 갱신, Stage 3 선택 그래프 규약 갱신, Feedback `structure` 체크리스트 갱신.
- 테스트: 트리 파싱/조작/경로 안전·게이트 서빙(중첩 트리)·승격(자식 복사+고아 제외)·뷰어 로직(토글/병합/숨김/임의 깊이). 전체 109 pass. `bun run build` 통과 + 설치 확장 배포.

**여담**: pi-goal 드래프팅 게이트에서 사용자 그릴(인터뷰)로 결정한 사항들 — 공통 조상 엣지 저장·지연 로딩 등 대안은 배제(ponytail).

### Feedback 수준 명령(none|low|medium|high|ultra) ([[ADR-017-feedback-levels]])

**맥락**: 사용자 요청 — `/factorynote feedback <level>` 로 검토 강도 조절. none=피드백 없음(기존 Tier 0 동일), low=1개가 1~3 영역, medium=2~3개(현행), high=4~6개, ultra=9개. 라우터 호출 수 제한 시 3~4개씩 분할 재시도.

**작업**:

- core: `types.ts` 에 `FeedbackLevel` 타입 + spawn-feedback 지시문 `feedbackLevel` 필드. `orchestration.ts` 에 `FEEDBACK_LEVELS` 스펙·`feedbackLevelCountSpec` 문구·`nextDesignFeedbackStep`/`runDesignFeedbackLoop` 수준 파라미터(none → design 보고 직후 게이트 직행 전이).
- pi-extension: `index.ts` 에 `/factorynote feedback <level>` 세션 토글(기본 medium, 잘못된 값 거부) + PLAN_MODE_PROMPT 수준별 수·배치 분할 규칙 반영. `plan-tool.ts` 가 수준을 전이함수에 주입하고 spawn-feedback 지시문·메뉴 파일에 수 지시 + 리밋 실패 시 3-4개 순차 배치 분할 문구 기록('검토 요청' 경로 포함).
- 프로토콜: `packages/factorynote/orchestrator/README.md` 에 수준 표 + 호출 수 제한 대응 규칙.
- 테스트: 수준 스펙·none 전이·지시문 수준 운반·루프 none 직행(core) + drivePlan none 게이트 직행·high 4~6 지시·low 1개 지시(pi 어댑터). 전체 96 pass. `bun run build` 통과 + 설치 확장 배포.

**결정 포인트(사용자 확정)**: 세션 지속 토글 · none = 게이트 직행 + ADR 기록 · 실패 시 분할(평소 전량 병렬) · low = 기존 에이전트 1개가 1~3 영역(신규 범용 에이전트 없음) · 기본값 medium.

### 그래프 JSON 분리 + 렌더 통일 + 자동 배치 ([[ADR-016-graph-json-externalization]])

**맥락**: 사용자 요청 3종 — (1) 스테이지마다 문서 출력 방식이 다름(Stage 2 만 전용 에디터), (2) 그래프 노드 정보가 md 안에 인라인 임베드, (3) 수동 노드 드래그 배치의 겹침·모듈 경계 이탈.

**작업**:

- core: `graph.ts` 펜스 함수 제거 → `graphRefFile`·`graphJsonNameFor` 참조 프로토콜 추가. `persistence.stageSubdir` 가 동반 json 을 stageN/ 로 라우팅, `invalidateArtifactsAfter` 가 md+json 동반 삭제. `GateDecision.artifactMd` 제거. Stage 2·3 designPrompt 2파일 규약 + position 금지로 재작성.
- pi-extension: `plan-tool.promoteGraphArtifact` — 게이트 오픈 시 draft-graph.json 을 `stageN/<산출물>-graph.json` 으로 승격 + 참조 재작성. gate-server 가 `/api/state` artifacts[] 에 동반 json 파싱(`graph: {file, artifact}`) 포함, decision 의 artifactMd 파싱 제거. Feedback 과제·에이전트 파일이 `<!-- graph: -->` 참조 json 동반 검토 지시(gen-feedback-agents 재생성).
- viewer: `DesignStage.jsx`·`GraphEditor.jsx`·`designMd.js`·`graphNormalize.js` 삭제. App.jsx 스테이지 분기 제거(3단계 모두 PlanPage). `mdToBlocks` 가 `<!-- graph: -->` 코멘트 → graph 블록. 신규 `GraphView.jsx`(읽기 전용) + `layoutGraph.js`(layer·위상 행 + barycenter, 클래스 ⊂ 모듈 그룹, 겹침 0, 결정적).
- 테스트: layoutGraph(겹침 0·그룹 포함·결정성·position 무시) 10건, graph 참조 파싱, plan-tool 그래프 승격 종단, gate-server 그래프 서빙. 전체 89 pass. `bun run build` 통과 + 설치 확장 배포.
- 문서: ADR-016 신규, ADR-006·010 superseded, implementation-architecture·usage-guide·Changelog 갱신.

**결정 포인트(사용자 확정)**: 직접편집 완전 제거(채팅으로만 수정) · position 완전 제거 · layer·관계 방향 정돈 · 기존 펜스 폴백 없음(완전 제거).

**참고**: graph capability Feedback 에이전트의 edit 도구는 유지하되 지시를 '이슈 지적만'으로 변경(수정은 Design 재작성 담당).

### 단계 산출물 stageN/ 폴더 배치 ([[ADR-015-stage-artifact-folders]])

**맥락**: `<root>/<feature>/` 에 평평하게 쌓이던 단계 산출물을 단계별 폴더로 분리해 달라는 사용자 요청.
**변경**: `packages/factorynote/src/persistence.ts` — `artifactPath` 에 STAGES 파일명→`stageN/` 매핑(`stageSubdir`) 추가. 3개 단계 산출물은 `<feature>/stage1|stage2|stage3/` 로, 보조 파일(`state.json`·`design-prompt.md`·`feedback-menu.md`·`draft.md`·`feedback.md.*`)은 feature 루트 유지. 모든 경로가 `artifactPath` 로 수렴해 호출측(plan-tool·gate-server·invalidate) 무변경. 기존 평평 폴더 마이그레이션은 없음(resume 시 파일 없으면 `undefined` → 재생성).
**검증**: `bun test` 99 통과(레이아웃 자체체크 추가), `bun run build` 종료 0.

### 모듈화 리팩토링 — 기능별 단일 책임 모듈로 분해 (사용자 요청)

**맥락**: "이 프로젝트를 기능 별로 세세하게 분리해서 모듈화를 강하게" — 대형 파일을 단일 책임 단위로 분해하고, 분리 가능한 타입/인터페이스/컴포넌트를 추출. 응집도 원칙 기준(라인 이동이 아닌 책임 분해), 퍼블릭 export 자유 재구성(소비자 연결은 유지).

**변경**: 9개 대형 파일을 책임 단위 모듈로 분해(원본은 barrel·재수출 유지로 import 경로 불변).

- **코어**(`packages/factorynote/src/`):
  - `types.ts`(257줄) → `types/` 디렉토리 4모듈 — `gate.ts`(단계·판정·코멘트·채팅·이력), `feedback.ts`(스폰·예산·지시문 타입), `graph.ts`(계층 그래프 모델), `pipeline.ts`(영속 상태). `types/index.ts` barrel.
  - `orchestration.ts`(442줄) → `df-policy.ts`(수준 스펙·상한·스폰 옵션·입력 절단), `df-parse.ts`(parsing·집합), `df-task.ts`(과제 구성), `df-transition.ts`(전이 함수), `df-loop.ts`(동기 루프 드라이버).
  - `feedback-agents.ts`(292줄) → 역량별 데이터 분리 — `feedback-agents-static.ts`(24), `-web.ts`(5), `-graph.ts`(3), 레지스트리·메뉴는 원본 barrel.
  - `persistence.ts`(225줄) → `paths.ts`(경로 계산)·`state.ts`(원자적 상태·복구)·`artifact.ts`(산출물·그래프 승격·무효화).
- **어댑터**(`apps/pi-extension/src/`):
  - `plan-tool.ts`(540줄) → `plan-types.ts`(계약 타입)·`plan-paths.ts`(경로·메뉴·보고 파싱)·`plan-directive.ts`(스폰 지시)·`plan-gate.ts`(게이트 실행).
  - `gate-server.ts`(496줄) → `gate-events.ts`(이벤트 타입)·`viewer-state.ts`(상태 조립)·`gate-http.ts`(라우팅 핸들러)·`gate-manager.ts`(영속 서버 풀)·`gate-browser.ts`(브라우저·경로 유틸).
  - `index.ts`(275줄) → `command.ts`(명령·세션 상태)·`prompt.ts`(plan 모드 프롬프트)·`viewer.ts`(dist 탐색)·`format.ts`(반환 포맷).
- **뷰어**(`apps/plan-viewer/src/`):
  - `App.jsx`(245줄) → `components/Screens.jsx`(전환 화면)·`lib/notify.js`(알림 유틸) 분리.
  - `styles.css`(1639줄) → `styles/` 11개 기능 파일 — base·layout·blocks·gate·comment·markdown·stage3·graph·pages·editor·chat. 원본은 `@import` barrel.

**검증**: `bun test` 109 통과(0 fail), `bun run typecheck` 0, `bun run build` 0(뷰어 빌드 + 설치 배포). 퍼블릭 시그니처·동작 무변경(테스트 전체 통과로 확인).

## 2026-08-09

### 문서 정정: pi-subagents 사전요구 + install 경로 (사용성 버그)

**맥락**: “깨끗한 pi 하네스에서 서브 에이전트가 동작하나?” 질문으로 확인 — pi-subagents 가 pi 에 번들되지 않고 프로젝트가 설치해주지도 않는데 문서에 사전 요구로 없어, 사용자가 pi+Node+bun 만 갖추고 와서 “왜 안 되지?” 하는 문제.
**수정**: `usage-guide.md` 전제 조건에 **pi-subagents 확장**(subagent 도구·발견 제공, 별도 설치 필요) 추가 + 설치 단계에 에이전트 사용자 스코프 배포 기재. `README.md` 구경로 `bash scripts/install.sh` → `bun scripts/install.mjs` 정정(트리 포함).
**별도 발견(수정됨)**: `README.md` 가 **“6단계 파이프라인”**으로 서술돼 있었으나 실제는 [[ADR-008-3-stage-pipeline]] 로 **3단계**(요구사항·시나리오 / 설계 / 구현계획). Stage 1–6 표·“6단계 산출물” 문구를 3단계(요구사항·시나리오 / 설계(모듈·클래스) / 구현 계획)로 재작성·정정.

### install.mjs 에이전트 미배포 버그 수정 (Unknown agent 원인)

**증상**: 새 pi 세션에서 `factorynote-design`/`factorynote-feedback-*` 스폰 시 “Unknown agent”. `subagent list` 에 FactoryNote 에이전트 없음.
**원인**: `scripts/install.mjs` 가 (1) `apps/pi-extension/agents/` 를 설치 디렉토리로 복사하지 않고, (2) 배포용 `package.json` 에서 `pi-subagents.agents` 매니페스트를 누락. → 설치된 확장에 에이전트가 발견 안 됨. ADR-014 흐름 전체 차단. 테스트는 소스 검사라 미포횩.
**수정(2차, 실제 해결)**: 1차(에이전트 복사+매니페스트)로는 부족 — 조사 결과 **확장 `package.json` `pi-subagents.agents` 매니페스트는 pi-subagents 발견 메커니즘이 아님**(파일시스템 스코프만 발견; pi SDK `registerAgent` API 도 없음). `install.mjs` 가 에이전트를 **사용자 스코프** `~/.pi/agent/agents/`(전역 발견 위치)에 배포(stale `factorynote-*.md` 정리 후 복사, 타 에이전트 보존). `bun run build` 후 33개 배포·`Explore.md` 보존 확인. 새 세션에서 `factorynote-*` 가 `subagent list` 에 표시.

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
