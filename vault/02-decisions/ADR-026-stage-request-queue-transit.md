---
status: accepted
updated: 2026-08-15
tags: [adr, chat, gate, viewer, stage-request, queue]
---

# ADR-026: 다음 단계 요청의 큐 경유(단일 채널 진행)

## 상태

accepted — [[ADR-025-stage-request-chat-record]] 를 대체(supersede)

## 날짜

2026-08-14

## 맥락 (Context)

[[ADR-025-stage-request-chat-record]] 의 컴패니언 모델은 단계 요청을 **기록 전용**(전달/큐 미경유, 취소 불가)으로 분리했고, 단계 진행 자체는 `/api/decision` 이 즉시 resolve 했다. 그 결과 두 문제가 드러났다:

1. **큐에 안 보인다** — 에이전트가 채팅 응답 중(`currentResolver` null)에 확정 버튼을 누르면, 대기 채팅 뒤에 순서로 들어가는 게 아니라 `chatLog` 에 즉시 기록되어 사용자 동작 예시(채팅 2개 뒤 3번째 칸)와 어긋났다.
2. **결정이 드롭된다** — `/api/decision` 은 `currentResolver` 가 null 이면 `r?.()` 로 조용히 사라진다. 응답 중 확정은 기록만 남고 실제 진행은 일어나지 않아 재클릭이 필요했다.

사용자 요구: 확정 요청은 채팅과 **같은 큐 섹션**의 마지막 칸에 적재되고, 앞선 대기 채팅의 응답이 모두 끝난 뒤 실행되며, 확정 대기 중에는 채팅을 넣을 수 없다(거부+안내). 큐 항목은 본문이 아니라 **대기 콘텍스트 플레이스홀더**만 표시.

## 결정 (Decision)

**큐 경유 단일 채널 모델** — 비최종 단계 확정은 `/api/decision` 을 거치지 않고 `POST /api/chat {kind:"stage-request", targetStage, decision}` 하나로 표현한다. 단계 요청은 일반 채팅과 같은 `pendingChats` 큐의 마지막 칸에 적재되고, `ChatMessage.decision`(신규 선택 필드)에 실행될 `GateDecision` 을 실어 운반한다.

1. **적재**: 서버는 단계 요청을 `pendingChats` 에 push. 이미 대기 중인 단계 요청이 있으면 `{ok:false, reason:"already-pending"}` 로 거부(이중 확정 방지). 게이트가 열려 있고 앞 대기가 없으면(유일 항목) 즉시 `fulfilled` 기록 후 `decision` 이벤트로 resolve — 기존 즉시 진행 체감 유지.
2. **드레인(1개씩)**: `runGate` 재진입마다 큐 **선두 1개만** 전달한다(2026-08-15 개정 — 일괄 배출 금지). 선두가 일반 채팅이면 그 1건만 `chat` 이벤트로 전달하고, 선두가 단계 요청이면 — 앞 채팅 응답이 모두 끝났다는 뜻 — `fulfilled` 기록 후 `decision(confirm)` 이벤트로 resolve 해 다음 단계를 진행시킨다. 대기 채팅 여러 개는 각각 앞 응답이 끝난 뒤 하나씩 순서 실행된다.
3. **채팅 잠금**: 단계 요청이 큐에 대기 중이면 `POST /api/chat`(텍스트)을 `{ok:false, reason:"stage-request-pending"}` 로 거부. 뷰어는 입력 임금 + 안내 배너, 전송 거부 시 draft 유지.
4. **취소**: 대기 중 단계 요청도 일반 채팅과 동일하게 `/api/chat/cancel` 로 취소 가능(실행 시작 후 불가 — read-wins 는 [[ADR-024-chat-send-queue]] 동일).
5. **큐 가시성(2026-08-15 개정)**: 큐 영역의 일반 채팅은 '대기' 태그 + **한 줄 미리보기**(첫 줄 ~40자 말줄임, 블록 스코프면 `[blockId]`)로 무엇이 대기 중인지 식별 가능하게 표시한다. 본문 전체는 실제 전송(승격) 후 채팅 로그에만 공개. 단계 요청은 ➡Stage 뱃지 + 채운 배경 강조, ✕ 취소 버튼은 배경과 대비되는 `--on-color` 계열로 표시한다.
6. **게이트 바 대기 상태(2026-08-15 추가)**: 확정 요청이 큐에 대기 중인 동안에는 채팅 응답 루프로 게이트가 같은 단계로 재오픈(`gateOpen=true`)해도 게이트 바 로딩이 유지된다(`App.stageQueued` — SSE chat 이벤트마다 큐 동기화). 라벨은 상황별: 대기 중 '앞선 채팅 응답 후 진행…', 실행 후(gateOpen=false + 단계 진행 감지 시 pending 재설정) 기존 '다음 단계 작성 중…'.
7. **비최종/최종 분기**: 최종(3단계) 확정·modify·revert 는 기존대로 `/api/decision` 즉시 전달. `App.onGate` 만 분기한다.

## 이유 (Rationale)

- 드롭 문제의 근본 원인은 '결정 채널과 큐 채널의 이원화'였다. 결정을 큐 항목에 실어 보내면 resolver 유무와 무관하게 정확히 한 번 실행되고, 순서도 큐가 보장한다.
- 채널 단일화로 `/api/decision` 의 confirm-비최종 경로가 사라져 상태 머신이 단순해진다(즉시 경로는 큐 적재→선두→즉시 drain 으로 동일 코드 경로).
- 채팅 잠금은 사용자 동작 예시 5단계에 명시된 요구. 서버 거부 + 뷰어 안내 이중 방어.

## 대안 (Alternatives)

- **컴패니언 유지 + `/api/decision` 지연 큐잉**: 결정 채널을 별도로 지연 실행하려면 pending-decision 상태가 서버에 하나 더 생겨 두 채널 동기화(취소 시 결정 회수 등)가 필요했다. 큐 항목 하나로 표현되는 이유로 기각.
- **즉시 resolve + 기록만 순서 표시**: 응답 중 확정이 채팅 응답을 선점(레이스)하거나 드롭되는 건 그대로라 기각.

## 결과 (Consequences)

- 확정 요청이 채팅 응답 뒤에 **실제로** 순서 실행된다(표시만이 아님). 응답 중 확정의 재클릭 필요가 사라진다.
- `ChatMessage.decision` 필드가 코어 타입에 추가됐다(서버 내부용 — 뷰어 미사용).
- 비최종 confirm 이 `/api/chat` 만 거치므로, 서버 재시작 없이는 구 뷰어(`stage-request` without `decision`)와 혼용 시 즉시 경로에서 빈 코멘트 confirm 이 실행된다(빌드=배포로 함께 올라가므로 실질 무해).
- 단계 요청 대기 중 채팅이 불가하다 — 긴급 수정 요청은 단계 요청 취소(✕) 후 채팅으로 대체한다.

## 참고

- 선행: [[ADR-024-chat-send-queue]] (가시 큐·read-wins 취소), [[ADR-009-realtime-chat-loop]] (채팅 루프)
- 피대체: [[ADR-025-stage-request-chat-record]] (컴패니언 기록 모델)
