---
status: accepted
updated: 2026-08-07
tags: [adr, orchestration, agents, tier-1]
---

# ADR-009: Tier 1 에이전트 오케스트레이션 도입 — Tier 0·NFR-7 폐기

## 상태

accepted. [[ADR-005-mvp-implementation]] 결정 #4(Tier 0 단일 에이전트)·#4의 근거인 NFR-7(항상 동작 기본=Tier 0)을 본 ADR로 폐기(supersede).

## 날짜

2026-08-07

## 맥락 (Context)

[[multi-agent-pipeline]] 와 [[03-module-architecture|workflow-core M4]] 는 Director→Design↔Feedback 멀티에이전트 모델을 정의한다. 그러나 [[ADR-005-mvp-implementation]] 는 구현량 최소화(ponytail)를 위해 **Tier 0**(단일 pi 에이전트가 Design/Feedback 역할을 인라인 전환·1패스 자기검토)로 MVP를 출하했고, Tier 1(pi 서브에이전트 분리 스폰)은 "후속"으로 연기했다. NFR-7("항상 동작하는 기본=Tier 0")이 이 연기를 정당화했다.

문제: Tier 0 는 "에이전트 오케스트레이션"이 아니다 — 에이전트가 스스로 쓰고 스스로 검토하는 자기검토일 뿐, vault가 약속한 품질 게이트(독립 Feedback 에이전트가 클린 판정한 산출물만 사용자 게이트로)가 실현되지 않는다. 사용자 요구("단일 에이전트가 계획하도록 하지 말고 FactoryNote 자체 기능으로 에이전트 오케스트레이션이 동작")에 의해 Tier 1 을 유일 경로로 도입한다.

## 결정 (Decision)

1. **Tier 1 = 유일 경로.** Tier 0(인라인 자기검토) 코드 경로를 제거한다. 산출물은 항상 Design 자식 → Feedback 자식 루프를 거쳐 사용자 게이트로 간다.
2. **에이전트 매개 스폰(pi).** pi 확장 코드는 서브에이전트를 동기 스폰할 수 없다(`subagent` 도구는 에이전트 전용). 그러므로 `factorynote_plan` 이 단계 지시문(`spawn-design`/`spawn-feedback` + `spawnTask`)을 반환하면 **Director 에이전트가 자신의 `subagent` 도구로 자식을 스폰**하고 결과를 `designArtifact`/`feedbackResult`로 보고한다.
3. **`AgentSpawn` 계약(core) + 동기 루프 드라이버.** core에 `AgentSpawn` 인터페이스(`spawn(role, task) → Promise<string>`)와 순수 전이 `nextDesignFeedbackStep` + 동기 루프 드라이버 `runDesignFeedbackLoop(spawn)`를 둔다. 동기 스폰이 가능한 harness(CLI 하네스·테스트·향후 Codex/Claude 구현체)는 `runDesignFeedbackLoop`에 구현을 직접 주입한다. pi는 `nextDesignFeedbackStep`을 매 `factorynote_plan` 호출마다 써서 같은 전이 로직을 에이전트 매개로 구동한다. 양쪽이 같은 두뇌를 공유 → 테스트가 실동작을 게이트한다.
4. **루프 상한 + 에스컬레이션(FR-2, 내부 루프).** 내부 Design↔Feedback 루프는 `MAX_DESIGN_FEEDBACK_LOOPS`(=3)까지. 도달 시에도 이슈 잔존 → 마지막 초안을 에스컬레이션 프레이밍으로 사용자 게이트에 올린다(재작성/회귀/재협의 옵션). 사용자-modify 루프의 기존 FR-2 에스컬레이션과는 별개·독립 상한(`dfLoop` vs `loopCount`).
5. **NFR-7 폐기.** "항상 동작하는 기본=Tier 0" 보장은 제거 — 이제 동작하려면 서브에이전트 스폰이 가능한 환경이 필요하다. NFR-7에 기대던 폴백 경로가 사라진다(트레이드오프).

## 이유 (Rationale)

- vault가 정의한 오케스트레이션 모델을 Tier 0 는 실현하지 않는다 — 자기검토는 독립 검토가 아니다. "에이전트 오케스트레이션"을 제품 기능으로 만들려면 Tier 1 이 유일 경로여야 한다.
- **판정·실행은 프로토콜, 신뢰성은 코드**(Hybrid 원칙): 루프 전이·상한·에스컬레이션을 결정론적 코드(`orchestration.ts`)에 두면, 목 AgentSpawn 단위테스트로 전이를 게이트할 수 있다 — 비결정론적 라이브 스폰 없이도 오케스트레이션 로직을 증명.
- 에이전트 매개 스폰은 pi의 실제 제약(코드 직접 스폰 불가)에 대한 유일한 성실한 실현이다. `nextDesignFeedbackStep` 공유로 pi 경로가 테스트된 로직에서 벗어나지 않는다.

## 대안 (Alternatives)

- **Tier 0 유지 + Tier 1 선택적 강화(NFR-7 준수):** 사용자 요구("단일 에이전트가 계획하지 않도록")와 충돌 — 기각.
- **코드가 직접 스폰(AgentSpawn 어댑터를 drivePlan 내부에서 호출):** pi에서 구현 불가(`subagent` 도구 = 에이전트 전용). 동기 harness에서만 의미 — 기각(pi 주경로).
- **내부 루프를 프롬프트에만 규정(에이전트가 루프 카운트 자체 관리):** "신뢰성은 코드" 원칙 위반 — 상한·에스컬레이션이 비결정론적. 기각.

## 결과 (Consequences)

- **긍정:** vault 약속(독립 Feedback 클린 판정 후 게이트)이 실제로 동작. 오케스트레이션 로직이 결정론적 단위테스트로 게이트됨. 코어 harness-중립 유지(`AgentSpawn` + 순수 전이).
- **부정/트레이드오프:** NFR-7 폐기 — 서브에이전트 스폰 불가 환경에선 동작하지 않는다. Stage 당 `factorynote_plan` 호출 수 증가(스폰·보고 단계마다 1회). 구 state.json 마이그레이션(`dfPhase`/`dfLoop` 기본값) 필요.
- **후속:** Codex/Claude Code 어댑터(동기 스폰 가능 시 `runDesignFeedbackLoop` 직접 사용), 라이브 end-to-end 런 증거(Dev-Log) — 본 ADR 범위 밖(목 단위테스트가 하드 게이트).

## 참고

- [[multi-agent-pipeline]] — Director/Design/Feedback 모델
- [[03-module-architecture|workflow-core M2/M4]] — Orchestrator·AgentSpawn(Tier 0/1)
- [[ADR-005-mvp-implementation]] — MVP Tier 0 결정(본 ADR로 폐기)
- [[implementation-architecture]]
- [[Home]]
