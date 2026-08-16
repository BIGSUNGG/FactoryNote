---
updated: 2026-08-15
tags: [development, changelog]
---

# Changelog

FactoryNote의 주요 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 양식.
코드/기능 변경을 같은 세션에서 이 파일에 반영한다.

## [Unreleased]

### Added

- **파이프라인 상태·그래프 파서 거부 분기 자체체크 — `state.ts`·`graph.ts` 브랜치 커버리지 100%** — 기존 테스트가 안 때리던 방어 분기 보강: (1) `validateState` 가드 8건 — valid JSON 이지만 형태가 틀린 state(스칼라·null·feature 누락/숫자·stage 0/4/NaN·history 누락) → `loadState` 가 백업 후 undefined 로 복구하는지. 이 경로가 열려 있으면 stage 9 같은 불량 상태가 파이프라인에 그대로 적재된다. (2) `coerceRef`·`coerceNode` 거부 6건 — refs 항목 비객체·`refs[].to` 누락/빈값·노드 비객체·노드 id 누락/빈값 → 모두 throw. 스펙 지명 저커버리 영역(state.ts·graph.ts) 마무리. 하드닝 루프 이터레이션 6.

- **Stage Registry 불변식 자체체크 9건 — `stages.ts` 커버리지 66.67%→100%** — 전용 테스트 부재로 무방비하던 3단계 정의 테이블의 프로토콜 불변식 검증: 단계 id 1→3 순서, 산출물 markdown+kebab 파일명+단계 번호 접두 중복 없음, **그래프 의무(none/required/optional) — 게이트 분기의 원천 데이터 드리프트 방어**, Design 프롬프트 비었음 검사, Stage 2 프롬프트의 그래프 트리 규약(`"version":2`·`<!-- graph:`) 지시 확인, stageById/currentStageDef 조회 동일성·범위 밖 id 방어(런타임 StageId 위반). 하드닝 루프 이터레이션 5.

- **다음 단계 요청 채팅 강조 기록(pending→fulfilled) + 큐 재디자인** — '✓ 확정 → 다음 단계' 확인(마지막 단계 제외) 시, 단계 진행(`/api/decision`)은 종래대로 유지하되 추가로 'Stage N+1 진행 요청' 강조 메시지를 채팅 로그에 기록. `ChatMessage` 에 `kind:'stage-request'`·`status`·`targetStage` 선택 필드 추가(후방 호환). `App.onGate` 가 `verdict:'confirm'` 且 `stage<3` 일 때 `POST /api/decision` 외에 `POST /api/chat {kind:'stage-request', targetStage}` 도 전송 — 서버는 이 메시지를 `chatLog` 에 `status:'pending'` 으로 push 하되 `currentResolver`/`pendingChats` 미건드림(결정 채널로만 진행, 에이전트 미전달·취소 불가). 라이프사이클: 다음 단계 준비 중(`gateOpen=false`)엔 '전송 대기 중' 큐 영역에 강조(채운 액센트 배경 + ➡Stage 뱃지, ✕ 없음), `runGate` 시작(게이트 오픈, `onReady` 이전)이 `pending`→`fulfilled` 전환 → 채팅 본문에 강조 기록으로 자리잡음. 디자인: 단계 요청 `--primary` 채운 배경 + 10px 둥근 카드, 큐 아이템 점선→실선 둥근 카드·태그 pill 로 재디자인. 마지막 단계 확정·modify·revert 는 단계 요청 미생성, 일반 채팅 큐/취소([[ADR-024-chat-send-queue]]) 무변경. 신규 자체체크 4건(서버 stage-request 1 + 뷰어 pending/fulfilled 렌더 2 + App confirm POST 1). 자체체크 171 pass. [[ADR-025-stage-request-chat-record]]

- **게이트 채팅 전송 대기 큐(read-wins 취소)** — 에이전트가 응답 중(도구 호출 중, `runGate` 대기 아님)일 때 보낸 채팅을 `chatLog` 가 아닌 가시 대기 큐(`pendingChats`)에 적재. 뷰어 채팅 사이드바에 별도 **'전송 대기 중' 영역**이 표시되고 각 메시지를 ✕ 로 **전송 취소**(완전 삭제)할 수 있다. 에이전트가 응답을 마치고 `runGate` 에 재진입해 큐 메시지를 `chat` 이벤트로 넘기는 순간(= '읽기') `chatLog` 로 **승격**되어 일반 전송 메시지로 전환된다. 에이전트가 듣는 중(`runGate` 대기)에 보내면 종래대로 즉시 전송(큐 미경유). 전송 경로 분기는 `currentResolver` 유무로 판별. **read-wins**: 이미 넘겨진 메시지의 취소는 `POST /api/chat/cancel` 이 `{ok:false, reason:"already-sent"}` 로 거부(단일 스레드 불변조건 '큐에 없으면 이미 넘겨진 것'으로 보장). `GET /api/chat` 응답에 `queue` 배열 추가, SSE `chat` 이벤트를 적재·취소·승급 시점에 push. `makeGateHandler` 가 `broadcast` 를 주입받도록 시그니처 변경(`gate-http↔gate-manager` 순환 import 회피). 게이트 바 결정·에이전트→사용자 답변·코멘트/그래프는 무변경. 신규 자체체크 3건(서버 큐 라이프사이클 1 + 뷰어 큐 렌더·취소 2). 자체체크 167 pass. [[ADR-024-chat-send-queue]]

### Changed

- **`coerceNode` 속성 삭제(delete) 제거 — `graph.ts`** — `{...o}` 스프레드가 원시 `refs`·`children` 키를 끌고 온 뒤 `delete out.refs`·`delete out.children` 로 지우던 후처리를, rest 분해(`const { refs, children, ...rest } = o`)로 애초에 제외하는 구성으로 교체 — 검증을 거친 값만 노드에 담긴다는 의도가 코드에 직접 드러남(동작 불변, 불투명 표시 필드 보존 테스트 포함 전체 통과). pi-lens ast-grep:ts-delete-property 발견분. 하드닝 루프 이터레이션 10.

- **`runOpenGate` 결과 메시지 조립 추출 — `plan-gate.ts` 경고 0** — 게이트 결정 후 안내 메시지 합성(내부 에스컬레이션·FR-2 에스컬레이션·수정 요청·승인 4분기 + 코멘트 블록 + resume 접두)을 순수 함수 `gateOutcomeMessage()` 로 추출 — `runOpenGate` 사이클로매틱 복잡도 경고(22)·fan-out 경고(24) 소멸, 메시지 분기가 한 곳에 모임. 부수: `complete()` 의 `STAGES[2]!` non-null 단언을 `stageById(3).name` 로 교체(단언 제거, 불변 import 정리). pi-lens complexity·fan-out·no-non-null-assertion 발견분. 하드닝 루프 이터레이션 9.

