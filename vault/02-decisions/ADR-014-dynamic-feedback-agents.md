---
status: accepted
updated: 2026-08-09
tags: [adr, architecture, orchestration]
---

# ADR-014: 동적 feedback 에이전트(레지스트리 + Director 선택)

## 상태

accepted

## 날짜

2026-08-09

## 맥락 (Context)

[[ADR-013-parallel-feedback-pipeline]] 도 병렬 feedback 팬아웃을 도입했으나 **단계별 축 세트가 정적**(`stages.ts` 의 `feedbackAxes` 고정)이고 모두 **공용 `factorynote-feedback` 단일 에이전트**를 썼다. 두 한계:

1. **정적 선택**: 단계가 고정하면 같은 단계의 모든 기능에 같은 축이 검토된다 — 기능·산출물 맥락에 따라 다른 축이 의미있을 수 있는데 유연성 부족.
2. **단일 에이전트**: 도메인 전문성·도구 차등(web 검증·그래프 수정)이 불가.

[[ADR-008-3-stage-pipeline]] 의 5대 원칙(인간만 게이트 통과)과 [[ADR-010-context-overflow-file-protocol]] 파일 프로토콜은 유지해야 한다.

## 결정 (Decision)

**전역 `FEEDBACK_AGENTS` 레지스트리 + Director 동적 선택** 구조로 전환.

1. **레지스트리(단일 진실)**: `packages/factorynote/src/feedback-agents.ts` 에 ~32개 전문 에이전트({name, focus, checklist, capability, stages}). 역량 태그 `capability` 가 도구 티어 결정 — `static`(read/write/bash) · `web`(+web_search: feasibility/compliance/security/technology-fit/library-deps) · `graph`(+edit: structure/dependency-cycle/dependency-precedence, 그래프 fence 구조 수정).
2. **Director 동적 선택**: `factorynote_plan` 이 현 단계 필터 메뉴를 파일(`feedback-menu.md`)로 기록 → Director 가 메뉴 + 산출물·기능 맥락을 읽고 **상황에 맞는 N개(전형 3-6)를 추려** `subagent` `workflowScript runs.all` 로 **병렬** 스폰 → 집합 보고. 정적 축 세트 폐지.
3. **에이전트 파일은 생성 산출물**: `scripts/gen-feedback-agents.mjs` 가 레지스트리에서 `apps/pi-extension/agents/factorynote-feedback-<name>.md`(역량별 tools allowlist) 생성. 레지스트리가 단일 진실; 파일 드리프트 방지.
4. **제거**: 단계별 `feedbackAxes`(정적 선택) · 공용 `factorynote-feedback`(단일 에이전트). 3단계 게이트·인간 승인·파일 프로토콜·검토 요청 버튼·조건부 수정(1회)은 유지.

## 이유 (Rationale)

- **유연성**: Director 가 산출물·기능 맥락으로 매번 다르게 선택 — "이 기능은 보안이 중요하다"를 Director 가 판단. 정적 세트보다 상황 적응적.
- **전문성 + 도구 차등**: 역량 태그로 web(graph-CVE/라이브러리 검증)·graph(fence 구조 수정) 도구가 필요한 축에만 허용. 최소 권한 원칙 유지.
- **DRY**: 레지스트리가 단일 진실, 에이전트 파일은 생성 → 32개 파일 손 유지보수/드리프트 방지.
- **원칙 보존**: 선택·스폰은 기계가 하되 게이트 통과는 여전히 인간 전용(5대 원칙).

## 대안 (Alternatives)

- **능력-티어 3개(static/web/graph)만** — 에이전트 수 최소. 그러나 사용자가 "전부"를 원해 기각(도메인 전문성 확대).
- **단계별 고정 세트(ADR-013 유지)** — 결정론적이나 상황 적응성 없음. 기각.
- **축-키드 전문 풀(고정 매핑)** — Director 선택 없이 축↔에이전트 고정. 유연성 부족으로 기각.

## 결과 (Consequences)

- **긍정**: 상황 맞춤 검토(매 실행 다른 에이전트 조합) · 32개 전문 에이전트로 깊이 ↑ · web/graph 도구로 외부 검증·그래프 수정 가능 · 레지스트리 단일 진실로 유지보수 용이.
- **트레이드오프**: **비결정론적 선택** — 자동 테스트는 메커니즘(메뉴 노출·레지스트리·전이)만 검증, 선택 결과 자체는 검증 불가. 32개 에이전트 파일(생성 산출물, git 추적). Director 가 매번 메뉴를 읽고 판단(약간의 오버헤드).
- **한계**: Director 가 부적절하게 적게/많이 선택할 수 있음 — 게이트에서 사용자가 판단·검토 요청으로 보완.
- **후속**: 모델 티어(강/빠른) 라우팅 · 선택 품질 휴리스틱(메뉴에 추천 표시) · 레지스트리 확장 시 생성기 재실행(`bun scripts/gen-feedback-agents.mjs`).

## 참고

- 구현: `packages/factorynote/src/feedback-agents.ts`(레지스트리)·`orchestration.ts`·`stages.ts`(feedbackAxes 제거)·`types.ts`, `scripts/gen-feedback-agents.mjs`(생성기), `apps/pi-extension/agents/factorynote-feedback-*.md`(32개 생성 산출물)·`src/plan-tool.ts`·`src/index.ts`, `apps/plan-viewer/src/components/GateBar.jsx`(검토 요청 버튼)
- 선행: [[ADR-013-parallel-feedback-pipeline]](병렬 팬아웃) · [[ADR-012-child-tool-allowlist-spawn]](도구 allowlist) · [[ADR-010-context-overflow-file-protocol]](파일 프로토콜)
- 검증: `bun test`(98 자체체크) · `bun run build`(tsc -b + viewer + install) 종료코드 0
