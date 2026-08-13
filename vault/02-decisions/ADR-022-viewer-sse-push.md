---
status: accepted
updated: 2026-08-13
tags: [adr, viewer, gate, sse]
---

# ADR-022: 뷰어 갱신 — 폴링을 SSE push 로 전환

## 상태

accepted

## 날짜

2026-08-13

## 맥락 (Context)

뷰어(React SPA)는 게이트 서버의 `/api/state` 를 2초 간격, `/api/chat` 을 0.5초 간격으로 폴링해 산출물·게이트 전환·채팅 회신을 갱신해 왔다. 이 폴링은 두 가지 역할을 동시에 수행했다:

1. **md 산출물·게이트 상태 갱신** — 서버는 매 `/api/state` 요청마다 디스크에서 `readArtifact` 로 md 를 재조회(캐시 없음, `Cache-Control: no-store`).
2. **탭 생존 하트비트** — `gate.lastSeen` 을 매 요청마다 갱신하고, `BROWSER_REOPEN_AFTER_MS(5s)` 이상 요청이 없으면 탭이 닫힌 것으로 보고 다음 게이트에서 브라우저를 재오픈.

문제: 에이전트가 산출물을 기록한 시점과 무관하게 일정 주기로만 갱신되므로, (a) 최대 2초 지연, (b) 변경이 없어도 매 2초 디스크 재조회, (c) 채팅은 0.5초 폴링으로 잦은 요청. 사용자 요청 — "에이전트가 md 를 기록한 타이밍에만 갱신" (이벤트 기반 push).

제약: `gate-http.ts`·`gate-server.ts`·`gate-manager.ts` 는 `node:*` builtins 만 사용(런타임 npm 의존 0). core(`packages/factorynote`)는 harness-agnostic 이므로 pi-extension 서버를 모른다.

## 결정 (Decision)

폴링을 제거하고 **SSE(Server-Sent Events, `/api/events`)** 로 전환한다. 에이전트가 산출물을 기록하는 두 시점에만 push 한다:

- **산출물 write + 게이트 오픈** — `plan-gate.ts` `runOpenGate` 가 `writeArtifact` → `markArtifactReady` → `saveState` 직후 `notifyViewerState(root, feature)` 호출(`state` 이벤트). 게이트 오픈(`runGate`/`observeGate`) 직전.
- **채팅 회신** — `gate-manager.ts` `appendAgentChat` 이 `broadcastSse(gate, "chat")` 호출.

`gate` 객체에 `sseClients: Set<ServerResponse>` 를 두고, `/api/events` 핸들러가 클라이언트를 등록(`req.on("close")` 로 해제). `broadcastSse` 가 모든 클라이언트에 `event: <type>\ndata: <json>\n\n` 프레임을 송신(실패 클라이언트 자동 제거).

뷰어는 `App.jsx` 에서 단일 `EventSource("/api/events")` 를 열어 `state` 이벤트 → `fetchState()`, `chat` 이벤트 → `window` 의 기존 `fn-chat-update` 이벤트 dispatch(`ChatSidebar` 가 `fetchChat()`). `setInterval(fetchState, 2000)`·`setInterval(fetchChat, 500)` 제거.

**하트비트 흡수**: 탭 생존 감지를 SSE 연결 생존으로 대체. `runGate`/`observeGate` 의 브라우저 재오픈 판정에 `gate.sseClients.size === 0` 조건을 추가 — SSE 클라이언트가 살아있으면 `lastSeen` 경과와 무관하게 재오픈하지 않는다.

core(`packages/factorynote`)는 무변경 — 모든 `writeArtifact` 호출이 pi-extension 경로를 거치므로 트리거를 pi-extension 에 둔다.

## 이유 (Rationale)

- **트리거 소스가 이미 서버에 있다.** `runOpenGate`(산물 write + 게이트 오픈)와 `appendAgentChat`(채팅 회신) 은 모두 pi-extension 이 주도하므로, core 에 훅을 넣거나 디스크를 감시할 필요 없이 이 시점에 broadcast 1줄이면 끝난다.
- **SSE 는 raw `node:http` 로 구현 가능** — `text/event-stream` 헤더 + `res.write("data: ...\n\n")` 프레임. `ws` 패키지 의존 추가 없이 builtins-only 제약 준수.
- **지연 제거 + 디스크 조회 최소화** — 갱신이 에이전트 기록 시점에 즉시 발생하고, 변경 없는 폴링 재조회가 사라진다.
- **하트비트 이중 역할 해소** — SSE 연결 자체가 생존 신호여서 폴링을 제거해도 재오픈 로직이 유지된다.

## 대안 (Alternatives)

- **Long polling**(`/api/state?wait=1`): 서버가 변경 시까지 대기 후 응답. 구현은 SSE 보다 약간 단순하나 매번 새 HTTP 요청 오버헤드가 있고, 브라우저가 동시 연결 수 제한(6) 에 가까워질 수 있다. SSE 의 단일 영속 연결이 더 적합.
- **`fs.watch` 디스크 감시**: OS별 이벤트 신뢰성 차이 + core 레이어(또는 디스크)를 감시해야 해 harness-agnostic 경계를 침범. 트리거가 서버에 이미 있으므로 불필요.
- **WebSocket (`ws`)**: 양방향은 필요 없고(뷰어→서버는 기존 POST 유지), builtins-only 제약을 위반해 패키지 의존이 추가된다.
- **폴링 주기 단축**: 근본 해결이 아니고 디스크 조회·트래픽이 늘어난다.

## 결과 (Consequences)

- **긍정**: 갱신 지연 최소화(최대 2초 → 즉시), 변경 없는 디스크 재조회·HTTP 요청 제거, 채팅 0.5초 폴링 제거.
- **트레이드오프**: SSE 영속 연결 관리 복잡도 증가. 연결이 끊긴 순간의 이벤트는 유실되나, 다음 게이트 오픈(또는 `EventSource` 자동 재연결 후 다음 push)에 재동기화된다. `EventSource` 는 자동 재연결을 내장.
- **후속 작업**: 없음. 브라우저 오프닝·게이트 결정·채팅 전송 POST 로직·뷰어 UI/스타일·그래프 렌더링은 무변경.

## 참고

- 구현: [[implementation-architecture]], `apps/pi-extension/src/gate-http.ts`(`/api/events`), `gate-manager.ts`(`broadcastSse`·`notifyViewerState`), `gate-server.ts`(재오픈 판정), `plan-gate.ts`(`runOpenGate` 트리거), `apps/plan-viewer/src/App.jsx`(`EventSource`)
- 관련: [[ADR-003-viewer-architecture]]