- **`drivePlan` 그래프 강제 블록 추출 + async 노이즈 제거 — `plan-tool.ts`** — (1) Stage 2 그래프 강제(재작성 반려·상한 소진 에스컬레이션, ADR-019)를 모듈 함수 `enforceRequiredGraph()` 로 추출 — `drivePlan` 사이클로매틱 복잡도 경고(23) 소멸, 그래프 강제 정책이 한 곳에 모임. 동작 불변(그래프 반려·에스컬레이션 경로 테스트 그대로 통과). (2) `return await` 4건 제거 — 전부 try/catch 밖임을 확인해 의미 동일(불필요 마이크로태스크 틱 제거). pi-lens ast-grep·complexity 발견분. 하드닝 루프 이터레이션 8.

- **`gate-server.ts` 죽은 export 제거 + runGate·observeGate 공통 전주곡 추출** — (1) 무소비 재export 2건 삭제: `resolveViewerDist`(정의→재export→무소비 죽은 사슬, 함수 본체도 gate-browser.ts 에서 제거)·`GateEvent` 타입 재export(소비자는 전부 gate-events.ts 직접 import). (2) runGate·observeGate 가 동일하게 반복하던 ‘게이트 확보 + 조건부 브라우저 오픈(SSE 하트비트 판정)’ 17줄 블록을 `acquireGateAndMaybeOpen()` 헬퍼로 추출 — 열림 정책이 두 곳에서 따로 드리프트될 여지 제거, 각 함수는 자신이 쓰는 옵션만 구조분해. pi-lens knip·jscpd 발견분. 하드닝 루프 이터레이션 7.

- **코어 패키지 순환의존 해체 — `FeedbackAgent`/`FeedbackCapability` 타입을 `types/feedback.ts` 로 이동** — `feedback-agents.ts`(레지스트리) ↔ `feedback-agents-{static,web,graph}.ts`(데이터) 간 3건 순환 import(madge) 해소. 변형 3파일은 이제 타입을 `./types/feedback.ts` 에서 import(레지스트리 역참조 제거), `feedback-agents.ts` 는 공개 API 호환 재export 유지(`@factorynote/core` 표면 무변경). 런타임 사이클은 아니었지만(`import type` 은 소멸) 값 import 한 줄이면 즉시 TDZ 초기화 순서 결함으로 변하는 구조적 위험 제거. madge 전체 스캔 0 순환. 하드닝 루프 pi-lens full 진단 발견분.

- **큐 후속 UX 4건 — 1개씩 순서 전달·미리보기·취소 버튼 대비·게이트 바 대기 유지 ([[ADR-026-stage-request-queue-transit]] 개정)** — (1) `runGate` 드레인을 일괄 배출에서 **재진입마다 선두 1개만 전달**로 변경 — 대기 채팅 2개가 한 번에 배출되던 것을 각각 앞 응답 종료 후 하나씩 순서 실행. (2) 큐 대기 채팅 항목에 '대기' 태그 + **한 줄 미리보기**(첫 줄 ~40자 말줄임, `[blockId]` 표시) 추가 — 무엇이 대기 중인지 식별 가능(본문 전체는 전송 후 공개 유지). (3) stage-request 큐 카드의 ✕ 취소 버튼이 `--muted` 회색이라 `--primary` 배경에서 안 보이던 CSS 대비 문제 수정(`--on-color` 계열 + hover 처리). (4) 확정 요청 큐 대기 중 채팅 응답 루프로 게이트가 재오픈해도 게이트 바 로딩이 풀리던 문제 수정 — `App.stageQueued`(SSE chat 이벤트마다 `/api/chat` 큐 동기화)로 로딩 유지, 라벨 상황별('앞선 채팅 응답 후 진행…' / '다음 단계 작성 중…'), 실행 감지(gateOpen=false + 단계 진행) 시 pending 재설정. `GateBar.loadingLabel`·`PlanPage.loadingLabel` 전달 추가. 테스트: 서버 시나리오를 1개씩 전달(재진입 3회 각 1건 + 큐 감소 검증)로 갱신, 뷰어 미리보기·취소 호출 검증, App 로딩 유지 시나리오 추가. 자체체크 173 pass. [[ADR-026-stage-request-queue-transit]]

- **다음 단계 요청의 큐 경유(단일 채널 진행) — 응답 중 확정 드롭·큐 미표시 수정** — [[ADR-025-stage-request-chat-record]] 의 컴패니언 모델(기록 전용, `/api/decision` 즉시 진행)을 대체: 비최종 단계 확정은 `POST /api/chat {kind:'stage-request', targetStage, decision}` 하나로 표현되며 **채팅과 같은 `pendingChats` 큐의 마지막 칸에 적재**된다(`ChatMessage.decision` 신규 선택 필드가 실행될 `GateDecision` 운반). 게이트 열림+앞 대기 없음 → 즉시 `fulfilled` 기록 후 decision resolve(기존 체감 유지); 대기 채팅이 있으면 그 뒤에 순서 적재 → `runGate` 드레인이 선행 채팅만 `chat` 이벤트로 전달 → 선두 도달 시 `decision(confirm)` 으로 resolve. 이로써 응답 중(`currentResolver` null) 확정이 드롭되던 `r?.()` 버그가 구조적으로 제거됨. **확정 대기 중 채팅 거부**(`{ok:false, reason:'stage-request-pending'}`) + 뷰어 입력 잠금·안내 배너(`chat-lock-notice`), **대기 중 확정 요청도 ✕ 취소 허용**(read-wins). **큐 플레이스홀더** — 대기 채팅은 본문 미노출 '대기 중 · 채팅' 태그만 표시, 본문은 전송(승격) 후 공개. 최종(3단계) 확정·modify·revert 는 기존대로 `/api/decision`. 신규 자체체크: 서버 5단계 시나리오(순서 적재→채팅 거부→취소→재확정→드레인→decision 실행·코멘트 페이로드) + 즉시 resolve 2건, 뷰어 플레이스홀더·잠금 2건(갱신), App 채널 단일화 1건(갱신). 자체체크 172 pass. [[ADR-026-stage-request-queue-transit]]

