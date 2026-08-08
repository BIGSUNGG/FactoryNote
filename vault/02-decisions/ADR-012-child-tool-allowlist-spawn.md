---
status: accepted
updated: 2026-08-08
tags: [adr, orchestration, context, agents]
---

# ADR-012: 자식 도구 allowlist 전환 — `toolBudget.block` 폐기, 명명 에이전트 `tools:` 도입

## 상태

accepted. [[ADR-010-context-overflow-file-protocol]] 의 스폰 컨텍스트 제약 정책(`toolBudgetBlock`)을 **정정** — 그 메커니즘이 시스템 프롬프트에서 도구를 제거하지 못함이 확인되어, 도구 제거 수단을 교체한다. 파일 프로토콜(ADR-010 결정 1·3·4)은 유효 그대로 유지.

## 날짜

2026-08-08

## 맥락 (Context)

[[ADR-010-context-overflow-file-protocol]] 결정 2는 자식 고정 세금(도구 스키마 ~30–50KB + 스킬 ~15–25KB)을 줄이기 위해 `SpawnOptions.toolBudgetBlock`(→ pi `toolBudget.block`)을 도입했다. 그러나 **실제 동작 분석 결과 이 메커니즘은 1261 방어에 무효**였다:

1. **`toolBudget.block` 은 프롬프트에서 도구를 빼지 않는다.** pi-subagents `tool-budget.ts` 의 `shouldBlockToolForBudget` 은 `nextToolCount > budget.hard` 일 때만 차단 — **런타임 카운트 게이트**일 뿐, 도구 스키마는 자식 시스템 프롬프트에 그대로 남는다. ADR-010 의 "자식 고정 세금 차단" 주장과 상충.
2. **`hard` 누락으로 예산 자체가 무효.** `validateToolBudgetConfig` 는 `hard`(≥1) 를 필수로 요구. 그러나 `CHILD_SPAWN_OPTIONS` 는 `block` 배열만 제공하고 `hard`/`soft` 를 단 한 번도 주지 않았다 → 검증 실패 → **자식은 예산 0 + 도구 전부 보존**.

결과: 자식은 "fresh + 경량화"가 아니라 부모와 거의 동일한 풀 도구 스키마 세금을 지고 스폰되어, 오케스트레이션 루프에서 1261 이 지속 발생.

## 결정 (Decision)

1. **명명 에이전트 + `tools:` 엄격 allowlist 로 도구 제거 수단을 교체.** `apps/pi-extension/agents/factorynote-design.md`·`factorynote-feedback.md` 를 두고, 프론트매터 `tools: read, write, edit, bash`(design)/`read, write, bash`(feedback) 로 **엄격 allowlist** 를 선언. 패키지 매니페스트(`package.json` `pi-subagents.agents`)로 패키지 에이전트로 배포. allowlist 에 없는 도구(context-mode·pi-lens·subagent·mcp·factorynote_plan 등)는 자식 시스템 프롬프트에서 **물리적으로 제거** — ADR-010 결정 2 가 목표했던 고정 세금 절감을 실제로 달성.
2. **`SpawnOptions` 재설계.** `toolBudgetBlock` 폐기. 새 구조: `agentName`(스폰할 명명 에이전트) + `toolBudget{hard,soft}` + `turnBudget{maxTurns}`. `CHILD_SPAWN_OPTIONS` 를 역할별(`design`/`feedback`) 맵으로. 어댑터가 `subagent` 호출의 `agent`/`skill`/`context`/`toolBudget`/`turnBudget` 로 매핑.
3. **`toolBudget.hard` 부여(방향 2).** design `{hard:20, soft:14}`, feedback `{hard:15, soft:10}`. 이제 `hard` 가 있어 카운트 상한이 실제 발동 — 과도한 파일 읽기/호출로 자식 컨텍스트가 팽창해도 종료 유도. `turnBudget.maxTurns` 로 어시스턴트 턴도 묶음.
4. **`clampReportInput` 가드(방향 3b — ADR-010 후속 이행).** 자식 보고 입력(`designArtifact` 경로 / `feedbackResult` 판정)이 과대(>4000자)면 첫 줄(판정/경로) 보존 후 절단. 자식이 규약(파일에 상세·반환은 경로/판정만) 을 위반해 본문을 반환해도 Director 컨텍스트 누적(1261 원인 ①) 을 막는다. ADR-010 "후속: LLM 비준수 감지/방어" 를 이행.

