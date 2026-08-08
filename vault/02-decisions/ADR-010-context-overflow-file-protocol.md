---
status: accepted
updated: 2026-08-07
tags: [adr, orchestration, context, agents]
---

# ADR-010: Director 컨텍스트 누적 차단 — 파일 경로 산출물 교환 + 자식 스폰 컨텍스트 제약

## 상태

accepted. [[ADR-009-tier-1-agent-orchestration]] 의 에이전트 매개 스폰 모델 위에 컨텍스트 한도 관리를 추가(변경 아닌 보강).

## 날짜

2026-08-07

## 맥락 (Context)

[[ADR-009-tier-1-agent-orchestration]] 로 Tier 1 오케스트레이션(Design 자식 → Feedback 자식 루프, Director 매개 스폰)을 도입했다. 그러나 **GLM-5.2(기본 컨텍스트 202,752 토큰; 1M 은 `glm-5.2[1m]` opt-in)** 환경에서 오케스트레이션 도중 `1261 Prompt exceeds max length` 가 발생한다. 누적 원천을 추적하니 네 가지:

1. **Director(영구 에이전트) 컨텍스트 누적** — design 산출물(draft)·designPrompt·Feedback 상세리뷰가 매 루프 `spawnTask`/`designArtifact`/`feedbackResult` 로 **인라인 본문**으로 주고받혀 Director 대화에 누적. Director 는 루프 내내 살아있어 가장 큰 누적원.
2. **자식 고정 세금** — 자식이 부모의 시스템 프롬프트(도구 스키마 ~30–50KB + 스킬 설명 ~15–25KB)를 상속.
3. **fork 상속** — 자식이 fork 로 돌아 Director 의 누적 대화를 물려받아 시작.
4. **자식 vault 문서 읽기** — Design 자식이 `implementation-architecture.md`(15.8KB) 등을 읽어 컨텍스트에 쏟음.

Director 가 영구적(자식은 ephemeral)이라 (1) 이 레버리지가 가장 크다.

## 결정 (Decision)

1. **파일 경로 산출물 교환 프로토콜.** designPrompt(stage 불변)·draft·Feedback 상세리뷰를 모두 파일(`.factorynote/<feature>/design-prompt.md`·`draft.<ext>`·`feedback.md`)로 영속. `spawnTask` 와 `designArtifact`/`feedbackResult` 보고는 **경로(+1줄 요약/판정)만** 주고받는다 — Director 컨텍스트가 루프 카운트와 무관하게 평탄.
2. **스폰 컨텍스트 제약 정책을 core 가 소유.** `SpawnOptions`(`skill:false`, `context:"fresh"`, `toolBudgetBlock`) 타입을 core(`types.ts`)에 두고, 모든 spawn 지시문이 이를 carry. pi 어댑터가 이 값을 `subagent` 도구의 `skill`/`context`/`toolBudget.block` 파라미터로 매핑해 Director 에게 전달 → 자식 고정 세금(②)·fork 상속(③) 차단.
3. **게이트에서 경로 → 내용 resolve.** core 게이트 지시문의 `artifact` 는 draft 파일 경로. pi 어댑터(`drivePlan`)가 게이트 직전 `readArtifact` 로 경로 → 내용을 꺼내 기존 `writeArtifact`/웹 표시 정합 유지.
4. **`paths` 옵셔널 — 동기 목 루프 호환.** `nextDesignFeedbackStep(def, state, report, draft, paths?)` 의 `paths` 를 옵셔널로. 제공 시 파일 프로토콜(pi 경로), 미제공 시 inline(동기 스폰 목 하네스·`runDesignFeedbackLoop`). 전이 로직(루프·상한·에스컬레이션)은 양쪽 동일 → 목 단위테스트가 여전히 실동작을 게이트.

## 이유 (Rationale)

- **영구 에이전트를 공략.** Director 가 루프 내내 살아있어 누적 레버리지가 최대. 파일 경로화는 인라인 본문 순환을 끊어 Director 컨텍스트를 평탄화 — (1) 을 직격.
- **core 정책 소유 = 테스트 가능.** 스폰 옵션을 프롬프트 텍스트(soft)가 아니라 core 지시문의 데이터로 두면, `orchestration.test.ts` 가 role 별 옵션·경로 참조를 결정론적 검증. "신뢰성은 코드" 원칙([[ADR-009-tier-1-agent-orchestration]]) 준수.
- **harness-agnostic 보존.** core 는 파일 I/O 없이 경로를 **데이터로** 주입받아 task 에 끼운다. 모든 파일 읽기/쓰기는 pi 어댑터(`persistence.ts` 재사용). 동기 목 루프는 inline 모드로 영향 0.
- (2)·(3) 은 자식 ephemeral 특성상 (1) 보다 작지만, 같은 메커니즘(`subagent` 옵션) 으로 1줄 추가로 잡힌다 — 가성비.

## 대안 (Alternatives)

- **`glm-5.2[1m]` opt-in(1M 컨텍스트):** 한도 자체를 올려 증상 완화. 단순하나 누적 원천(①②③)은 그대로 — 한도만 미루고 자식·Director 구조적 비대는 해소 안 됨. 본 ADR 과 배타 아님(별개 세팅으로 병행 가능), 그러나 구조적 원인 해소를 본 ADR 이 선행.
- **모델 교체(더 큰 컨텍스트 모델):** pi 종속·비용 증가. 오버헤드 자체를 줄이는 본 방안이 ponytail.
- **soft — PLAN_MODE_PROMPT 텍스트만:** "자식 스폰 시 skill:false·context:fresh·파일로 보고" 를 프롬프트에만. LLM 준수에 의존해 보장 약함. core 단위테스트로 증명 불가. 기각(사용자 확정: "구조화 — core 지시문이 스폰 옵션 전달").
- **파일 프로토콜을 동기 목 루프에도 강제:** 목 하네스는 GLM 한도 이슈가 없고 FS 가짜 구현 비용만 발생. `paths` 옵셔널로 inline 호환 — 기각(over-engineering).

## 결과 (Consequences)

- **긍정:** Director 컨텍스트가 루프 카운트와 무관하게 평탄 — 1261 의 주벅(①) 제거. 자식 고정 세금·fork 상속(②③) 차단. 스폰 정책이 core 단위테스트로 게이트.
- **부정/트레이드오프:** Director 가 프로토콜(파일에 쓰고 경로 보고·스폰 옵션 적용)을 준수해야 — LLM 비준수 시 여전히 본문이 흐를 수 있음(프롬프트로 강제하나 하드 보장 아님). 산출물 교환 단계(파일 쓰기·읽기) 추가. 게이트 resolve(path→content) 한 단계 추가.
- **후속:** 라이브 end-to-end 런 증거(1261 재현 안 됨 확인 — 목 테스트는 구조 증명이지 라이브 GLM 한도 증명 아님). LLM 비준수 감지/방어(자식 반환에 본문이 섞이면 Director 가 거부하도록).

## 참고

- [[ADR-009-tier-1-agent-orchestration]] (Tier 1 에이전트 매개 스폰 — 본 ADR 의 기반)
- [[implementation-architecture]] (코드 구조·런타임 데이터 흐름)
- 구현: `packages/factorynote/src/{types,orchestration,index}.ts` · `apps/pi-extension/src/{plan-tool,index}.ts`