- **단계 전환 UX — 대기 화면 제거 + 이전 단계 읽기 전용 보기 (F2)** — 두 가지 뷰어 동작 변경. (1) 확정/검토 요청 제출 후 기존에 전체 화면 '다음 준비 중'(`PreparingScreen`)으로 전환하던 것을 제거하고, 게이트 결정·검토 요청 중에도 기존 뷰어 페이지를 그대로 유지한 채 게이트 바의 확정 버튼이 로딩 연출(스피너 + '다음 단계 작성 중…', 액션 비활성)하도록 함. `App` 은 `gateOpen=false` 여도 `reviewing` 이면 페이지를 유지(`loading/pending` 시만 준비 화면), 게이트 재오픈 시 자동으로 다음 단계로 전환. `GateBar.loading` prop 추가. (2) 헤더 3단계 스테퍼에서 이전 단계를 클릭하면 해당 단계 산출물(승인된 이전 단계는 `state.artifacts` 에 이미 포함 — 데이터 변경 없음)을 **읽기 전용**으로 보기 — 코멘트 작성·채팅 입력·게이트(확정/수정/정정)가 모두 비활성(배너 + `readonly-banner`). `App.viewStage` 로 전환 제어, `PlanPage.readOnly` 가 코멘트 핸들러를 no-op 으로, `ChatSidebar.disabled` 가 입력을 잠금. '현재 단계로 돌아가기'로 복귀 시 재활성. 기존 정정(revert)과 무관. 신규 `App.test.jsx` 2건(페이지 유지+로딩 / 읽기 전용 전환) 포함. 자체체크 155 pass. [[ADR-023-viewer-transition-ux]]

- **뷰어 갱신 폴링 → SSE push 전환** — 뷰어가 `/api/state` 2초 폴링 + `/api/chat` 0.5초 폴링으로 갱신하던 것을 제거하고, 게이트 서버에 SSE(`/api/events`) 엔드포인트를 추가해 에이전트가 산출물을 기록하는 시점(산물 write + 게이트 오픈 = `runOpenGate`, 채팅 회신 = `appendAgentChat`)에만 push 갱신. `gate` 객체에 `sseClients: Set<ServerResponse>` 를 두고 `broadcastSse` 가 프레임 송신(실패 클라이언트 자동 제거). 뷰어는 단일 `EventSource` 로 `state`·`chat` 이벤트 수신. 탭 생존 하트비트(브라우저 재오픈 판정)는 SSE 연결 생존으로 흡수 — `runGate`/`observeGate` 재오픈 조건에 `sseClients.size === 0` 추가(SSE 클라이언트가 살아있으면 `lastSeen` 경과와 무관하게 재오픈 생략). core(`packages/factorynote`) 무변경 — 모든 `writeArtifact` 호출이 pi-extension 경로를 거치므로 트리거를 pi-extension 에 배치. `node:*` builtins 만 사용(`ws` 미도입). 회귀 테스트 추가(SSE broadcast · 하트비트 흡수). 자체체크 153 pass(신규 2). [[ADR-022-viewer-sse-push]]

### Fixed

- **뷰어 XSS — 산출물 마크다운 원시 HTML 실행(게이트 자동 확정 가능) 차단** — `mdToBlocks.js` 가 `MarkdownIt({html:true})` 로 산출물을 파싱, 변환 HTML 을 `Block.jsx` `dangerouslySetInnerHTML` 5곳에 주입 — 마크다운 내 원시 HTML(`<img onerror>` 등)이 게이트 페이지 오리진에서 그대로 실행되어 `POST /api/decision` 자동 확정, 즉 'AI 는 게이트를 못 넘긴다' 원칙 무력화가 가능했다(프롬프트 인젝션 → 외부 콘텐츠 인용 산출물 경로). `html:false` 전환으로 모든 원시 HTML 을 이스케이프 텍스트로 렌더(구조적 차단). 그래프 참조(`<!-- graph: ... -->`)는 `html:false` 에서 `html_block` 토큰이 사라지므로 문단 전체가 참조 코멼트일 때 그래프 블록으로 전환하는 감지로 이동(기존 그래프 테스트 3건 무변경 통과). 신규 회귀 3건(img onerror·script·제목 인라인 이스케이프). [[viewer-xss-gate-bypass]]

- **게이트 브라우저 오픈 명령어 주입 구조 제거(exec→spawn 인자 배열)** — `apps/pi-extension/src/gate-browser.ts` 의 `openBrowser` 가 플랫폼별 커맨드를 문자열 템플릿으로 조립해 `exec`(셸 경유)로 실행하던 것을, `spawn(커맨드, 인자 배열, shell:false)` 로 재작성 — URL 이 셸에 해석될 경로 자체를 제거(CWE-78 구조적 차단). URL 검증(localhost/127.0.0.1 전일치 정규식)은 유지, 플랫폼별 사양을 순수 함수 `browserCommand(platform, url)` 로 분리(중첩 삼항 제거·테스트 가능). 신규 자체체크 6건(플랫폼별 변환·외부 호스트·주입 페이로드 거부·인자 배열 보장). 오피니언 룰 잔여 경고는 근거 주석과 함께 인라인 억급. 자체체크 187 pass. 리포 전체 진단 스캔(pi-lens full)에서 발견된 유일 차단 오류.

- **테스트 뷰어(`bun run dev`)에서 큐 전체 무동작 — dev-mock 을 실서버 의미론으로 재작성** — vite dev-mock 미들웨어가 ADR-022(SSE)·ADR-024(큐)·ADR-026(stage-request) 이전 구형 프로토콜만 모방하고 있었다: GET /api/chat 에 `queue` 없음·POST 가 `kind:"stage-request"` 무시·`/api/chat/cancel` 부재(경로가 /api/chat prefix에 喫혀 무반응)·SSE `/api/events` 부재(회신·산출물 갱신이 화면에 안 뜸 — 스테일 “폴링 2s” 주석). 목업 로직을 순수 모듈 `apps/plan-viewer/dev/mock-api.js`로 추출해 실서버 의미론 그대로 재구현: idle 즉시 전달/바쁜 창(3초 가짜 회신) 큐 적재·회신 완료마다 선두 1개씩 드레인, stage-request 대기 채팅 뒤 적재·대기 중 채팅 거부(stage-request-pending)·이중 확정 거부(already-pending)·선두 도달 시 단계 진행+fulfilled 기록, cancel(already-sent read-wins), GET {messages,queue}. vite.config.js 는 미들웨어+SSE(/api/events, state·chat push)로 재구성하고 6단계 시절 데모 데이터(stages 1·2·5)를 3단계(1·2·3)로 정리. 마지막 단계 confirm → done(마감 화면). 자체체크 8건 신규(mock-api.test.js — 가짜 타이머로 6+2 동작 검증). 자체체크 181 pass. [[ADR-026-stage-request-queue-transit]]

