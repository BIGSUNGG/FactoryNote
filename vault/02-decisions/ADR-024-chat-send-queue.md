---
status: accepted
updated: 2026-08-13
tags: [adr, chat, gate, viewer, queue]
---

# ADR-024: 게이트 채팅 전송 대기 큐(read-wins 취소)

## 상태

accepted

## 날짜

2026-08-13

## 맥락 (Context)

[[ADR-009-realtime-chat-loop]] 로 게이트 오픈 중 실시간 채팅이 가능해졌으나, `POST /api/chat` 는 메시지를 `chatLog` 에 **즉시** 적재하고 대기 중인 `runGate` resolver 를 곧바로 발화시켰다. 즉 사용자가 '전송'을 누른 순간 이미 '전송됨'으로 표시되어, **에이전트가 응답 중(도구 호출 중)일 때 보낸 메시지도 취소할 수 없었다.**

사용자 요구: 에이전트가 바로 읽지 못하는 채팅은 **가시적인 대기 큐**에 두어야 하고, 각 메시지를 **전송 취소**할 수 있어야 한다. 단, 에이전트가 메시지를 읽기 시작하는 순간과 취소가 동시에 일어나는 경쟁(race)에서는 **'읽힌 것'을 우선**해 취소가 거부되어야 한다.

기존에도 `pendingChats` 버퍼가 존재했으나(`gate-server.ts` 재진입 보호), 이는 **보이지 않고 취소할 수 없는** 내부 버퍼였다.

## 결정 (Decision)

기존 `pendingChats` 를 **가시 전송 대기 큐**로 승격한다. `POST /api/chat` 의 전송 경로를 둘로 나눈다.

1. **즉시 전송** — 에이전트가 듣는 중(`runGate` 대기 = `currentResolver` 존재): 종래대로 `chatLog` 적재 + 즉시 전달. 큐 미경유.
2. **큐 적재** — 에이전트가 응답 중(`currentResolver` null): `chatLog` 가 아닌 `pendingChats` 에만 적재. 뷰어의 **별도 '전송 대기 중' 영역**에 표시, 각 메시지 ✕ 로 취소 가능.

**읽기 = 승급**: 에이전트가 응답을 마치고 `runGate` 에 재진입해 `pendingChats.splice(0)` 로 `chat` 이벤트를 넘기는 순간이 '읽기'다. 이때 큐 메시지를 `chatLog` 로 **승격**시켜 일반 전송 메시지로 확정하고 '전송 대기 중' 영역에서 제거한다.

**취소**: `POST /api/chat/cancel {id}` — 메시지가 아직 `pendingChats` 에 있으면(= 넘겨지기 전) 제거하여 **완전 삭제**(`chatLog` 에도 없고 전달도 안 됨). 이미 넘겨졌으면(큐에 없음) `{ok:false, reason:"already-sent"}` 로 **거부**한다(read-wins).

**API 노출**: `GET /api/chat` 응답에 `queue: ChatMessage[]`(`= pendingChats`)를 추가. SSE `chat` 이벤트를 적재·취소·승급 시점에 push(뷰어가 `fn-chat-update` 로 재fetch).

**범위 외**: 게이트 바 결정(confirm/modify/revert)·에이전트→사용자 답변·코멘트/그래프는 변경하지 않는다.

## 이유 (Rationale)

- `currentResolver` 유무가 '에이전트가 듣는 중 vs 응답 중'을 정확히 구분하는 유일한 신호이므로, 이를 전송 경로 분기에 그대로 사용한다(새로운 상태 추가 없음).
- 큐를 `pendingChats` 에 그대로 두면 승급 시점(재진입 splice)이 자연스럽게 '읽기'가 된다 — 별도 동기화 불필요.
- 큐 적재 경로에서 `chatLog` 에 넣지 않으면, 취소 시 `pendingChats.splice` 한 줄로 **완전 삭제**가 성립한다(이미 전송된 것처럼 보이는 찌꺼기가 남지 않음).
- 단일 스레드(Node 이벤트 루프)에서 '동시' 취소·읽기는 직렬화되므로, "큐에 없으면 이미 넘겨진 것"이라는 불변조건 하나로 read-wins 가 보장된다(별도 락/타임스탬프 불필요).

## 대안 (Alternatives)

- **항상 큐 → 읽으면 승급(conditional 아님)** — UX 가 일관되지만 에이전트 대기 중에도 매번 큐를 거쳐야 해 체감 지연. 사용자가 '에이전트 바쁠 때만 큐'를 명시적으로 선택해 배제.
- **큐를 `chatLog` 와 별도 배열로 분리** — `pendingChats` 를 재사용하면 분리·동기화 비용이 사라진다. 분리안은 중복 소스 오류 가능.
- **취소를 '전송 취소됨' 표시로 남김** — 취소 이력 가시성은 주지만, '전송된 적 없는' 깔끔함이 사라진다. 사용자가 '완전 제거'를 선택.

## 결과 (Consequences)

- 긍정: 에이전트 응답 중에 보낸 메시지를 뷰어에서 취소 가능. 대기/전송 상태가 시각적으로 구분. read-wins 경쟁 규칙이 코드 불변조건 하나로 보장.
- 부정/트레이드오프: `POST /api/chat` 경로 분기로 인지 부담 증가. 큐 적재 메시지는 승급 전까지 `GET /api/chat` 의 `messages` 에 안 보임(뷰어는 `queue` 를 별도 렌더). `makeGateHandler` 가 `broadcast` 를 의존성 주입받도록 시그니처 변경(`gate-http↔gate-manager` 순환 import 회피).

## 참고

- [[implementation-architecture]]
- [[ADR-009-realtime-chat-loop]] — 실시간 채팅 루프(본 ADR 의 기반)
- [[ADR-022-viewer-sse-push]] — 큐 변경 push 에 사용하는 SSE
