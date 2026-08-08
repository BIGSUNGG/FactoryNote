---
status: accepted
updated: 2026-08-07
tags: [adr, chat, viewer, gate, comment]
---

# ADR-011: 코멘트 → 실시간 채팅 통합 (SidePanel 검토 큐·수정 지시 버튼 폐지)

## 상태

accepted

## 날짜

2026-08-07

## 맥락 (Context)

[[ADR-009-realtime-chat-loop]] 로 게이트 내 실시간 에이전트 채팅이 도입됐으나, 기존 블록/셀/영역 코멘트는 여전히 **우측 SidePanel 큐에 적재된 뒤 "✎ 수정 지시" 버튼으로 일괄 전송(modify verdict)** 되는 이중 경로였다. 결과적으로 코멘트가 SidePanel 큐와 채팅에 분산됐고, 사용자는 (1) 문서와 채팅 사이의 검토 큐 표시, (2) 일괄 전송 버튼을 부담으로 느꼈으며, 코멘트를 **남기는 즉시** 에이전트에게 전달하길 원했다.

## 결정 (Decision)

1. 블록/셀/영역 코멘트(`PlanPage`)와 그래프 코멘트(`DesignStage`)의 submit 을 로컬 큐 적재가 아닌 **즉시 `POST /api/chat`**(blockId/node 스코프)로 전송한다. 코멘트는 채팅 사용자 메시지(`role:"user"`)로 표시되고 기존 `chatPending` 루프로 에이전트에 즉시 전달된다(게이트 유지).
2. `PlanPage` 우측 `SidePanel` 전체(검토 코멘트 큐 + Design↔Feedback 루프 + Feedback 이슈 + 어노테이션)를 제거해 검토 레이아웃을 **[문서 | 채팅] 2단**으로 한다.
3. 공용 `GateBar`에서 "✎ 수정 지시" 버튼을 제거한다(확정·정정은 유지). modify verdict 의 UI 트리거가 소멸한다.
4. 코멘트 로컬 상태는 문서 내 인라인 표시(💬 배지·팝오버)용으로만 유지한다.

## 이유 (Rationale)

코멘트가 남겨지는 순간 에이전트에 닿아 "그 자리 수정"이 즉시 일어나는 것이 사용자 의도다. 이중 경로(큐 적재→일괄 modify vs 실시간 채팅)는 중복·혼란이다. 채팅은 이미 ADR-009 로 **modify 루프카운트 미포함 사전 다듬기** 채널이므로, 코멘트를 채팅으로 통합해도 `MAX_LOOPS` 상한을 소비하지 않는다.

## 대안 (Alternatives)

- **SidePanel 큐 + 수정 버튼 유지 + 채팅 병존** — 이중 경로 혼란과 UI 부담이 잔존. 배제.
- **modify verdict 묶음 전송은 유지하되 버튼만 숨김** — 데드 코드·데드 경로 잔존. 배제.

## 결과 (Consequences)

- 긍정: 단일 코멘트 채널(채팅), 즉시 전달, UI 단순화(2단 레이아웃).
- 부정/트레이드오프: 엔진의 modify-verdict 경로가 UI 에서 트리거 불가(코드엔 잔존; 필요시 복원 가능). Design↔Feedback 루프 표시(라운드·이슈)가 뷰어에서 사라짐(상태는 엔진에 존재).
- 후속 작업: 필요시 루프 상태를 채팅 헤더 등으로 다시 노출.

## 참고

- [[ADR-009-realtime-chat-loop]]
- [[implementation-architecture]]
