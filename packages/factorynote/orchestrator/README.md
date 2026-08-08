---
updated: 2026-08-07
tags: [orchestration, protocol, agents, tier-1]
---

# M2 Orchestrator (Protocol — Tier 1 Director 규칙)

Director Agent 가 따르는 규칙. 코드가 아닌 **프로토콜**(에이전트가 읽고 실행)이
본체이고, [[implementation-architecture]] 의 얇은 코드(`orchestration.ts`·`plan-tool.ts`)가
루프 전이·상한·에스컬레이션·영속의 신뢰성을 담당한다(Hybrid).
근거: [[multi-agent-pipeline]] · [[03-module-architecture|workflow-core M2/M4]] · [[ADR-009-tier-1-agent-orchestration]].

> **Tier 1 = 유일 경로.** Tier 0(단일 에이전트 인라인 자기검토)는 [[ADR-005-mvp-implementation]] 에서
> [[ADR-009-tier-1-agent-orchestration]] 로 폐기되었다. 산출물은 항상 Design 자식 → Feedback 자식
> 루프를 거쳐 사용자 게이트로 간다. 단일 에이전트가 직접 산출물을 작성하지 않는다.

## 에이전트 역할

- **Director(조율자)** — 각 Stage 진입점. `factorynote_plan` 도구로 단계 지시문을 받아
  Design/Feedback 자식을 **스폰**하고 결과를 **보고**하며 루프를 조율. 산출물 자체는 쓰지 않는다.
- **Design(설계자)** — Stage 산출물(요구사항 명세·설계 그래프·구현 계획) 작성. Feedback 이슈를 받아 재작성.
- **Feedback(검토자)** — Design 산출물을 비판 검토(보안·병목·구조). 판정은 첫 줄 `CLEAN`(이슈 없음)
  또는 `ISSUES`(이후 줄에 각 이슈를 `-` 로 나열). 이슈 시 Design 에게, 클린 시 Director 에게.

## 흐름 (factorynote_plan 단계 지시문 기반)

```
factorynote_plan({feature})                         ── 진입
   │ nextAction=spawn-design  → Director 가 Design 자식 스폰(spawnTask)
   ▼
factorynote_plan({feature, designArtifact=초안})    ── Design 보고
   │ nextAction=spawn-feedback → Director 가 Feedback 자식 스폰(산출물+체크리스트)
   ▼
factorynote_plan({feature, designArtifact=초안, feedbackResult=CLEAN|ISSUES})
   │  CLEAN         → 산출물 저장 + 사용자 게이트 오픈
   │  ISSUES 미상한 → spawn-design(이슈 인용, dfLoop++)
   │  ISSUES 상한   → 에스컬레이션 게이트 오픈(잔존 이슈 노출)
   ▼
사용자 게이트(웹): confirm → 다음 Stage / modify → 내부 루프 재시작 / revert → 이전 Stage 회귀
```

## 판정·실행은 프로토콜, 신뢰성은 코드 (Hybrid)

| 관심사 | 담당 | 형태 |
| --- | --- | --- |
| 단계 순차 구동·게이트 제시·회귀 처리 | 이 규칙(프로토콜) + `plan-tool.ts` | 에이전트가 따르는 지시문 |
| Design↔Feedback 루프 전이·상한·에스컬레이션 | `orchestration.ts`(`nextDesignFeedbackStep`) | 순수 함수(결정론적) |
| 상태 atomic r/w·검증·감사 로그 | `persistence.ts` | 얇은 코드(NFR-2) |
| 에이전트 스폰 | pi: Director 가 `subagent` 도구로(에이전트 매개) · 동기 harness: `AgentSpawn` 구현 주입 | M4 계약 |

> Director 자체는 산출물을 작성하지 않는다. 에이전트 생명주기와 게이트만 관리.

## 상한·에스컬레이션 (FR-2, 내부 루프)

내부 Design↔Feedback 루프는 `MAX_DESIGN_FEEDBACK_LOOPS`(=3) 까지. 도달 시에도 Feedback 이슈가
잔존하면 **근본적 설계 갈등의 신호**로 보고, 산출물(마지막 초안)을 사용자 게이트로 올리되
에스컬레이션 프레이밍으로 제시 — 선택: (a) 코멘트로 근본적 재작성 지시 (b) 이전 Stage 회귀
(c) 범위·제약 조건 재협의. (사용자-modify 루프의 FR-2 에스컬레이션과 별개·독립 상한.)

## pi 실현 제약 (M4 Tier 1)

pi 확장 코드는 서브에이전트를 **동기 스폰할 수 없다**(`subagent` 도구는 에이전트 전용).
그러므로 pi 어댑터는 `AgentSpawn` 인터페이스를 **에이전트 매개**로 실현한다 — `factorynote_plan` 이
단계 지시문(`spawn-design`/`spawn-feedback` + `spawnTask`) 을 반환하면, Director 에이전트가 자신의
`subagent` 도구로 자식을 스폰하고 결과를 `designArtifact`/`feedbackResult` 로 보고한다.
동기 스폰이 가능한 harness(CLI 하네스·테스트·Codex/Claude 구현체)는 `runDesignFeedbackLoop(spawn)`
에 `AgentSpawn` 구현을 직접 주입해 같은 전이 로직을 실행한다.

## 참고

- [[multi-agent-pipeline]] — Director/Design/Feedback 구조·3단계 파이프라인 원안
- [[ADR-009-tier-1-agent-orchestration]] — Tier 1 결정(Tier 0·NFR-7 폐기)
- [[implementation-architecture]] — 코드 구조·런타임 데이터 흐름
- [[Home]]
