# M2 Orchestrator (Protocol — Director 규칙)

Director Agent가 따르는 규칙. 코드가 아닌 **프로토콜**(에이전트가 읽고 실행).
근거: [[vault/01-architecture/multi-agent-pipeline]] · [[vault/03-design/workflow-core/03-module-architecture]].

## 흐름

1. Stage 진입 → Design Agent와 Feedback Agent를 생성(M4).
2. Design Agent가 산출물 작성 → Feedback Agent가 검토(보안·병목·구조).
3. 이슈 → Design에게 피드백 → 수정 → 재검토 (Design↔Feedback 루프, `loopCount` 증가).
4. Feedback 클린 판정 → 산출물을 **사용자 게이트**로.
5. 사용자 판정(`GateVerdict`): `confirm` → 다음 Stage / `modify` → Design에게 전달 / `revert` → 이전 Stage 회귀(`regressions` 기록).

## 판정·실행은 프로토콜, 신뢰성은 코드

- 단계 순차 구동·게이트 판정·회귀 처리 = 이 폴더의 규칙(에이전트가 따름).
- 상태 atomic r/w·검증·감사 로그 = `src/persistence.ts`(얇은 코드, NFR-2).

> Director 자체는 산출물을 작성하지 않는다. 에이전트 생명주기와 게이트만 관리.
