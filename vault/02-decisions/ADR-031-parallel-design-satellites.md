---
status: accepted
updated: 2026-08-18
tags: [adr, design, orchestration, parallel-agents]
---

# ADR-031: 병렬 위성 Design 에이전트(designLevel + 단계별 역할 메뉴)

> **TL;DR**: Design 스테이지를 선택적 병렬화한다. feedbackLevel 과 같은 패턴의 `designLevel`(low=주 문서만(현행), medium=주+1, high=주+2)과 단계별 design 역할 메뉴(Stage 별 3역할, 총 9개)를 추가하고, spawn-design 지시문을 주 문서(draft.md) 에이전트 + N개 위성(draft.<role>.md) 에이전트의 병렬 스폰(runs.all)으로 확장한다. 게이트·필수 그래프 검증·피드백·승격·프로모트는 주 문서 기준을 유지하고, 단계 무효화 시 위성 파일도 함께 삭제한다.

## 상태

accepted

## 날짜

2026-08-18

## 맥락 (Context)

FactoryNote의 Stage 설계 단계는 현재 **1명의 Design 에이전트**(`factorynote-design`)가 전체 산출물(draft.md + Stage 2 그래프)을 순차 작성했다. 산출물이 커질수록 단일 에이전트 컨텍스트 한도(1261)와 작성 시간이 병목이 되었고, 요구사항·설계·계획의 여러 전문 축을 병렬로 깊게 팔 수 있는 여지가 있었다.

한편 Feedback 쪽은 이미 메뉴 기반 동적 에이전트(`feedback-agents` 레지스트리 + `feedbackLevel` + `runs.all` 병렬 스폰, ADR-014·ADR-017)로 검증된 패턴이다. 이 패턴을 Design 쪽에 대칭 적용하는 것이 자연스러웠다. 단, **게이트·필수 그래프 검증은 주 문서 기준**을 지켜야 한다 — Stage 2 그래프는 시퀀스 참여자/플로우차트 노드가 모듈 트리 어휘에 결합되어 있어, 병렬 그래프는 어휘가 분기(divergence)할 수 있기 때문이다. 위성은 그래프를 만들지 않는 **추가 심도 문서**로 제한한다.

## 결정 (Decision)

1. **`DesignLevel` + `designLevel` 정책** — `DesignLevel = "low" | "medium" | "high"`(기본 `low` = 현행 단일 에이전트. 병렬은 opt-in). `DESIGN_LEVELS` 스펙: low=주 문서만, medium=주+1 위성, high=주+2 위성. `designLevelCountSpec(level)`은 총 에이전트 수(주 1 + 위성 N: 1/2/3) 지시 문구를 반환한다.
2. **단계별 design 역할 레지스트리** — `packages/factorynote/src/design-agents.ts` 신규: `DESIGN_AGENTS` 9개(Stage1: `requirements-scope`·`scenario-acceptance`·`nonfunctional-constraints`, Stage2: `module-structure`·`data-model`·`behavior-flows`, Stage3: `work-breakdown`·`risk-effort`·`verification-plan`), `designMenuForStage(stage)`가 단계별 3역할을 반환. `apps/pi-extension/agents/factorynote-design-<role>.md` 9개 파일은 생성기 산출물(core 레지스트리가 단일 진실).
3. **spawn-design 지시문 확장** — 주 문서 에이전트(기존 그대로, `draft.md` + 그래프 작성) + non-low 시 위성 N개를 `runs.all`로 **병렬 스폰**. 각 위성은 `design-prompt.md`를 읽고 `draft.<role>.md`(작업 영역 루트, `satelliteFileName`)만 쓰며 경로만 반환. 재작성 라운드도 같은 웨이브(주 문서 `designRevisionTask`, 위성 `designSatelliteRevisionTask`)로 재스폰 — 위성은 반려 이슈를 자기 관점에서 자기 파일에만 반영.
4. **설계 메뉴 파일** — `design-menu.md`(현 단계 역할 메뉴 + 레벨 지시)를 `design-prompt.md`·`feedback-menu.md`와 함께 기록, 게이트 전이 시 다음 단계 것으로 갱신. Director가 읽어 수량·역할을 추린다(스테이지 상태 저장 불필요, `feedback-menu.md`와 동일 기제).
5. **주 문서 중심 유지** — `checkRequiredGraph`(Stage 2 필수 그래프)·게이트·피드백 검토 대상·승격(`promoteGraphTree`)·확정은 **주 문서(draft.md) 기준 그대로**. 위성 문서는 작업 영역에 남고 `stageN/`로 승격되지 않는다.
6. **무효화 확장** — `invalidateArtifactsAfter`가 단계 무효화 시 해당 단계 위성 파일(`draft.<role>.md`, 역할명은 `designMenuForStage`로 결정론적 도출)도 함께 삭제한다. `.prev` 스냅샷은 위성 제외(등록 산출물만).
7. **뷰어 제약 기록(TODO)** — 현 뷰어는 단계당 단일 산출물만 표시한다. 위성 문서 미표시 제약을 `viewer-state.ts` 읽기 경로에 TODO 주석으로 남긴다(다중 문서 뷰어 구현은 이 결정 범위 밖).
8. **도구 스키마** — `factorynote_plan` 파라미터에 `designLevel`(low/medium/high) 추가, 지시문 프롬프트에 위성 병렬 스폰 규칙 반영.

