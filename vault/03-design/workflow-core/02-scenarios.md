---
updated: 2026-07-28
tags: [design, workflow-core, scenarios]
stage: 2
status: approved
---

# Workflow Core 정상 동작 시나리오

Workflow Core가 **정상적으로 동작할 때** 어떻게 행동해야 하는지를 시나리오로 묘사한다.
요구사항은 [[01-requirements]](Stage 1)를 기준으로 한다. 정상 경로(happy path) 중심.

> 모든 시나리오는 **Tier 무관**이다 — 흐름은 동일하고, 에이전트 스폰 수단만 다르다
> (Tier 0: 인라인 역할 전환 / Tier 1: pi-crew 분리 에이전트). 시나리오엔 Tier를 명시하지 않는다.

## 행위자

- **사용자** — `/factorynote` 로 시작하고 각 게이트에서 판정(승인/수정/정정)을 내린다.
- **Director** — 파이프라인 조율, 상태 파일 권위, 에이전트 스폰/수거.
- **Design / Feedback** — 단계별 산출물 작성 / 검토.

## S1: 새 파이프라인 시작

**전제:** 사용자가 Pi 세션에 있고, feature "auth" 설계를 시작하려 한다.

**흐름:**

1. 사용자가 `/factorynote auth` 실행.
2. Director가 `.factorynote/state.json` 생성 — `feature: auth`, `stage: 1`, `status: running`, `loopCount: 0`.
3. `designs/auth/` 디렉터리 준비.
4. Director가 Stage 1 진입, Design 에이전트 스폰.

**결과:** `state.json` 존재, Stage 1 산출물 작성 시작. 동일 feature 재실행 시 기존 파이프라인을 resume(S5).

## S2: 단계 정상 완료 (Design → Feedback 클린 → 게이트 승인)

**전제:** Stage N 진입, `state.json.status == running`.

**흐름:**

1. Director가 **Design** 스폰 → 단계 산출물 작성.
2. Director가 **Feedback** 스폰 → 산출물 검토 → **클린 판정** 반환.
3. Director가 산출물을 **사용자 게이트**에 제시(산출물 요약 + Feedback 클린 근거).
4. 사용자가 **승인** 판정.
5. 산출물을 `<outputDir>/<feature>/<NN>-<stage>.md`로 저장(기본 `designs/`, 설정 가능; vault 의존 X; Doc-Conventions 준수).
6. `state.json` 갱신 — `stage: N+1`, `gate: approved`, 산출물 경로 기록.

**결과:** 다음 단계 진입 준비 완료. 게이트 판정은 `state.json`에 기록되어 권위가 된다.

## S3: Design↔Feedback 루프 (이슈 → 수정 → 클린)

**전제:** Stage N, Design 1차 산출물 작성됨.

**흐름:**

1. Feedback 검토 → **이슈 2개 발견**(예: 보안 결함 1, 구조 문제 1) → Design에게 피드백 전달.
2. Design이 산출물 수정 후 재제출.
3. Feedback 재검토 → **클린 판정**.
4. 흐름이 S2의 단계 3(게이트)으로 합류.

**결과:** 클린 산출물로 게이트 도달. `state.json`에 `loopCount` 증분 기록(여기선 2). **반복 상한(3) 내**라 정상 경로.

## S4: 전체 파이프라인 완료

**전제:** Stage 6(검증) 게이트 대기.

**흐름:**

1. Stage 6: 사용자가 **전체 Plan**(산출물 1-5)을 총괄 검증·**승인**. (Stage 6은 산출물을 만들지 않는다.)
2. `state.json` 갱신 — `status: completed`, `stage: 6`.
3. 5개 산출물이 `<outputDir>/<feature>/`에 누적:
   `01-requirements` · `02-scenarios` · `03-module-architecture` · `04-class-structure` · `05-implementation-plan`. (Stage 6은 검증 게이트, 산출물 파일 없음)

**결과:** 파이프라인 종료. 해당 feature의 5개 산출물이 **진실의 원천**이 된다(Stage 6은 검증 게이트). 사용자가 doc-workflow대로 Changelog/Dev-Log 수동 갱신.

## S5: 세션 넘겨 resume

**전제:** Stage N 게이트 대기 중 Pi 세션 종료. `state.json`은 디스크에 남아있음.

**흐름:**

1. 새 세션에서 사용자 `/factorynote <feature>`(또는 resume).
2. Director가 `state.json` 로드 → 현재 `stage`, `gate` 상태, `loopCount`, 산출물 경로 복원.
3. 종료 지점의 게이트를 재개시(이미 클린 산출물이 있으므로 Design 재작성 없이 게이트만 재제시).

**결과:** 종료 지점에서 정확히 재개. 산출물·루프 이력·회귀 이력 모두 보존. 상태 파일 손상 시(NFR-2) 감지 후 사용자 알림.

## S6: 회귀 (정정, 여러 단계 점프)

**전제:** Stage 4(클래스 설계) 게이트. 사용자가 Stage 2(시나리오) 근본 결함 발견.

**흐름:**

1. 사용자가 **정정 → Stage 2** 선택.
2. Director가 Stage 3·4 산출물을 **무효화**(`status: invalidated` 표시, 파일은 보존).
3. `state.json` 갱신 — `stage: 2`, 회귀 이력에 `[{from:4, to:2, reason}]` 추가.
4. Stage 2 재진입(Design이 기존 산출물을 수정 출발점으로 사용 가능).

**결과:** Stage 2부터 재설계. 무효 산출물은 비권위로 표시되나 추적을 위해 보존.

## 정상 경로 요약 (엔드투엔드)

```
/factorynote <feature>        ← S1 시작
   │
   ▼
[Stage 1..6 각각]             ← S2 한 단계 정상 완료
   Design 작성 ─► Feedback 검토 ─►(이슈면 S3 루프)
        │  클린
        ▼
   사용자 게이트 ─► 승인 → 산출물 저장 → 다음 단계
        │  (정정이면 S6 회귀)
        ▼
Stage 6 승인 → completed       ← S4 완료
   │  (세션 끊기면 S5 resume)
   ▼
5개 산출물 + Stage 6 최종 검증
```

## Feedback 패스 결과 (Design↔Feedback 루프)

Feedback이 초안에서 잡아 Design이 반영한 항목:

- **중복**: Tier 0/Tier 1마다 시나리오를 따로 쓰려 했던 초안 → 흐름이 동일하므로 **Tier 무관 선언** 한 줄로 처리(중복 시나리오 제거).
- **누락**: 게이트 판정이 어디에 기록되는지 안 보임 → S2·S6에 `state.json` 갱신 명시(NFR-2 상태 권위와 연결).
- **모호**: resume 시 산출물을 다시 쓰는지 안 쓰는지 → S5에 "클린 산출물 있으면 게이트만 재제시, 재작성 없음" 명시.
- **범위**: 반복 상한 초과(비정상)는 happy path가 아니므로 Stage 6(검증)에서 별도 처리 예정 — 여기선 S3에서 "상한 내라 정상"으로만 명시.