- **읽기 전용 이전 단계 뷰 버그 2건 (F2 회귀)** — (1) 이전 단계로 전환 후 스테퍼에서 '실제 현재 단계'를 클릭해도 `.readonly-banner`(배너)가 사라지지 않던 문제: 스테퍼 클릭이 `setViewStage(단계번호)` 를 호출해 `viewStage !== null` 이 유지되며 readOnly 가 해제되지 않았음. `App` 의 `onSelectStage` 를 `n === state.stage ? setViewStage(null) : setViewStage(n)` 으로 매핑해 현재 단계 스테퍼 클릭 시 읽기 전용 해제(배너·게이트 바·채팅 재활성), '현재 단계로 돌아가기' 버튼과 동일 경로로 통일. (2) 이전 단계 읽기 전용으로 볼 때 이미 작성된 이후 단계들이 '아직 안 쓴 단계(잠금)'처럼 보이던 문제: 스테퍼 작성 여부를 현재 보고 있는 단계(curStage) 기준으로 잡던 것을 **실제 서버 단계(`activeStage`/state.stage) 기준**으로 분리(`PlanPage.stagesFor(viewed, real)` — `s.n > real`만 locked, `s.n === viewed`만 view/current, 그 외 작성됨='done` 선택 가능). 읽기 전용으로 이전 단계를 봐도 뒤의 실제 작성 단계는 '작성됨'으로 유지되어 헷갈림이 사라짐. 뷰어 전용 변경, 백엔드/core 무변경. 신규 강화 `App.test.jsx` 2건(스테퍼 복귀 시 배너 해제 / Stage 2에서 Stage 3만 locked) 포함. 자체체크 157 pass. [[ADR-023-viewer-transition-ux]]

- **채팅 수정 요청 게이트 깨짐 — gateOpen 상태의 designArtifact 재호출 미처리** — 채팅으로 산물 수정 요청이 들어와 에이전트가 재작성 후 `factorynote_plan(designArtifact[, chatResponse])` 로 재호출할 때, `drivePlan` 이 `gateOpen=true` + `designArtifact` 경로를 다루지 않고 폴백(spawn-design)으로 빠져 — 재작성 draft 가 스테이지 산출물로 반영되지도, 게이트가 갱신된 내용으로 다시 열리지도 않아(게이트가 닫힌 것처럼), 뷰어(`/api/state` 2초 폴링)도 갱신 없이 상호작용이 먹통이 되던 문제. `drivePlan` 에 “게이트 열린 상태 + designArtifact → 산물(draft.md) 반영 + `runOpenGate(resume=false)` 로 게이트 재오픈” 처리를 추가. 뷰어는 이미 폴링 중이므로 백엔드 수정만으로 갱신·상호작용 회복. 회귀 테스트 추가(gateOpen+designArtifact 재호출 시 산물 반영·게이트 유지·chatResponse 답변 push). 자체체크 151 pass. [[chat-rewrite-gate-reopen]]

- **게이트 채팅 루프 끊김 — chatPending 수신 후 에이전트 턴 종료** — 웹 게이트 채팅으로 질문/수정 요청이 들어와 `factorynote_plan` 이 `chatPending` 을 반환하면 에이전트가 `factorynote_plan(chatResponse)` 로 재호출해 게이트를 유지해야 하나, 턴을 종료해버려 답변이 돌아오지 않던 문제("하네스에서 채팅이 끝남"). `formatForAgent` 의 채팅 블록을 본문 상단으로 올려 “턴 종료 금지 + `factorynote_plan(chatResponse)` 재호출”을 명령형으로 지시하고, `factorynote_plan` `promptGuidelines` 에도 chatPending 시 재호출 의무를 명시. 게이트 서버 재진입 로직은 이미 `gate-server.test.ts` 로 검증돼 무변경. 회귀 테스트 2건 추가(format 지시문 + chatResponse 재진입 시 agent 답변 chatLog push·게이트 유지). 자체체크 150 pass. [[chat-loop-reentry]]

- **그래프 쇼케이스 미출력 — 낡은 뷰어 dist 서빙** — `bun repro-graph-kinds.mjs` 실행 시 그래프 블록 자리는 나오나 "그래프 데이터(...)를 찾을 수 없습니다" 빈 상태만 표시되던 문제. `/api/state` 는 4종 그래프를 정상 내려줬으나(curl 확인), 서빙된 dist 가 다중 그래프 API(`artifacts[].graphs`) 이전의 단일 API(`artifact.graph`) 를 소비하도록 빌드된 구 버전이라 `graphData={}` 가 된 것이 원인. `ensure-viewer-dist.ts` 를 staleness 인식으로 일반화(dist 가 없거나 소스보다 낡으면 vite 재빌드, 순결정 `viewerDistIsStale` 분리) 하고, repro 가 서빙 전 이를 import 해 항상 최신 dist 를 보장하게 수정. 백엔드·코어 무변경. 자체체크 140 pass(신규 4). [[graph-showcase-stale-dist]]

### Added

- **그래프 종류 확장 — Sequence 다이어그램 · Flowchart** — 그래프 파일 envelope 에 `type` 필드로 종류 판별(type 없음 = 기존 계층 트리, 무변경 호환). sequence: `{version:2, type:"sequence", participants, body}` — 메시지 `{from,to,label,kind?}` + alt/loop/opt fragment(중첩, 메시지와 fragment 판별은 `body` 배열 존재 여부). flowchart: `{version:2, type:"flowchart", nodes:[{id,label,shape?}], edges:[{from,to,label?}]}`. 둘 다 단일 파일(자식 트리 없음 — 승격 경로 무변경). 렌더러는 읽기 전용 SVG 신규 2종(SequenceView: 참여자 컬럼·시간축 화살표·fragment 구간 박스 / FlowchartView: Kahn 랭크 + barycenter 자동 배치·shape 구분·백엣지 점선), 배치 순수 함수 분리·결정적·노드 겹침 0·좌표 필드 금지. `checkRequiredGraph` 종류 무관 유효 그래프 1개 이상, 서빙 `graphs[].{file,type,data}`, 뷰어 블록 타입 분기. 3단계 모두 허용. 자체체크 142 pass. [[ADR-021-sequence-flowchart-graphs]]

### Added

- **산출물당 다중 그래프 + 에이전트 자유 네이밍** — md 안 `<!-- graph: <루트 json 파일명> -->` 참조를 여러 개 허용하고, 루트 json 이름을 에이전트가 내용에 맞게 자유롭게 짓는다(자식 폴더는 루트 이름에서 `.json` 뺀 값으로 파생 규칙 유지, 같은 산출물 내 이름 유일·`.json` 끝 단일 파일명 강제). 승격은 에이전트 이름 그대로 `stageN/` 에 — 고정 이름 rename·md 참조 재작성 폐지(`graphJsonNameFor` 제거, `paths.ts` 이름 추론 라우팅을 `stageN/` 명시 접두 통과로 교체). 서빙은 참조별 트리 배열(`artifacts[].graphs`), 뷰어는 각 참조 위치에 인라인 블록 렌더. `checkRequiredGraph` 는 Stage 2 에서 참조 1개 이상 + 각 파일 존재·유효 + 이름 유일을 구분 메시지로 검증(상한 없음). 회귀 무효화는 md 참조를 읽고 동반 트리 삭제. 기존 고정 이름 산출물 무변경 호환. 자체체크 122 pass. [[ADR-020-multi-named-graphs]]

### Added

- **Stage 2 그래프 필수 강제 + 단계별 스폰 명령 분기** — `StageDefinition.graph: "none"|"optional"|"required"` 필드로 단계별 그래프 의무를 선언(Stage 1 없음 · Stage 2 필수 · Stage 3 선택)하고, `designTask`·`designRevisionTask` 스폰 명령이 이 필드로 분기한다. Stage 2는 프롬프트 요청에 그치지 않고 코드로 강제: `checkRequiredGraph` 가 design 보고 시 md 의 `<!-- graph: ... -->` 참조 + 루트 json 존재 + `version:2` envelope 파싱을 검증해, 미충족이면 Feedback 스폰 전에 재작성 지시(dfLoop 소진 시 게이트 에스컬레이션). 자체체크 112 pass. [[ADR-019-stage-2-graph-required]].

### Changed

- **모듈화 리팩토링 — 기능별 단일 책임 모듈로 분해** — 9개 대형 파일을 책임 단위로 분해(원본은 barrel·재수출로 축소, import 경로·퍼블릭 API 불변). 코어: `types.ts` → `types/`(gate·feedback·graph·pipeline), `orchestration.ts` → `df-policy/parse/task/transition/loop`, `feedback-agents.ts` → 역량별 데이터(static·web·graph), `persistence.ts` → `paths/state/artifact`. 어댑터: `plan-tool.ts` → `plan-types/paths/directive/gate`, `gate-server.ts` → `gate-events/viewer-state/http/manager/browser`, `index.ts` → `command/prompt/viewer/format`. 뷰어: `App.jsx` → `Screens.jsx`·`lib/notify.js`, `styles.css`(1,639줄) → `styles/` 기능별 11파일 + `@import` barrel. 검증: `bun test` 109 통과, `bun run build` 0 종료.

### Fixed

- **그래프 드릴다운 미출력 — ReactFlow v11 노드 `pointer-events: none` 주입 차단** — 게이트 뷰어에서 모듈 노드 더블클릭이 무반응이던 문제. ReactFlow v11 은 클릭 계열 핸들러(`onClick`/`onMouseEnter`…)가 하나도 없고 selectable·draggable 이 아니면 노드 wrapper 에 인라인 `pointer-events: none` 을 주입하는데, 읽기 전용 GraphView 는 `onNodeDoubleClick` 만 전달하고 있었고 `onDoubleClick` 은 그 조건에 없어 히트테스팅에서 노드가 사라졌다. `GraphView.jsx` 에 의도적 no-op `onNodeClick` 1줄로 해결(CSS 해킹 대신). 회귀 체크: `GraphView.test.jsx`(happy-dom, 인라인 pointerEvents 가드 포함, 3건) + `bun repro-drilldown.mjs`(실제 Chrome headless CDP 로 게이트 페이지 재현·더블클릭 검증). 자체체크 117 pass. [[graph-drilldown-pointer-events]]

- **그래프 미출력 — 낡은 `design-prompt.md` 주입 차단 + 참조 규약 위반 진단** — 게이트 전이(confirm/modify/revert) 직후 다음 단계의 `design-prompt.md`·`feedback-menu.md` 를 즉시 기록(`plan-gate.ts`)하고, `drivePlan` 의 지시 파일 기록을 그래프 검증·반려 앞으로 이동(`plan-tool.ts`) — 전이 직후·반환 라운드 재작성 자식이 이전 단계의 낡은 지시를 읽어 그래프 프로토콜([[ADR-018-hierarchical-graph-tree]])에서 이탈하던 사고 차단. `checkRequiredGraph` 가 참조 코멘트에 경로 포함 등 규약 위반을 "참조 없음"과 구분해 안내. 자체체크 114 pass. [[graph-output-stale-design-prompt]]

### Added

- **계층 그래프 트리 + 임의 깊이 드릴다운 뷰어** — 그래프 산출물을 단일 파일(`sections`)에서 계층 파일 트리로 재구조화: 루트 `<산출물>-graph.json`(md `<!-- graph: -->` 참조 불변) + `<산출물>-graph/` 서브디렉터리에 자식이 있는 노드마다 파일 1개(임의 깊이). 레벨 파일 공통 형태 `{version:2, id?, title?, childLevel?, nodes}`, 노드는 `{id, ...표시 필드, refs?, children?}`. 관계는 `refs:[{to,comment}]` **나가는 방향만 소스 노드 파일에**(단방향 한쪽·양방향 양쪽, comment 필수). 뷰어는 루트 레벨(모듈 관계도) 기본 표시 → 자식이 있는 노드 더블클릭 시 하단에 자식 레벨 패널 스택, 재더블클릭 선택 해제(토글), 다중 선택 시 병합(부모 그룹 합성·크로스 참조 표시·미선택 영역 참조 숨김), module→class→method 임의 깊이 동일 로직(`LevelPanel` 재귀). 코어 `graph.ts` 트리 프로토콜 재작성(`coerceGraphLevelFile`·`loadGraphTree`·`collectGraphChildFiles`·경로 안전), `persistence.ts` 트리 라우팅·회귀 삭제·`promoteGraphTree`(도달 가능 파일만 승격, 고아 제외), 게이트 서버 `artifacts[].graph.tree` 중첩 서빙, Stage 2·3 designPrompt·Feedback structure 체크리스트 갱신. 구 `sections` 포맷 호환 없음. 자체체크 109 pass. [[ADR-018-hierarchical-graph-tree]] ([[ADR-016-graph-json-externalization]] 확장).

- **Feedback 수준 명령 `/factorynote feedback (none|low|medium|high|ultra)`** — 내부 Design↔Feedback 루프의 검토 강도를 세션 토글로 조절(`auto`와 동일 패턴, 기본 `medium`). 수준별 Feedback 자식 수: none = 0(Feedback 루프 스킵, Design 산출물 게이트 직행 — 폐지됐던 Tier 0의 opt-in 부활), low = 1개(1~3개 영역 담당), medium = 2~3개(현행), high = 4~6개, ultra = 9개. 수 스펙(`FEEDBACK_LEVELS`)은 core 소유·`nextDesignFeedbackStep` 전이가 none 처리, 수준은 spawn-feedback 지시문·메뉴 파일·PLAN_MODE_PROMPT 에 실린다. 병렬 스폰이 라우터 호출 수/레이트 리밋 에러로 실패하면 3~4개씩 순차 배치로 분할 재시도(프로토콜 규칙). 게이트 통제(5대 원칙)는 수준과 무관하게 유지. [[ADR-017-feedback-levels]].

### Changed

- **그래프 JSON 외부 파일화 + 전 단계 동일 문서 렌더 + 자동 배치** — (1) 3단계 모두 동일한 문서 렌더 경로(`PlanPage`: TOC + 본문 + 블록/영역 코멘트)로 통일. Stage 2 전용 에디터(`DesignStage.jsx`)·인라인 그래프 에디터(`GraphEditor.jsx`)·펜스 파서(`designMd.js`·core `parse/serialize/applyStructureToMarkdown`)·게이트 `artifactMd` 역동기화 경로 제거. 그래프는 문서 속 읽기 전용 자동 배치 블록(`GraphView.jsx`)으로 렌더되고 모든 수정은 에이전트 채팅으로. (2) 그래프 노드·관계 데이터는 산출물 md 옆 `stageN/<산출물>-graph.json` 에 저장, md 는 `<!-- graph: <파일명> -->` 참조만 보유(draft 단계도 동일 규약, 게이트 오픈 시 승격·참조 재작성, 회귀 시 동반 삭제). `position`·`width`·`height` 필드 금지. (3) 뷰어 `layoutGraph.js` 결정적 자동 배치: layer·관계 방향 행 + barycenter 정돈, 클래스는 모듈 그룹 경계 내부, 노드·그룹 겹침 0(자체 테스트 가드). Stage 2·3 designPrompt·Feedback 에이전트 지시 갱신. 기존 펜스 폴백 없음. [[ADR-016-graph-json-externalization]] ([[ADR-006-graph-editor]]·[[ADR-010-md-design-stage]] 대체).

- **단계 산출물 `stageN/` 서브폴더 배치** — 3개 단계 산출물(`01-understanding-and-scenarios.md`, `02-design.md`, `03-implementation-plan.md`)이 feature 폴더 평평한 위치 대신 `<root>/<feature>/stageN/` 서브폴더에 작성된다. `state.json` 과 보조 파일(`design-prompt.md`·`feedback-menu.md`·`draft.md`·`feedback.md.*`)은 feature 루트 유지. `persistence.ts` 의 `artifactPath` 한 지점(STAGES 파일명→stageN 매핑)에서 처리 — 읽기·쓰기·무효화·게이트 서빙 전부 동일 함수 경유라 호출측 변경 없음. 기존 평평 폴더는 마이그레이션하지 않음(resume 시 정상 처리). [[ADR-015-stage-artifact-folders]].

- **동적 feedback 에이전트(레지스트리 + Director 선택)** — 단계별 고정 `feedbackAxes`를 폐지하고 전역 `FEEDBACK_AGENTS` 레지스트리(~32 전문 에이전트, 역량 태그 static/web/graph)로 이관. `factorynote_plan`이 현 단계 메뉴를 파일(`feedback-menu.md`)로 쓰고 Director가 상황에 맞는 N개를 추려 병렬(`runs.all`) 스폰. `scripts/gen-feedback-agents.mjs`가 레지스트리에서 에이전트 파일 생성(단일 진실, 드리프트 방지). 역량별 도구: static=read/write/bash, web=+web_search(security/feasibility/compliance/technology-fit/library-deps), graph=+edit(structure/dependency-cycle/dependency-precedence, 그래프 JSON 구조 검토 — 직접 수정 금지). [[ADR-014-dynamic-feedback-agents]].

- **병렬 Feedback 팬아웃 파이프라인(Design→병렬 Feedback→조건부 수정→게이트)** — 내부 Design↔Feedback 루프(단일 Feedback·`MAX_DESIGN_FEEDBACK_LOOPS=3` 머신 루프)를 축별 병렬 팬아웃으로 전면 교체. `StageDefinition.feedbackChecklist:string[]` → `feedbackAxes:FeedbackAxis[]`(단계별 의미 축: Stage1 논리/완전성/모호성, Stage2 보안/확장성/구조, Stage3 정확성/실현가능성/리스크). Design 1회 → 축별 Feedback N개 **병렬**(Director 가 `subagent` `workflowScript runs.all` 로 동시 스폰) → 전 축 CLEAN 시 게이트, 이슈 시 **1회 합성 수정** 후 게이트. 기본 사이클=`DEFAULT_MAX_LOOPS=1`(파라미터화). 게이트에 **“검토 요청” 버튼** 추가 — 열린 게이트에서 +1 사이클(병렬 feedback + 조건부 수정)을 런타임 강제(새 `GateEvent {kind:"review-request"}` + `POST /api/review-request`). `nextDesignFeedbackStep` 전이 재설계; `parseFeedbackBatch` 축별 집합 보고 파싱. [[ADR-013-parallel-feedback-pipeline]].

- **자식 도구 allowlist 전환(`toolBudget.block` 폐지)** — 오케스트레이션 자식 스폰의 `1261 Prompt exceeds max length` 원인 분석 결과, [[ADR-010-context-overflow-file-protocol]] 의 `toolBudgetBlock` 가 시스템 프롬프트에서 도구를 제거하지 못함(런타임 카운트 게이트일 뿐, `hard` 누락으로 무효)이 확인되어 도구 제거 수단을 교체. `apps/pi-extension/agents/factorynote-{design,feedback}.md` 명명 에이전트를 `tools:` 엄격 allowlist(`read, write, edit, bash`)로 도입 + `package.json` `pi-subagents.agents` 매니페스트 선언 → 자식 시스템 프롬프트에서 heavy 도구 스키마(context-mode·pi-lens·subagent·mcp·`factorynote_plan`) 물리 제거. `SpawnOptions` 를 `agentName` + `toolBudget{hard,soft}` + `turnBudget{maxTurns}` 로 재설계(`CHILD_SPAWN_OPTIONS` 역할별 맵). `clampReportInput` 가드로 자식 보고 과대 입력(>4000자) 절단(Director 누적 방어, ADR-010 후속 이행). [[ADR-012-child-tool-allowlist-spawn]].

- **`install.sh` → `install.mjs`(순수 Node)** — 배포 스크립트를 bash 에서 순수 Node(`scripts/install.mjs`)로 이식. Windows 에서 `bun run build` 의 마지막 단계 `bash scripts/install.sh` 가 WRL bash 로 해석돼 `execvpe(/bin/bash) failed`(WSL 배포판 없음)로 즉는 빌드 실패 수정. `package.json` build/deploy 가 `bun scripts/install.mjs` 로 전환. `node:fs`/`node:os` 만 사용해 Windows/macOS/Linux 동일 동작, bash/WSL/Git Bash 의존 제거(`bin/factorynote.mjs` 와 동일한 순수 Node ESM 컨벤션). 구 `install.sh` 삭제(단일 진실, 드리프트 방지).

- **코멘트 → 실시간 채팅 통합** — 블록/셀/영역 코멘트(`PlanPage`)와 그래프 코멘트(`DesignStage`)를 로컬 큐 적재가 아닌 즉시 `POST /api/chat`(blockId/node 스코프)로 전송. 코멘트가 채팅 메시지(`role:"user"`)로 표시되며 기존 `chatPending` 루프로 에이전트에 즉시 전달(게이트 유지). [[ADR-011-comment-to-chat-consolidation]].

### Removed

- **단계별 `feedbackAxes` 고정 선택 + 공용 `factorynote-feedback`** — 정적 축 세트·단일 공용 에이전트 폐지(전문 에이전트 + Director 동적 선택으로 대체). `feedbackBatchTasks`/`feedbackAxisTask` → `feedbackAgentTask`+메뉴 기반으로 대체. [[ADR-014-dynamic-feedback-agents]].

- **단일 Feedback 루프·머신 에스컬레이션** — `MAX_DESIGN_FEEDBACK_LOOPS` 상수·`dfLoop` 머신 증분·cap-도달 에스컬레이션(구 내부 루프 잔재) 제거. `feedbackTask`(단일) → `feedbackBatchTasks`/`feedbackAxisTask`(축별)로 대체. `DesignFeedbackDirective` 의 `spawn-feedback` 가 단일 `task` → `tasks:{axis,task}[]`(병렬 배치)로 변경. [[ADR-013-parallel-feedback-pipeline]].

- **SidePanel 검토 패널 전체** — `PlanPage` 우측의 검토 코멘트 큐 + Design↔Feedback 루프 + Feedback 이슈 + 어노테이션 제거. 검토 레이아웃이 [문서 | 채팅] 2단으로 단순화. `SidePanel.jsx` 삭제.
- **"✎ 수정 지시" 게이트 버튼** — 공용 `GateBar`에서 제거(확정·정정은 유지). 코멘트가 채팅으로 즉시 전달되므로 일괄 modify 트리거 불필요. `PlanPage`/`DesignStage` 의 `sendModify`/`submit("modify")` 경로 제거.
- **데드 코드 정리(감사)** — `GraphStage.jsx`(bc674f6 의 GraphStage→DesignStage 교체 시 미삭제 잔류; 미사용 + 제거된 `pendingCount` prop 참조) 삭제. 제거된 SidePanel/apply-badge 의 죽은 CSS(`.apply-badge`·`.review-comments`·`.review-comment`·`.rc-target`·`.count`·그룹 선택자의 `.rc-quote`) 제거.

### Fixed

- **`install.mjs` 에이전트·매니페스트 미배포(“Unknown agent”) — `scripts/install.mjs` 가 `apps/pi-extension/agents/`(Design + 전문 Feedback 32개)를 설치 디렉토리로 복사하지 않고, 배포용 `package.json` 에서도 `pi-subagents.agents` 매니페스트를 누락했던 것 수정. 결과적으로 설치된 확장(~/.pi/agent/extensions/factorynote)에 에이전트가 전혀 발견되지 않아 `factorynote-design`/`factorynote-feedback-*` 스폰 시 “Unknown agent” 로 즉는 현상(ADR-014 흐름 전체 차단). 1차 시도(에이전트 디렉토리 복사 + 확장 `package.json` `pi-subagents.agents` 매니페스트)로는 부족함이 확인 — **확장 package.json 매니페스트는 pi-subagents 발견 메커니즘이 아님**(pi-subagents 는 파일시스템 스코프만 발견; pi SDK 에 `registerAgent` API 도 없음). **실제 수정**: `install.mjs` 가 에이전트를 **사용자 스코프**(`~/.pi/agent/agents/`, pi-subagents 실제 발견 위치·전역)에 배포(stale `factorynote-*.md` 정리 후 복사, 타 에이전트는 보존). 새 pi 세션에서 `factorynote-*` 33개가 `subagent list` 에 표시. [[ADR-014-dynamic-feedback-agents]].

- **`GraphEditor.jsx` 머지 유실 복구** — `develop` 트리에서 `apps/plan-viewer/src/components/GraphEditor.jsx` 가 빠져 `bun run build` 가 `Could not resolve "./GraphEditor" from Block.jsx` 로 즉는 현상. 이 파일은 `1bc204c`(graph 통합)에서 `GraphStage.jsx → GraphEditor.jsx` rename 으로 생성됐으나 이후 머지(`490fdb0 Merge feature/graph`) 과정에서 트리에서 떨어짐. `git checkout 1bc204c -- apps/plan-viewer/src/components/GraphEditor.jsx` 로 복구. 이 파일은 Stage 2 설계 md 의 ```factorynote-graph 펜스를 인터랙티브 에디터로 렌더하는 핵심 컴포넌트(없으면 설계 산출물이 게이트에서 빈 칸)이므로 import 제거가 아닌 복구가 정답.
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
- **auto-advance 모드(게이트 자동 승인)** — `/factorynote auto [on|off]` 서브커맨드로 3단계 게이트를 자동 승인한다. 기본 OFF. ON 시 `drivePlan` 이 매 단계 게이트의 사용자 결정 블로킹 대기를 하지 않고 즉시 `confirm` 반환하되, **관찰용**으로 게이트 서버+브라우저는 열어 3단계 산출물 진행을 실시간 관찰 가능하게 한다(새 `observeGate` 헬퍼, `runGate` 와 별개 export). 개발/데모/빠른 프로토타입용 탈출구(escape hatch) — 5대 원칙을 의도적 우회하므로 프로덕션 계획에는 비권장. `planMode` 와 동일한 세션 메모리, 파이프라인 완료 시 자동 해제(#5). 계층: pi-adapter(`index.ts`·`plan-tool.ts`·`gate-server.ts`)에 한정, `@factorynote/core` 미변경. 자체체크 53건 green(`bun run build`·`bun test` 0 종료).
- **오케스트레이션 컨텍스트 한도(1261) 구조적 해소 — 파일 경로 산출물 교환 + 자식 스폰 컨텍스트 제약** ([[ADR-010-context-overflow-file-protocol]]) — GLM-5.2(기본 202K) 오케스트레이션 중 `1261 Prompt exceeds max length` 원인(Director 영구 에이전트 컨텍스트 누적 + 자식 고정 세금·fork 상속)을 구조적으로 제거.
  - 코어(`packages/factorynote/src`): `SpawnOptions`(`skill:false`·`context:"fresh"`·`toolBudgetBlock`) + `ArtifactPaths` 타입. 모든 spawn 지시문이 `spawnOptions` carry. `nextDesignFeedbackStep(..., paths?)` 옵셔널 `paths` — 파일 프로토콜(pi) / inline(동기 목 루프) 양립. `designTask`/`feedbackTask`/`designRevisionTask` 가 paths 제공 시 파일 경로 참조(본문 無). `CHILD_SPAWN_OPTIONS` 상수.
  - Pi 확장(`apps/pi-extension/src`): `drivePlan` 이 designPrompt(불변)·draft·feedback 파일 경로를 계산(`resolvePaths`)·기록, `nextDesignFeedbackStep` 에 paths 주입, 게이트 직전 `readArtifact` 로 경로→내용 resolve. `DrivePlanOutput`·`AgentOut` 에 `spawnOptions`·`draftPath`·`feedbackPath` 노출. `PLAN_MODE_PROMPT` 를 파일 프로토콜(Director 가 스폰 옵션 적용·자식은 파일에 쓰고 경로/판정만 보고)로 재작성.
  - 자체체크 71건 green(orchestration paths·spawnOptions 5건 + drivePlan 파일 프로토콜 종단간 갱신). `bun run build`/`bun test` 0 종료.

- **Tier 1 에이전트 오케스트레이션 도입 — Tier 0·NFR-7 폐지** ([[ADR-009-tier-1-agent-orchestration]]) — 산출물이 항상 Design 자식 → Feedback 자식 루프를 거쳐 사용자 게이트로 가도록, 단일 에이전트 인라인 자기검토(Tier 0) 경로를 제거하고 오케스트레이션을 유일 경로로.
  - 코어(`packages/factorynote/src`): `AgentSpawn` 인터페이스 + 순수 전이 `nextDesignFeedbackStep` + 동기 루프 드라이버 `runDesignFeedbackLoop(spawn)`(신규 `orchestration.ts`). 내부 Design↔Feedback 루프 상한(`MAX_DESIGN_FEEDBACK_LOOPS`=3) + FR-2 에스컬레이션(잔존 이슈 노출). `PipelineState`에 `dfPhase`/`dfLoop` 추가(구 state.json 마이그레이션 포함).
  - Pi 확장(`apps/pi-extension/src`): `factorynote_plan`이 단계 지시문(`spawn-design`/`spawn-feedback`+`spawnTask`) 반환 → Director 에이전트가 `subagent` 도구로 자식 스폰, 결과를 `designArtifact`/`feedbackResult`로 보고(pi는 확장 코드 직접 스폰 불가 → 에이전트 매개). `PLAN_MODE_PROMPT` 를 Tier 1 절차로 재작성.
  - NFR-7(Tier 0 보장) 폐지 — 이제 서브에이전트 스폰이 가능한 환경이 필요.
  - 자체체크 65건 green(orchestration 전이 12건 + drivePlan Tier 1 종단간 갱신). `bun run build`/`bun test` 0 종료.

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

- **3단계 산출물·렌더링 통일(md + 내장 그래프)** — Stage 2만 별도 `.json` 그래프 단독 렌더링이던 모델을, **3단계 모두 단일 `.md`(서사 + 선택적 내장 그래프)** 로 통일. Stage 2에서 그래프는 정상이나 나머지 텍스트가 1·3과 다르게 출력되는 문제 해결.
  - 산출물 모델: 그래프는 md 내 ` ```factorynote-graph ` 펜스에 `{sections:[{id,title,nodes,edges}]}` JSON 으로 내장. `ArtifactFormat` → `"markdown"` 단일(Stage 2 `02-design.json` → `02-design.md`). `GateDecision.graphSections` 제거 → `md`(사용자 편집 전체 md) 채택으로 교체.
  - 코어(`stages.ts`·`types.ts`): 3단계 모두 `format:"markdown"`. Stage 2 designPrompt 가 모듈 관계도 + 클래스 구조도를 **적극적으로** 펜스로 내장하도록 재작성(필수); Stage 1·3은 도움될 때만(선택).
  - 뷰어(`App.jsx`): `state.stage === 2` 하드코딩 라우팅(`isGraph`) 제거 → 모든 단계가 하나의 `PlanPage` 에서 md 텍스트 블록 + 인라인 그래프 에디터를 같은 경로로 렌더. `GraphStage.jsx` → `GraphEditor.jsx`(페이지 크롬·게이트 제출 제거, `sections` 변경 시 `onChange` 로 직렬화)로 추출·재명명.
  - 왕복 직렬화: `mdToBlocks.js` 가 `factorynote-graph` 펜스를 `{type:"graph", fenceIndex, sections}` 블록으로 파싱; 신규 `replaceGraphFence(md, fenceIndex, json)` 가 해당 펜스만 갱신(나머지 md 바이트 불변). 그래프 편집 → `decision.md` 로 제출 → `plan-tool` 이 산출물로 채택.
  - `gate-server.ts`·`plan-tool.ts`: 그래프 `.json` 개별 산출물·`graphSections` 채택 분기 제거 → md 단일 산출물. `decision.md` 채택 저장.
  - 자체체크 57건(`mdToBlocks` 펜스 인식 + md↔그래프 왕복 idempotent 5건 추가, 구 그래프 JSON 테스트 md 모델로 갱신) green. `bun run build`/`bun test` 0 종료. `vite build`(뷰어) 0 종료.

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
