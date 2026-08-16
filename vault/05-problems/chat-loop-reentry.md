---
updated: 2026-08-16
tags: [problem, gate, chat]
---

# 게이트 채팅 루프 끊김 — chatPending 수신 후 에이전트 턴 종료

**상태**: 해결 (해당 Changelog 항목 참조)

## 현상

웹 게이트 채팅으로 질문/수정 요청이 들어와 `factorynote_plan` 이 `chatPending` 을 반환하면 에이전트가 `factorynote_plan(chatResponse)` 로 재호출해 게이트를 유지해야 하나, 턴을 종료해버려 답변이 돌아오지 않았다("하네스에서 채팅이 끝남" — 사용자 보고).

## 원인

도구 반환값 `chatPending` 이 "사용자 응답 대기 중이니 재호출하라"는 지시임을 에이전트가 알 수 없었다. `formatForAgent` 의 채팅 블록이 본문 하단에 묻혀 있어 지시가 누락되기 쉬웠다.

## 조치

- `formatForAgent` 의 채팅 블록을 본문 상단으로 올려 "턴 종료 금지 + `factorynote_plan(chatResponse)` 재호출"을 명령형으로 지시.
- `factorynote_plan` `promptGuidelines` 에도 chatPending 시 재호출 의무를 명시.
- 게이트 서버 재진입 로직은 이미 `gate-server.test.ts` 로 검증돼 무변경.
- 회귀 테스트 2건 추가(format 지시문 + chatResponse 재진입 시 agent 답변 chatLog push·게이트 유지).

## 교훈

- 도구 반환값 중 "에이전트가 다음 행동을 해야 하는" 것은 지시문이 본문 어디에 있든 명확해야 한다 — 상단 배치 + 하드 가이드라인 이중화.
- 관련: [[chat-rewrite-gate-reopen]] — 같은 채팅 게이트 흐름의 자매 결함. [[ADR-024-chat-send-queue]]
