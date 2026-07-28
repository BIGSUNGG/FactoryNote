---
updated: 2026-07-28
tags: [design, workflow-core, implementation-plan]
stage: 5
status: approved
---

# Workflow Core 구현 계획

클래스 구조([[04-class-structure]])를 빌드 순서·의존성·마일스톤으로 전개한다.
최종 검증(전체 Plan)은 Stage 6에서.

## 구현 결정

| 항목 | 결정 | 근거 |
| ---- | ---- | ---- |
| **언어(얇은 코드)** | **Node.js `.mjs` + JSDoc** | 빌드 단계 없음, 에디터 타입 힌트, `node` 직접 실행. ~200LOC 규모엔 TS 빌드 오버헤드 과잉(ponytail) |
| **상태 검증** | **손검 작성**(스키마 버전 필드) | npm 의존성 0개. 스키마 늘어나면 zod 도입 검토 |
| **런타임 의존성** | **0개** | pi-crew는 npm 의존성이 아니라 Pi harness의 실행기(M4가 호출). .mjs는 순수 Node |
| **실행 모델** | 에이전트가 SKILL.md 규칙을 따라 `.mjs` CLI를 호출 | Hybrid: 프로토콜이 본체, 코드는 신뢰성·연결만 |

## 핵심 원칙: Tier 0 수직 슬라이스 먼저

**pi-crew 없이** 모든 harness에서 동작하는 Tier 0(인라인 역할 전환) 파이프라인을 먼저 완성한다.
이게 아키텍처 전체를 가장 싸게 검증한다 — pi-crew 의존 붙이기 전에 6단계+게이트가 도는지 확인.

## 구현 순서

### Phase 0 — 기반 (파이프라인 아직 안 돌음)

| 태스크 | 산출물 | 의존 |
| ---- | ---- | ---- |
| 0.1 리포 스캐폴드 | 패키지 구조(`.pi/skills/factorynote/`, `src/factorynote/`), `.gitignore`(`.factorynote/`) | — |
| 0.2 M1 Stage Registry | 6개 단계 정의 마크다운(`stages/01-…06-…`) + 산출물 템플릿 | — |

### Phase 1 — Tier 0 수직 슬라이스 (파이프라인 작동)

| 태스크 | 산출물 | 의존 |
| ---- | ---- | ---- |
| 1.1 M3 `state.mjs` | 스키마 + `load/save/validate/advance/invalidate`, atomic 쓰기 | 0.1 |
| 1.2 M2 `SKILL.md` | orchestrator 규칙(Tier 0 인라인 역할 전환) | 0.2, 1.1 |
| 1.3 M5 `entry` | `/factorynote <feature>` 바인딩(init/resume 분기) | 1.2 |
| 1.4 스모크 테스트 | 가짜 feature로 6단계 엔드투엔드(Tier 0) | 1.1-1.3 |

### Phase 2 — Tier 1 (pi-crew 격리)

| 태스크 | 산출물 | 의존 |
| ---- | ---- | ---- |
| 2.1 M4 어댑터 | `PiCrewAdapter` + `InlineAdapter` + `available()` 선택 | 1.4 |
| 2.2 SKILL.md 통합 | 어댑터 가용 시 Tier 1, else Tier 0 | 2.1 |
| 2.3 실제 테스트 | 분리 Design/Feedback 에이전트로 feature 설계 | 2.2 |

### Phase 3 — 강화

| 태스크 | 산출물 | 의존 |
| ---- | ---- | ---- |
| 3.1 에러 처리 | 서브에이전트 장애·재시도·알림(NFR-6) | 2.3 |
| 3.2 상태 복구 | 손상 감지·에스컬레이션(NFR-2) | 1.1 |
| 3.3 감사 완결 | 루프/게이트/회귀 이력 전 기록(NFR-3) | 1.1 |
| 3.4 회귀 엣지 | 다단계 점프 회귀·루프 상한 에스컬레이션(FR-7/FR-2) | 1.2 |
| 3.5 컨벤션 | 산출물 frontmatter/이름 Doc-Conventions 강제 | 0.2 |

## 마일스톤 (각 단계 증명 것)

- **M0** — 패키지 구조 + 6단계 정의 존재(읽기 전용 데이터 검증).
- **M1** — `/factorynote demo` 실행 시 Tier 0로 6단계가 돌고 산출물이 `designs/demo/`에 쌓임. **이 시점부터 FactoryNote 사용 가능(어떤 harness든).**
- **M2** — Pi에서 Design/Feedback이 분리 에이전트로 동작. 격리/독립컨텍스트 확보.
- **M3** — 장애·복구·감사·엣지 케이스 처리. 프로덕션 준비.

## 순서의 근거

1. **M1(Stage Registry) 최우선** — 다른 모든 것이 읽을 데이터. 의존 최하위.
2. **M3(state.mjs)를 M2보다 먼저** — 신뢰성 기반. 규칙(M2)은 state 위에서 도니까.
3. **Tier 0를 Tier 1보다 먼저** — pi-crew 없이 전 아키텍처 검증. 의존성 늦게 붙임(NFR-7 우아한 축소와 정합).
4. **강화(Phase 3)는 나중** — 작동하는 파이프라인 먼저, 엣지 케이스는 그 후(ponytail: 동작 > 완전함).

## 리스크 / 미해결 (구현 중 해소)

| 리스크 | 완화 |
| ---- | ---- |
| `/factorynote` 명령 바인딩 형태(Pi 스킬 vs 명령) 미확정 | Phase 1.3에서 Pi 스킬 문서(`docs/skills.md`) 확인 후 확정 |
| pi-crew 서브에이전트 인터페이스(`spawn(role,task)→result` 매핑) 미확정 | Phase 2.1에서 `crew_agent`/`Agent` 툴 shape 확인 |
| 에이전트가 SKILL.md 규칙을 신뢰성 있게 따를지(Tier 0 핵심 리스크) | **state.json이 권위(NFR-2)** — 에이전트가 흘러도 state가 판정 기준. 스모크 테스트로 규칙 준수 검증 |
| 상태 스키마 진화 | `version` 필드 + 마이그레이션 훅 |
| 본 dogfood 자체가 프로토콜 타당성의 사전 증거 | 6단계를 수동으로 돌려보며 이미 검증 중 → Phase 1.4는 이걸 코드화 |

## Feedback 패스 결과 (Design↔Feedback 루프)

- **과잉**: Phase 0·1을 한 단계로 합치려 했던 초안 → 기반(데이터)과 수직 슬라이스(동작) 분리가 검증에 유리 → 2 phase 유지.
- **누락**: 런타임 의존성 명시 없었음 → "npm 의존 0개(pi-crew는 harness 실행기)" 명시로 범위 명확화.
- **리스크 미표현**: Tier 0가 "에이전트가 규칙을 따른다"에 전적으로 의존 → **state.json 권위를 백스톱**으로 명시(Hybrid의 근본 리스크 정면 대응).
- **검증 연계**: 구현 계획에 테스트를 섞으려 했던 초안 → 최종 검증은 Stage 6(사용자 검증 게이트)으로 이관(역할 분리).
