---
updated: 2026-07-28
tags: [design, workflow-core, module-architecture]
stage: 3
status: approved
---

# Workflow Core 모듈 아키텍처

Workflow Core를 모듈로 분해하고 계층·책임·의존성을 정의한다.
요구사항은 [[01-requirements]], 시나리오는 [[02-scenarios]] 기준. 클래스 수준 상세는 Stage 4에서.

## 설계 원칙 (계층화의 근거)

1. **Hybrid** — 프로토콜(규칙)이 실행 본체, 얇은 코드가 신뢰성·연결 담당([[01-requirements]] 개요).
2. **harness-agnostic** — 이식 가능한 층(Layer 1-2)과 harness 접촉층(Layer 3)을 분리(NFR-1).
3. **판정·실행은 프로토콜, 신뢰성·연결은 코드** — 상태 atomic·검증은 결정론적 코드(NFR-2); 단계 진행·게이트 판정은 에이전트가 따르는 규칙.

## 3계층 구조

| 계층 | 책임 | harness 의존 | 형태 |
| ------------ | ----------------- | ---------- | --------------------- |
| **Protocol** | 무엇을 할지(단계 정의·규칙) | 무 | 마크다운 |
| **Engine** | 어떻게 구동·영속할지 | 무 | 프로토콜(규칙) + 얇은 코드(신뢰성) |
| **Adapter** | harness에 어떻게 연결할지 | 유 | 얇은 코드 + 바인딩 |

> 이식성 경계: **Layer 1-2만 복사하면 다른 harness로 옮겨갈 수 있다.** Layer 3만 harness별로 다시 쓴다.

## 모듈 (5개)

### M1. Stage Registry — Protocol 계층

- **책임**: 5 산출물 단계 정의(이름·산출물 템플릿·Design 프롬프트·Feedback 검증 기준) + Stage 6 검증 게이트(산출물 템플릿 없음). 읽기 전용 데이터.
- **형태**: 마크다운(데이터).
- **의존**: 없음(최하위).
- **구현**: FR-1(단계 순서), NFR-1(harness 중립).

### M2. Orchestrator — Engine 계층

- **책임**: Director 로직. 단계 순차 구동 · Design↔Feedback 루프 구동 · 인간 게이트 제시/판정 수집 · 회귀 처리.
- **형태**: 프로토콜(규칙) — 에이전트가 규칙을 읽고 실행. **게이트 판정은 상태 파일 기준**(NFR-2).
- **의존**: M1(무엇을), M3(영속), M4(에이전트 스폰).
- **구현**: FR-1, FR-2, FR-3, FR-7.

### M3. Persistence — Engine 계층

- **책임**:
  - **상태** — `state.json` atomic r/w(write-then-rename) + 스키마 검증 + resume + 감사 로그(verdict·loopCount·회귀 이력).
  - **산출물** — `<outputDir>/<feature>/` r/w(Doc-Conventions); 회귀 시 하류 산출물 `invalidated` 표시(파일은 보존).
- **형태**: 상태 = **얇은 코드**(신뢰성 필요, NFR-2); 산출물 작성 = 프로토콜(에이전트가 템플릿대로).
- **의존**: 디스크만.
- **구현**: FR-4, FR-5, NFR-2, NFR-3.

### M4. Agent Adapter — Adapter 계층

- **책임**: `AgentSpawn` 인터페이스 — `spawn(role, task) → result`.
  - **Tier 0(기본)**: 어댑터 없음 — Orchestrator가 Design/Feedback을 **인라인 역할 전환**으로 수행(인터페이스를 자명하게 만족).
  - **Tier 1(Pi)**: pi-crew로 **분리 에이전트** 스폰.
- **형태**: 인터페이스 + Pi 구현체(얇은 코드). Codex/Claude 구현체는 **OUT**(인터페이스만 정의).
- **의존**: pi-crew(Tier 1만, 선택적).
- **구현**: FR-6, NFR-1, NFR-7.

### M5. Command Entry — Adapter 계층

- **책임**: `/factorynote <feature>` 파싱. 신규 파이프라인 init vs 기존 resume 분기(S1/S5).
- **형태**: Pi 명령/스킬 바인딩(얇은).
- **의존**: M2(시작/resume 위임).
- **구현**: FR-8.

## 의존성 그래프

```
M5 Entry ──► M2 Orchestrator ──► M1 Stage Registry   (읽기)
                     │  ├─► M4 Agent Adapter          (Tier 0 / Tier 1)
                     │  └─► M3 Persistence            (state + artifacts)
M4 ──(Tier 1)──► pi-crew   (선택적)
M3 ──► 디스크 (.factorynote/state.json + <outputDir>/<feature>/ 산출물)
```

- **순환 없음.** M1 = 최하위(데이터), M3 = 디스크 경계. **Adapter(M4·M5)만 harness에 접촉.**

## 프로토콜 vs 코드 (Hybrid의 핵심)

| 모듈 | 프로토콜(규칙) | 얇은 코드 |
| ----------------- | ---------------- | ------------------ |
| M1 Stage Registry | 전부 | — |
| M2 Orchestrator | 전부(실행·판정) | — |
| M3 Persistence | 산출물 작성(에이전트) | 상태 atomic/검증/무효화 |
| M4 Agent Adapter | Tier 0(역할 전환 규칙) | Tier 1(pi-crew 호출) |
| M5 Command Entry | — | 바인딩 |

> 한 줄: **판정·실행은 프로토콜, 신뢰성·연결은 코드.** 이분할이 Hybrid를 정의한다.

## 패키지 맵 (파일 레이아웃, Stage 4에서 확정)

- **프로토콜**(M1·M2 규칙): 패키지 내 마크다운(stage defs, orchestrator rules) — `.pi/skills/factorynote/` 후보.
- **코드**(M3·M4·M5): 얇은 스크립트 — `.factorynote/` 또는 패키지 `scripts/` 후보.
- 상세 파일명·클래스는 Stage 4에서.

## Feedback 패스 결과 (Design↔Feedback 루프)

Feedback이 초안에서 잡아 Design이 반영한 항목:

- **과잉 분해**: State·Artifact를 별개 모듈로 뺐던 초안 → 디스크 I/O 응집·중복 감소를 위해 **M3 Persistence 하나로 병합**(상태/산출물 두 책임).
- **과잉 분해**: Gate를 별도 모듈로 뺐던 초안 → 인터랙티브 세션에선 별도 모듈 불필요, **M2 Orchestrator의 행위로 흡수**.
- **과잉 분해**: 감사 로그(NFR-3)를 별도 모듈로 → **M3 Persistence 책임에 포함**(상태와 같이 기록).
- **모호**: Tier 0가 "어댑터"인지 → "인터페이스를 자명하게 만족하는 기본 동작(어댑터 없음)"으로 명확화(M4). 결과: 모듈 8개 → **5개로 축소**(ponytail, NFR-4).
