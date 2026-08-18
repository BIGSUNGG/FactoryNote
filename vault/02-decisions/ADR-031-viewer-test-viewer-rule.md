---
status: accepted
updated: 2026-08-18
tags: [adr, viewer, work-principles, test-viewer]
---

# ADR-031: 뷰어 가시 변경 시 테스트 뷰어 갱신 의무

> **TL;DR**: 뷰어에서 사용자가 보는 것에 변경이 생기면 같은 세션에서 테스트 뷰어(`apps/plan-viewer/dev/mock-api.js` 시나리오 + `src/data/*.md` 예시 문서)를 갱신해 `bun run dev`로 확인 가능하게 한다. 문서 우선 원칙(원칙 3)의 하위 규칙이며, `.pi/extensions/viewer-test-viewer.ts`가 비차단 리마인더를 건다.

## 상태

accepted

## 날짜

2026-08-18

## 맥락 (Context)

뷰어(`apps/plan-viewer`)는 게이트의 사용자 인터페이스다. 에이전트가 뷰어를 수정하면 사용자는 실제 게이트(persist 서빙)나 테스트 뷰어(`bun run dev` + 목업)로 결과를 확인한다. 그런데 가시 변경(렌더링·UI·레이아웃·예시 문서)을 만들었는데도 테스트 뷰어 데모(목업 시나리오·예시 산출물)를 갱신하지 않으면, 사용자는 그 변경을 어디에서도 직접 볼 수 없다. 과거에도 낡은 뷰어 dist 서빙으로 가시 변경을 확인하지 못한 사고가 있었다([[graph-showcase-stale-dist]]).

4대 작업 원칙([[ADR-028-work-principles-harness-application]])의 문서 우선 원칙은 "코드 변경은 같은 세션에서 문서를 함께 갱신"을 강제하지만, "사용자가 보이는 산출물의 검증 수단"에 대한 규칙은 없었다. 테스트 뷰어는 사용자가 변경을 확인하는 **살아있는 문서** 성격이므로 원칙 3의 연장으로 명문화해야 한다.

## 결정 (Decision)

원칙 3(문서 우선)의 하위 규칙으로 다음을 추가한다.

1. **룰**: 뷰어에서 사용자가 보는 것(렌더링 · UI · 레이아웃 · 예시 문서)에 변경이 생기면, 같은 세션에서 테스트 뷰어 데모를 함께 갱신한다 — `apps/plan-viewer/dev/mock-api.js` 시나리오(필요 시)와 `apps/plan-viewer/src/data/*.md` 예시 문서. 사용자가 `cd apps/plan-viewer && bun run dev`(5180 포트)로 확인할 수 있어야 하며, 확인할 수 없는 가시 변경은 미완료로 취급한다.
2. **리마인더 훅**: `.pi/extensions/viewer-test-viewer.ts` 신규 — 뷰어 코드(`src/`·`vite.config.js`)를 write/edit 했는데 테스트 뷰어 데모(`dev/`·`src/data/`)를 건드리지 않은 채 실행이 종료되면 `agent_settled`에서 비차단 경고(work-principles.ts 패턴, ADR-028). "가시 변경 여부"는 기계적으로 완전 판정할 수 없으므로 경고만 하고 결코 차단하지 않는다.
3. **절차 문서**: `vault/90-meta/development-guide.md` '뷰어 수정' 섹션에 갱신 절차·검증 명령을 명시.
4. **원칙 텍스트**: `AGENTS.md` 원칙 3 하위 항목으로 룰과 근거 ADR 참조를 추가.

## 이유 (Rationale)

- 사용자는 게이트에서 **보이는 것**만 확인할 수 있다. 목업으로 시연되지 않는 가시 변경은 사용자 검증에서 누락되어, 다시 낡은 화면 사고([[graph-showcase-stale-dist]])로 이어질 수 있다.
- 기존 강제 패턴(프롬프트 원칙 + 리마인더 훅, ADR-028)과 동일해 구현·유지 비용이 낮고, 훅이 판단을 대신하지 않아 오탐에도 안전하다.
- 원칙 3의 하위 규칙으로 둔 이유: 테스트 뷰어는 사용자 확인용 살아있는 산출물이라 '문서 우선'의 성격과 동일하며, 독립 원칙 5를 만들 만큼 무게 있지 않다(원칙 목록 4개 유지).

## 대안 (Alternatives)

- **5번째 독립 작업 원칙** — 무게가 과함. 문서 우선(원칙 3)과 성격이 같아 하위 통합이 적합(사용자 협의로 확정).
- **하드 게이트(도구 차단)** — 가시성 판단은 에이전트 몫이라 오탐 위험. work-principles 결정(ADR-028)과 같은 이유로 배제.
- **전용 절차 스킬(`.pi/skills/`)** — 개발 가이드 절차 + 훅 리마인더면 충분. 문서 부담만 늘고 이득 없음(후속 세션에서 필요해지면 그때 추가).
- **루트 스크립트 `dev:viewer`만 안내** — 명령 노출은 가이드에 포함하되 전용 스크립트 추가는 불필요(기존 `package.json` 스크립트 사용).

## 결과 (Consequences)

- 긍정: 사용자 가시 변경의 검증 경로가 보장된다. 훅이 룰 위반을 매 세션 상기시킨다(차단 없음). 원칙 3과 동일 문서·훅 체계에 통합되어 설명 부담 없음.
- 트레이드오프: 데모 갱신이 불필요한 내부 리팩터링도 경고를 받을 수 있다(오탐) — 패턴 상수(`VIEWER_CODE_PATTERNS`·`TEST_VIEWER_PATTERNS`)에서 조절, 경고는 비차단이라 프로세스 방해 없음.
- 후속: 뷰어 가시 변경 작업 시 룰을 지키는 것이 지속 요구사항. 훅이 오탐/미탐을 보이면 패턴을 갱신한다.

## 참고

- [[ADR-028-work-principles-harness-application]] — 원칙·리마인더 훅 체계 (본 ADR의 모체)
- [[ADR-022-viewer-sse-push]] · [[ADR-024-chat-send-queue]] — 목업이 모방하는 실서버 의미론
- [[graph-showcase-stale-dist]] — 사용자가 가시 변경을 확인하지 못했던 과거 사고(교훈)
- 테스트 뷰어: `apps/plan-viewer/vite.config.js`·`dev/mock-api.js`·`dev/mock-api.test.js`
- `AGENTS.md` 원칙 3 하위 항목 · `vault/90-meta/development-guide.md` '뷰어 수정'
