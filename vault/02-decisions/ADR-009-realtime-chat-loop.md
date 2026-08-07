---
status: accepted
updated: 2026-08-06
tags: [adr, chat, gate, viewer, realtime]
---

# ADR-009: 게이트 오픈 중 실시간 에이전트 채팅 루프

## 상태

accepted

## 날짜

2026-08-06

## 맥락 (Context)

기존엔 게이트가 열려 있는 동안 사용자가 게이트 바(confirm/modify/revert)로만 에이전트와 소통할 수 있었고, 코멘트는 `modify` 판정을 낼 때만 의미를 가졌다. 즉 산출물을 **확정하기 전에** 에이전트에게 질문하거나 부분 수정을 요청하는 수단이 없었다.

에이전트는 `factorynote_plan` 도구 호출 후 `runGate()` 안에서 블로킹 대기 중이므로, 채팅 메시지가 에이전트에 닿으려면 게이트를 닫지 않은 채 에이전트에게 제어를 돌려주는 **새로운 루프**가 필요했다.

## 결정 (Decision)

1. `runGate` 의 반환을 이벤트 유니온으로 변경: `GateEvent = {kind:"decision", decision} | {kind:"chat", messages}`. 게이트 대기 중 `POST /api/chat` 가 도착하면 `chat` 이벤트로 resolve한다.
2. 채팅 채널: `POST /api/chat`(사용자 메시지 push), `GET /api/chat`(뷰어 폴링용 누적 로그), `appendAgentChat()`(에이전트 답변 push).
3. `drivePlan` 은 `chat` 이벤트를 받으면 `chatPending` 을 에이전트에게 반환한다. 에이전트는 `chatResponse`(답변) + 선택 `artifactMd`(그 자리 수정)로 `factorynote_plan` 을 재호입 → 게이트를 **유지한 채** 재진입한다.
4. **채팅 수정은 `MAX_LOOPS` modify 루프 카운트에 포함하지 않는다**(사전 다듬기). 최종 판정은 기존 게이트 바로 유지.
5. 부분 코멘트는 기존 `blockId` 단위를 재사용(특정 블록만 지정). 뷰어는 계획 페이지 우측에 `ChatSidebar` 를 둔다.

## 이유 (Rationale)

게이트를 닫지 않고 산출물을 대화로 정제하면, 사용자가 확정 전에 에이전트와 주고받으며 다듬을 수 있다. `loopCount` 미포함은 "사전 다듬기(채팅)"와 "modify 판정(루프 카운트)"을 분리해, 다듬기가 반복 상한을 소모하지 않도록 한다. 에이전트 재호출 패턴은 기존 `drivePlan` 단일구동 모델(Tier 0)을 그대로 확장한다.

## 대안 (Alternatives)

- **채팅을 별도 채널/프로세스로 분리** — 권위가 분산되고 `state.json` 단일 권위 모델(NFR-2)을 훼손. 배제.
- **채팅 수정도 modify 루프에 포함** — 사전 다듬기가 `MAX_LOOPS` 상한을 소모해 FR-2 에스컬레이션이 조기 발생. 배제.

## 결과 (Consequences)

- 긍정: 게이트 내 대화식 정제, 부분 코멘트 즉시 반영(실시간 갱신), 사용자 부담 감소.
- 부정/트레이드오프: `runGate` 반환 타입 복잡화(이벤트 유니온), 에이전트가 `chatPending`/`chatResponse` 프로토콜을 이해해야 함, 뷰어 폴링 증가(`/api/chat`).

## 참고

- [[implementation-architecture]]
- [[ADR-008-3-stage-pipeline]]
- [[ADR-010-md-design-stage]] — 채팅으로 구조/설명을 함께 수정하는 근거
