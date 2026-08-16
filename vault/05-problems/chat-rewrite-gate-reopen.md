---
updated: 2026-08-16
tags: [problem, gate, chat]
---

# 채팅 수정 요청 게이트 깨짐 — gateOpen 상태의 designArtifact 재호출 미처리

**상태**: 해결 (해당 Changelog 항목 참조)

## 현상

채팅으로 산물 수정 요청이 들어와 에이전트가 재작성 후 `factorynote_plan(designArtifact[, chatResponse])` 로 재호출할 때, 재작성 draft 가 스테이지 산출물로 반영되지도, 게이트가 갱신된 내용으로 다시 열리지도 않았다. 게이트가 닫힌 것처럼 보여 뷰어(당시 `/api/state` 2초 폴링)도 갱신 없이 상호작용이 먹통.

## 원인

`drivePlan` 이 `gateOpen=true` + `designArtifact` 경로를 다루지 않고 폴백(spawn-design)으로 빠졌기 때문. "게이트 열림 + 산물 재제출"이라는 조합이 상태 머신에 없었다.

## 조치

`drivePlan` 에 "게이트 열린 상태 + designArtifact → 산물(draft.md) 반영 + `runOpenGate(resume=false)` 로 게이트 재오픈" 처리를 추가. 뷰어는 이미 폴링 중이므로 백엔드 수정만으로 갱신·상호작용 회복. 회귀 테스트 추가(gateOpen+designArtifact 재호출 시 산물 반영·게이트 유지·chatResponse 답변 push).

## 교훈

- 게이트 상태 머신에 새 진입 조합을 추가할 때는 "열림 상태에서의 재진입" 경로를 항상 매트릭스로 점검할 것.
- 관련: [[chat-loop-reentry]] — 같은 채팅 게이트 흐름의 자매 결함. [[ADR-024-chat-send-queue]]