## 이유 (Rationale)

- Feedback의 동적 메뉴·병렬 패턴(ADR-014·017)을 그대로 미러링해 개념·구현·에이전트 파일 간 대칭성을 유지한다 — 학습·유지 비용 감소.
- 기본 `low`로 현행 동작과 1:1 호환 → 회귀 위험 없이 opt-in 병렬화. 기존 테스트 전부 무변경 통과.
- 위성이 그래프를 만들지 않는 이유: Stage 2 그래프는 공유 어휘(모듈 트리·참여자·노드 id)에 결합된다. 병렬 그래프를 허용하면 어휘 분기로 검증·뷰어가 깨질 수 있다. 위성은 원문을 쪼개지 않고 **보완 심도**를 더한다.
- 위성 경로를 작업 영역 루트에 두고 승격에서 제외: 게이트 산출물 스키마·뷰어 계약을 건드리지 않으면서 교환 파일로만 동작. 무효화는 역할 메뉴에서 결정론적으로 유도해 상태(어떤 위성이 스폰됐는지) 저장이 필요 없다.

## 대안 (Alternatives)

- **위성 문서를 주 문서 본문에 병합** — 사용자가 거부(주 문서가 원문/그래프 소유권을 유지하는 현재 모델 유지). 병합은 주 문서 길이·리뷰 대상 복잡도를 키운다.
- **전 스테이지 디폴트 병렬**(기본 high) — 기본 동작 변경으로 기존 산출물·테스트 호환성이 깨진다. 기본 low(현행)로 둔다.
- **위성도 승격·뷰어 표시, 그래프 허용** — 그래프 기반 검증·뷰어 파싱 계약 확장이 필요한 큰 스코프. 다중 문서 뷰어는 TODO로 후행 작업을 분리했다.

## 결과 (Consequences)

- `designLevel=high`로 Stage를 돌리면 `.factorynote/<feature>/`에 `draft.md` + `draft.<role>.md` 2개가 생성되고, 집합 보고는 주 문서 경로를 `designArtifact`로, 각 위성을 `[name]` + 경로로 나열한다.
- 자체검증: `designMenuForStage` 9역할·`designLevelCountSpec` 1/2/3, spawn-design 지시문 메시지의 주+위성 병렬 스폰 및 파일 경로 명시, `engine.test.ts` 위성 무효화 테스트 추가. `bun run typecheck`·`bun test`·`bun run build` 통과.

## 참고 (References)

- [[ADR-014-dynamic-feedback-agents]], [[ADR-017-feedback-levels]], [[ADR-018-graph-artifacts]], [[ADR-020-graph-naming]], [[ADR-027-revision-highlight]]
