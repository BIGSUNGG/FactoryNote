---
status: accepted
updated: 2026-08-11
tags: [adr, orchestration, feedback]
---

# ADR-017: Feedback 수준(none|low|medium|high|ultra)

## 상태

accepted

## 날짜

2026-08-11

## 맥락 (Context)

내부 Design↔Feedback 루프의 검토 강도는 Director의 상황 판단(전형 3-6개)에
맡겨져 있어, 사용자가 검토 깊이와 에이전트 호출 비용을 통제할 수 없었다.
단순한 기능에는 병렬 검토가 과하고, 복잡한 기능에는 더 많은 검토 축이
필요하다. 또한 AI 라우트 서비스는 병렬/총 에이전트 호출 수에 제한을 둘 수
있어, 대규모 팬아웃(ultra)은 실패 시 분할 재시도 규칙이 필요하다.

한편 [[ADR-009-tier-1-agent-orchestration]] 는 Tier 0(Feedback 없는 단일
에이전트 경로)를 폐지했는데, 검토가 불필요한 빠른 반복을 위해 이 동작을
**opt-in**으로 되살릴 필요가 있다.

## 결정 (Decision)

`/factorynote feedback <level>` 명령로 Feedback 수준을 설정한다(pi 어댑터
세션 상태 — `/factorynote auto`와 동일 패턴. 변경 시까지 유지, 기본
`medium`). 수준별 동작:

| 수준 | Feedback 자식 수 | 동작 |
| --- | --- | --- |
| `none` | 0 | Feedback 루프 스킵 — Design 산출물이 사용자 게이트로 직행(opt-in Tier 0 부활) |
| `low` | 정확히 1 | 가장 관련 높은 에이전트 1개가 1~3개 검토 영역을 한 과제에서 담당 |
| `medium`(기본) | 2~3 | 현행 방식 — 메뉴에서 상황 맞춤 선택·병렬 스폰 |
| `high` | 4~6 | 상황 맞춤 4~6개 병렬 스폰 |
| `ultra` | 정확히 9 | 9개 병렬 스폰 |

- 수준 스펙(`FEEDBACK_LEVELS`)은 core(`orchestration.ts`)가 소유하고,
  `nextDesignFeedbackStep` 전이가 수준을 받아 none이면 게이트 직행한다.
  수준은 spawn-feedback 지시문(`feedbackLevel` 필드)·메뉴 파일·지시문
  메시지에 실려 Director의 스폰 수를 결정한다 — 판정은 코드(결정론),
  선택은 에이전트(Hybrid 원칙 유지).
- **호출 수 제한 대응**: 병렬 스폰이 라우터의 호출 수/레이트 리밋 에러로
  실패하면 선택 에이전트를 3~4개씩 순차 배치로 나눠 재시도하고 전 배치
  판정을 하나의 집합 보고로 합친다(프로토콜 규칙 — 실패 시 분할, 평소
  전량 병렬).
- 5대 원칙은 유지된다: none이어도 사용자 게이트는 반드시 열리며, 게이트를
  통과시키는 것은 여전히 사용자뿐이다.

## 이유 (Rationale)

- 검토 강도는 기능의 복잡도·비용 민감도에 따라 달라지는 사용자 선호이므로
  파이프라인 영속 상태가 아닌 **세션 토글**로 충분하다(기존 `auto` 패턴).
- 수를 결정론적 스펙으로 코드가 소유해야 수준이 프롬프트 드리프트 없이
  일관되게 적용되고 테스트로 고정된다.
- 실패 시 분할(기본 전량 병렬)은 제한이 없는 환경에서 오버헤드가 없다.

## 대안 (Alternatives)

- **none 대신 최소 1개 항상 스폰**: 5대 원칙의 독립 검토를 보존하지만,
  검토가 필요 없는 빠른 반복의 목적(사용자 명시 요구)을 충족하지 못해 배제.
- **high/ultra 항상 순차 배치**: 실패 감지가 불필요하나 제한이 없는
  환경에서 항상 느려 배제.
- **수준을 feature별 영속 상태**(`state.json`)로 저장: 세션 재시작에도
  유지되나, 상태 스키마·전이 복잡도 증가 대비 실익이 적어 배제.

## 결과 (Consequences)

- 긍정: 비용·속도·검토 깊이 통제. none으로 빠른 반복 가능. ultra로
  대규모 병렬 검토 가능.
- 부정/트레이드오프: none은 독립 검토 없이 게이트로 가므로 사용자 판단
  부담이 커진다(티어 0의 본래 폐지 사유). ADR-009의 "Tier 1 = 유일 경로"
  문구는 opt-in none 수준으로 예외가 생기나, 게이트 통제(원칙 1-5)는
  그대로 유지된다.
- 후속: 없음(프로토콜 문서는 `packages/factorynote/orchestrator/README.md`·
  usage-guide 에 반영 완료).

## 참고

- [[ADR-009-tier-1-agent-orchestration]] — Tier 1 결정(폐지했던 Tier 0를 none으로 opt-in 부활)
- [[ADR-014-dynamic-feedback-agents]] — 동적 선택 모델(수준은 수만 구속, 선택은 Director)
- [[ADR-013-parallel-feedback-pipeline]] — 병렬 팬아웃 구조
