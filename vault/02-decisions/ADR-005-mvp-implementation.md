---
status: accepted
updated: 2026-08-07
tags: [adr, mvp, implementation, plan-mode, viewer, pi]
---

# ADR-005: MVP 구현 결정 — plan 모드 토글, 웹-as-게이트, 통합 런타임 디렉토리, Tier 0

> **결정 #4(Tier 0)·NFR-7 은 [[ADR-009-tier-1-agent-orchestration]] 로 폐기(superceded)되었다(2026-08-07).** 본 ADR 의 나머지 결정(#1·2·3·5·6·7)은 유효.

## 상태

accepted

## 날짜

2026-08-01

## 맥락 (Context)

모든 진입점이 빈 배럴/스텁("Stage 5 구현 예정")인 상태에서 MVP 구현(Stage 5)에 착수. 사용자 시드 요청 5종(`/factorynote` 모드 토글, plan 모드 시 문서 작성+웹페이지 오픈, 웹에서 수정/확정 → 에이전트 진행, pi에서 실동작, 로컬 pi 설치)과 기존 설계([[multi-agent-pipeline]], [[01-requirements|workflow-core FR/NFR]], [[ADR-003-viewer-architecture]]) 사이에 몇 가지 결정이 필요했다. 특히 ADR-003은 웹 뷰어를 '옵션'으로 보았으나 사용자는 웹페이지를 명시적으로 요청했고, FR-8은 `/factorynote <feature>` 직접 시작이나 사용자는 '모드 토글'을 말했다.

## 결정 (Decision)

1. **plan 모드 = `/factorynote` 토글** — `registerCommand` 로 세션 내 불리언 토글. ON 시 `before_agent_start` 가 계획 전용 시스템 프롬프트를 주입하고 `factorynote_plan` 도구를 활성화. FR-8(직접 시작)이 아닌 사용자 시드의 '모드' 모델 채택.
2. **웹 페이지가 게이트(주경로)** — 확장이 로컬 HTTP 서버(`node:http`)로 뷰어 dist 를 서빙, 브라우저 오픈. 사용자가 웹에서 확정/수정(코멘트+'수정 지시') → POST `/api/decision` → 에이전트가 결정을 받아 전이. ADR-003 의 '옵션' 경로를 주경로로 격상.
3. **통합 런타임 디렉토리 `.factorynote/<feature>/`** — `state.json` + `NN-stage.md` 산출물 모두 한 디렉토리. FR-4 기본 `designs/` 에서 이탈이나 사용자 시드("`.factorynote` 폴더에 문서") 부합 + gitignore 1건으로 처리.
4. **Tier 0 단일 에이전트** — Design/Feedback 역할을 단일 pi 에이전트가 인라인 전환(1패스 자기검토 체크리스트). pi-crew(Tier 1) 분리 스폰·Design↔Feedback 반복 상한 루프(FR-2)·다중 단계 점프 회귀(FR-7)는 MVP 제외(approve+revert/modify 만). 게이트는 approve/modify/revert. _⚠ 본 결정은 [[ADR-009-tier-1-agent-orchestration]] 로 폐지 — Tier 1(Design↔Feedback 자식 스폰)이 유일 경로._
5. **제어흐름+영속 = 실행 코드, 산출물 판단 = LLM** — 엔진(순수 상태기계)+persistence(atomic r/w)는 harness-agnostic TS 로 구현(단위테스트 가능). 각 단계 산출물 '내용' 은 LLM(Design 역할)이 작성. "얇은 상태기계가 영속/resume 담당" 원칙 준수.
6. **6단계 전부 마크다운 렌더** — 목업 `PlanPage`(블록/셀/드래그 코멘트 + '수정 지시' 일괄 적용 + 게이트 바)로 모든 단계 산출물 렌더. Stage 3/4 그래프 에디터(react-flow)는 MVP 제외(게이트 동작에 불필).
7. **코어 런타임 npm 의존 0 + 파일 복사 설치** — 코어는 `node:*` builtins 만 사용. 설치는 `~/.pi/agent/extensions/factorynote/` 에 확장 TS + `@factorynote/core`(로컬 `node_modules` 패키지로 복사) + 뷰어 dist 를 배치. pi(jiti)가 TS 를 직접 로드.

## 이유 (Rationale)

- 사용자 시드가 '모드'·'웹페이지'를 명시 → ADR-003/FR-8 보다 사용자 의도 우선.
- Tier 0 는 [[01-requirements|NFR-7]] 이 보장하는 '항상 동작하는 기본' → MVP 는 이것으로 충분, pi-crew 는 강화(선택)로 남김.
- 통합 디렉토리·마크다운 통일 렌더·런타임 의존 0 는 구현량 최소화(ponytail) + 설치 단순화.
- 제어/판단 분리는 프로토콜(판단)은 에이전트가, 신뢰성(영속)은 코드가 담당한다는 hybrid 원칙의 실행.

## 대안 (Alternatives)

- **FR-8 직접 시작 + ADR-003 Tier 0(마크다운+pi 프롬프트)**: 사용자 시드(웹페이지·모드)와 충돌 → 기각.
- **Tier 1(pi-crew) 분리 에이전트**: MVP 구현량 과다, NFR-7 이 Tier 0 를 정당화 → 연기.
- **Stage 3/4 그래프 에디터**: 게이트(확정/수정)에 불필, 마크다운(mermaid 포함)로 충분 → 연기.
- **`@factorynote/core` 번들링(단일 파일)**: 설치 시 로컬 패키지 복사가 더 단순 + 리포 구조(코어/어댑터 분리) 유지 → 채택 안 함.

## 결과 (Consequences)

- **긍정**: 사용자 요청 5종 모두 충족, 6단계 게이트가 pi 에서 실동작, 코어 harness-중립 유지, 설치는 파일 복사 1회.
- **부정/트레이드오프**: pi-crew 없이 단일 에이전트가 역할 전환(검토 품질은 에이전트 자기테스트에 의존); Stage 3/4 그래프 편집 미제공; 반복 상한 루프·다중 회귀 미구현.
- **후속**: Tier 1(pi-crew) 스폰, Design↔Feedback 상한 루프, Stage 3/4 그래프 에디터, Codex/Claude Code 어댑터.

## 참고

- [[multi-agent-pipeline]] — 6단계·에이전트 역할
- [[01-requirements|workflow-core 요구사항]] — FR-2/3/4/5/7/8, NFR-7
- [[ADR-003-viewer-architecture]] — 뷰어/게이트 원안(본 ADR이 웹을 주경로로 격상)
- [[ADR-004-monorepo-structure]]
- [[Home]]
