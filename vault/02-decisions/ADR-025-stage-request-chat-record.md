---
status: superseded by [[ADR-026-stage-request-queue-transit]]
updated: 2026-08-14
tags: [adr, chat, gate, viewer, stage-request]
---

# ADR-025: 다음 단계 요청의 채팅 강조 기록(pending→fulfilled)

## 상태

superseded by [[ADR-026-stage-request-queue-transit]] — 컴패니언 모델은 응답 중 확정 시 결정이 드롭되고 큐에 순서로 보이지 않아 큐 경유 단일 채널로 대체됨(강조 디자인·ChatMessage 확장 필드는 계승).

## 날짜

2026-08-13

## 맥락 (Context)

[[ADR-024-chat-send-queue]] 로 채팅 전송 대기 큐가 도입됐으나, '✓ 확정 → 다음 단계' 확인은 여전히 `/api/decision` 채널로만 진행되어 **채팅창에 아무 기록도 남지 않았다.** 사용자 요구: 확인 버튼을 누르면 '다음 단계 요청'이 채팅처럼 채팅창에 나타나고, (필요 시) 큐에도 올라갈 수 있으며, 채팅·큐 양쪽에서 **특별한 메시지처럼 강조**되어야 한다. 또 큐 전반의 디자인 개선(둥근 테두리)이 요구됐다.

게이트 결정(`/api/decision`, 단계 진행)과 채팅(`/api/chat`, 정제)은 [[ADR-009-realtime-chat-loop]] 가 분리한 별개 채널이다. 이 분리를 해치지 않으면서 단계 요청을 채팅에 '기록'하는 방식이 필요했다.

## 결정 (Decision)

**컴패니언 기록 모델** — 단계 진행은 종래대로 `/api/decision` 이 담당한다. 추가로 'Stage N+1 진행 요청' **강조 메시지**를 채팅 로그(`chatLog`)에 기록만 한다(에이전트에 전달 X, 취소 불가).

1. **메시지 모델**: `ChatMessage` 에 선택 필드 `kind:"stage-request"`·`status`·`targetStage` 추가. 일반 채팅은 미지정(후방 호환).
2. **생성**: 뷰어 `App.onGate` 가 `verdict:"confirm"` 且 `stage<3` 일 때 `/api/decision` 외에 `POST /api/chat {kind:"stage-request", targetStage:stage+1}` 도 전송. 서버는 이 메시지를 `chatLog` 에 `status:"pending"` 으로 push 하되 **`currentResolver`·`pendingChats` 를 건드리지 않는다**(게이트는 결정 채널로만 진행).
3. **라이프사이클**: 생성 시 `pending`. 다음 단계 준비 중(`gateOpen=false`)엔 '전송 대기 중' 큐 영역에 강조(채운 액센트 배경 + ➡Stage 뱃지, ✕ 없음)로 표시. `runGate` 시작(게이트 오픈, `onReady` 이전)이 `chatLog` 내 `pending` 단계 요청을 `fulfilled` 로 전환 → 채팅 본문에 강조 기록으로 자리잡는다.
4. **디자인**: 단계 요청은 `--primary` 채운 배경 + 둥근 카드(10px)로 강조. 큐 아이템은 점선→실선 둥근 카드, 태그는 pill 로 재디자인.

[범위 외] 마지막 단계 확정(완료)·modify·revert 는 단계 요청 미생성. 일반 채팅의 큐 적재·취소(ADR-024)는 무변경.

## 이유 (Rationale)

- 결정·채팅 채널 분리(ADR-009)를 유지하면서도 사용자에게 '내가 다음 단계를 요청했다'는 시각 기록을 제공한다. 단계 요청을 실제 전달 큐(`pendingChats`)에 넣으면 결정 채널과 충돌/경쟁이 생기므로, **기록 전용**으로 분리해 안전한다.
- `pending→fulfilled` 전환을 `runGate` 오픈 시점에 묶으면 '준비 중=대기, 게이트 오픈=완료'가 자연스럽게 매핑된다. `onReady` 이전에 전환해 오픈 직후 폴링이 `fulfilled` 를 본다.
- 단계 요청은 이미 결정으로 진행됐으므로 취소할 수 없(✕ 없음). 일반 큐 채팅(전달 대기)만 취소 가능 — 시각적으로 동일한 큐 영역이되 행동이 다른 두 종류(일반=✕, 단계요청=강조만).
- 상태 전환을 서버(`chatLog.status`)에 두어 탭 재로드·다중 탭에서도 일관되게 보인다.

## 대안 (Alternatives)

- **단계 요청을 실제 큐 메시지로 전달**(`/api/chat` 경유, `pendingChats` 적재) — 결정 채널과 resolver 경쟁·이중 전달 발생. 배제.
- **단계 요청이 진행을 주도**(confirm 자체를 특수 채팅으로, `/api/decision` 폐지) — 게이트 상태기계·MAX_LOOPS·revert 전면 수정 필요. 배제.
- **상태 전환을 뷰어 로컬로 파생**(`gateOpen` 등에서) — 재로드·다중 탭에서 불일치. 서버 `status` 필드가 견고.

## 결과 (Consequences)

- 긍정: 단계 전환이 채팅에 강조 기록으로 남아 진행 흐름이 가시적. 큐 디자인 통일(둥근 카드). pending/fulfilled 가 게이트 준비 상태와 정확히 동기화.
- 부정/트레이드오프: `ChatMessage` 에 `kind/status/targetStage` 필드 추가(후방 호환). 단계 요청은 결정과 별개 채널이므로 '결정은 됐으나 기록 누락' 엣지(POST 순서) 이론적 존재 — 에이전트 산물 작성보다 뷰어의 두 순차 POST가 항상 빠르므로 실질적 미발생.

## 참고

- [[implementation-architecture]]
- [[ADR-024-chat-send-queue]] — 전송 대기 큐(본 ADR 의 토대)
- [[ADR-009-realtime-chat-loop]] — 결정/채팅 채널 분리