## 이유 (Rationale)

- **allowlist 만이 도구를 진짜로 뺀다.** pi-subagents `tools:` 프론트매터는 비어있지 않으면 엄격 allowlist 가 되어, 나머지 도구 정의를 레지스트리에서 제외(`_refreshToolRegistry` 의 `excludedToolNames` 경로). `toolBudget.block`(런타임 게이트) 와 근본적으로 다른 메커니즘. 이것만이 시스템 프롬프트 고정 세금을 줄인다.
- **명명 에이전트 = 자동 적용(robust).** allowlist 가 에이전트 정의에 고정되어, Director(LLM) 가 매 스폰마다 옵션을 잊더라도 자동 적용. soft(프롬프트 지시) 에 의존하지 않는다.
- **core 정책 소유 유지 + 단위테스트.** `agentName`/`toolBudget.hard`/`turnBudget` 은 core 지시문의 데이터 → `orchestration.test.ts` 가 역할별 정책을 결정론적 검증. allowlist 자체는 에이전트 파일에 있으나 어댑터 테스트가 파일을 읽어 배제 도구를 단언. "신뢰성은 코드" 원칙 준수.
- **방향 4(자식 모델 격리)는 연기.** allowlist 로 베이스를 줄인 뒤 남는 마진을 모델 교체로 확보하는 것은 별개 세팅. 본 ADR 이 구조적 원인(도구 세금) 을 먼저 해소.

## 대안 (Alternatives)

- **per-spawn `excludedToolNames`:** pi 코어(`_excludedToolNames`)는 도구를 레지스트리에서 빼지만, `subagent` 도구가 이를 per-spawn 파라미터로 노출하지 않는다(`toolBudget`/`model`/`skill` 만). 에이전트 설정 파일로만 가능 → 본 결정(명명 에이전트) 과 동일 경로.
- **`toolBudget.block` 유지:** 분석(맥락 1·2) 이 무효임을 증명. 기각.
- **`systemPromptMode: replace` 미사용(append):** 자식이 pi 기본 프롬프트를 물려 세금이 남음. replace 로 에이전트 자체 프롬프트만 사용해 최소화 채택.
- **방향 4(모델 격리) 병행:** 유효하나 allowlist 선행 후 별도 세팅으로 연기(범위 밖).

## 결과 (Consequences)

- **긍정:** 자식 시스템 프롬프트에서 수십 개 도구 스키마(subagent ~120KB README 기반 포함) 가 제거 → 턴-1 프롬프트 대폭 축소 → 1261 의 구조적 원인(자식 고정 세금) 해소. `toolBudget.hard`/`turnBudget` 으로 자식 누적 상한. `clampReportInput` 으로 Director 누적(비준수 본문) 방어(ADR-010 후속 이행).
- **부정/트레이드오프:** 자식이 `factorynote_plan`·`subagent`·web 검색 등을 사용 불가(의도됨 — 계획 산출물 작성·검토엔 read/write/edit/bash 면 충분). allowlist 가 에이전트 파일에 있어 core 단위테스트가 파일 읽기로 보조 검증(어댑터 테스트). 도구 한도 증명은 목 단위테스트(정책 정정)지 라이브 GLM 1261 비재현 증명 아님.
- **정정:** 본 ADR 은 [[ADR-010-context-overflow-file-protocol]] 결정 2(`toolBudgetBlock`) 를 정정·대체. ADR-010 결정 1(파일 프로토콜)·3(게이트 resolve)·4(paths 옵셔널) 은 유효 유지.

## 참고

- [[ADR-010-context-overflow-file-protocol]] (파일 프로토콜 + 스폰 제약 — 본 ADR 이 결정 2 정정)
- [[ADR-009-tier-1-agent-orchestration]] (Tier 1 에이전트 매개 스폰)
- [[implementation-architecture]] (코드 구조·런타임 데이터 흐름)
- 구현: `packages/factorynote/src/{types,orchestration,index}.ts` · `apps/pi-extension/src/{plan-tool,index}.ts` · `apps/pi-extension/agents/factorynote-{design,feedback}.md`
