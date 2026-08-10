---
status: accepted
updated: 2026-08-09
tags: [adr, architecture, orchestration]
---

# ADR-013: 병렬 Feedback 팬아웃 파이프라인

## 상태

accepted

## 날짜

2026-08-09

## 맥락 (Context)

[[ADR-009-tier-1-agent-orchestration]] 의 내부 Design↔Feedback 루프는 **단일 Feedback 자식**이 임의의 횟수(`MAX_DESIGN_FEEDBACK_LOOPS=3`)까지 Design 을 반복 수정시키는 구조였다. 두 한계가 드러났다.

1. **속도**: design↔feedback 은 본질 직렬(feedback 은 design 산출물에, redesign 은 feedback 이슈에 의존)이라 병렬화 불가. 수렴 실패 시 최악 **직렬 자식 스폰 6회**(design→feedback × 3)가 발생해 벽시간이 길어졌다.
2. **커버리지**: 단일 generalist Feedback 이 보안·확장성·논리 등 모든 관점을 한 번에 검토해야 해서 각 축의 검토 깊이가 얕았다.

[[ADR-008-3-stage-pipeline]] 의 5대 원칙(인간만 게이트 통과)은 유지해야 한다 — 기계(AI)는 게이트를 넘길 수 없고, 오직 사용자만 승인한다.

## 결정 (Decision)

내부 흐름을 **"Design 1회 → 축별 Feedback N개 병렬 팬아웃 → 조건부 Design 수정 1회 → 인간 게이트"** 구조로 전면 교체한다.

- **축별 병렬 Feedback**: `StageDefinition.feedbackChecklist:string[]` 을 `feedbackAxes:FeedbackAxis[]` 로 교체. 각 단계는 의미있는 축(Stage1 논리/완전성/모호성, Stage2 보안/확장성/구조, Stage3 정확성/실현가능성/리스크)로 feedback 을 분할. Director 가 `subagent` 도구의 `workflowScript runs.all` 로 N개 Feedback 자식을 **동시** 스폰해 집합 보고 → 벽시간 ≈ 1회분.
- **조건부 단일 수정**: 전 축 CLEAN 이면 수정 없이 게이트; 이슈 존재 시 **전 축 이슈를 하나의 합성 과제로 Design 에 주입해 1회 재작성**. 기본 사이클 수 = `DEFAULT_MAX_LOOPS=1`(파라미터화). 재수정본은 게이트로(재검토 루프 없음).
- **검토 요청 버튼**: 게이트 열린 동안 사용자가 **+1 사이클**을 런타임 강제. 새 `GateEvent { kind:"review-request" }` + `POST /api/review-request` 엔드포인트. drivePlan 은 게이트를 닫지 않고 feedback 단계로 재진입 → 수정 → 게이트 재오픈(산물 라이브 갱신).
- **제거**: `MAX_DESIGN_FEEDBACK_LOOPS` 상수·`dfLoop` 머신 증분·cap-도달 에스컬레이션(구 단일 루프 잔재). 3단계 게이트·인간 전용 승인·[[ADR-010-context-overflow-file-protocol]] 파일 프로토콜·FR-2 인간-modify 에스컬레이션은 유지.

## 이유 (Rationale)

- **분리 보존**: Design(작성자)과 Feedback(비판자)은 여전히 독립 자식 — 역할 통합(자기검토)은 검토 품질을 떨어뜨리므로 기각.
- **병렬 = 커버리지 무료**: N개 전문 축이 병렬로 깊이 검토해도 벽시간은 1회분. 단일 generalist 보다 깊으면서 느리지 않다.
- **단일 합성 수정**: 이슈를 한 번에 받은 Design 이 일관된 수정본을 내므로 순차 ping-pong 의 충돌/드리프트를 피한다. 루프를 없애 수렴 비용을 상한선으로 고정.
- **인간이 수렴**: 기계는 게이트를 넘을 수 없으므로(5대 원칙), 수정 1회 후 인간 게이트로 넘기는 것이 원칙에 정합. 추가 정제는 사용자 판단(검토 요청 버튼)이 주도.

## 대안 (Alternatives)

- **Design+Feedback 단일 자기비판 에이전트 통합** — 스폰 반감(속도 ↑)이나 작성자/비판자 분리 파괴(자기검토는 약함). **기각**.
- **async 어드바이저리 Feedback**(게이트와 병렬로 1개 feedback 만 비블로킹) — 가장 가벼우나 단일 generalist 라 커버리지 개선 없음. 병렬 팬아웃이 커버리지까지 잡으므로 채택 안 함.
- **fanout 자식으로 루프 전체 이관**(Director 매개 오버헤드 제거) — 유효하나 계층 추가. 병렬 팬아웃이 속도·커버리지를 잡았으므로 매개 구조는 유지.
- **루프 상한 3→2**(캡만 낮추기) — 수렴 실패 경로만 줄일 뿐 커버리지 미해결. 근본 구조 변경이 아님.

## 결과 (Consequences)

- **긍정**: 수렴 실패 시 직렬 스폰 6→(design + 병렬 feedback + 조건부 수정) 2~3 벽시간 단위로 단축. 축별 검토 깊이 향상. 사용자가 정제 횟수를 런타임 제어(검토 요청).
- **트레이드오프**: 기계 연산 비용 증가(design 1~2 + feedback N). 단, 병렬이라 벽시간엔 영향 적고 N은 cheap 모델·최소 예산으로 운용.
- **한계**: 수정 1회가 충분하지 않을 수 있음 — 잔존 이슈는 인간 게이트가 판단(원칙 정합). 품질바이 필요 시 검토 요청 반복 또는 `maxLoops` 파라미터 상향.
- **후속**: 루프 횟수를 늘리는 **런타임 커맨드/설정파일** 구현(이번엔 파라미터 주입점만 노출, `DEFAULT_MAX_LOOPS` 오버라이드 훅). 축 구성의 단계별 튜닝.

## 참고

- 구현: `packages/factorynote/src/orchestration.ts`·`stages.ts`·`types.ts`, `apps/pi-extension/src/plan-tool.ts`·`gate-server.ts`, `apps/plan-viewer/src/components/GateBar.jsx`·`App.jsx`
- 선행: [[ADR-009-tier-1-agent-orchestration]](내부 루프 도입) · [[ADR-010-context-overflow-file-protocol]](파일 프로토콜) · [[ADR-012-child-tool-allowlist-spawn]](자식 도구 allowlist) · [[ADR-008-3-stage-pipeline]](3단계 게이트)
- 검증: `bun test`(99 자체체크, 병렬 팬아웃·조건부 revision·검토 요청 전이 포함) · `bun run build`(tsc -b + viewer + install) 종료코드 0
