---
status: accepted
updated: 2026-08-03
tags: [adr, pipeline, fr-7, fr-2]
---

# ADR-007: 파이프라인 경화 — 다단계 회귀·반복 상한 에스컬레이션·게이트 타임아웃·resume·plan 모드 자동 해제

## 상태

accepted

## 날짜

2026-08-03

## 맥락 (Context)

MVP([[ADR-005-mvp-implementation]]) 병렬 3-워크트리 통합(`fn-integration`) 후 식별된 **통합 결함(seam gap) + 요구사항 미완**. 상세는 [[parallel-worktree-seam-defects]] 포스트모텸.

- **FR-7(다단계 회귀 + 대상 이후 산출물 무효화)** — 엔진 역량은 있었으나 뷰어/서버 seam이 끊겨 **1단계 회귀만 동작**. `invalidateArtifactsAfter`가 어디서도 호출 안 됨(dead code).
- **FR-2(반복 상한 에스컬레이션)** — `atLoopCeiling`이 advisory-only(메시지 한 줄)라 상한 도달 에스컬레이션 요구 미충족.
- **#4 게이트 타임아웃** — `runGate` `timeoutMs` default 0(끔)이라 사용자 이탈 시 **좀비 게이트(무한 대기)**.
- **#3 gateOpen resume** — 게이트 열린 채 인터럽트 시 재시작이 산출물 재작성을 잘못 요구.
- **#5 plan 모드 잔류** — Stage 6 승인 후에도 `planMode` ON → 사용자가 매번 `/factorynote` 토글.
- **P0** — `gate-server` `/api/decision` 이 decision 재조립 시 `revertTo`를 drop → D5 다단계 회귀 end-to-end 무력화. ast-grep audit는 구조상 검출 불가, **review 서브 재심사로 포착**.
- **P1** — `validateState` 마이그레이션이 `typeof==='number'`라 `NaN` 통과.

## 결정 (Decision)

1. **FR-7 다단계 회귀 end-to-end** — `GateDecision.revertTo`(뷰어 Stage 셀렉터) → `gate-server` forward → 엔진 `applyVerdict` clamp(`1..현단계-1`) + `validThrough` 갱신 + `invalidateArtifactsAfter(state.stage)` 호출(대상 이후 산출물 삭제). 마이그레이션은 `Number.isFinite` 가드(null/NaN → 0).
2. **FR-2 경성 에스컬레이션** — `modify@ceiling`(`atLoopCeiling`) 시 에스컬레이션 메시지로 전환 — 잔존 이슈 노출 + (a)재작성 (b)회귀 (c)재협의 옵션. advisory → 경성.
3. **게이트 타임아웃 활성화** — `runGate` `timeoutMs` 기본 30분 + `settled` 1회-resolve 가드 → 만료 시 자동 `modify` 복귀(좀비 방지). signal-abort와 직교.
4. **gateOpen resume** — `drivePlan`이 gateOpen+산출물 존재 시 재작성 요구 없이 게이트 재오픈.
5. **plan 모드 자동 해제** — 파이프라인 `done` 시 `planMode=false`.

## 이유 (Rationale)

- **다단계 회귀 경계** — FR-7 "대상 이후 무효화"의 경계는 `state.stage`(=회귀 대상 target)이지 `validThrough`(=target−1)가 아님. 무효화 호출은 `plan-tool`(단일 owner)이 `applyVerdict` 후 수행 → wiring을 한 소유자에 귀속해 seam 재발 방지.
- **경성 에스컬레이션** — 같은 방식의 재작성 반복은 근본 갈등의 신호 → 사용자에게 명시적 선택지 제공(advisory보다 FR-2 의도 부합). Tier-0(게이트가 매 modify마다 열림)에선 에스컬레이션 = 메시지/선택지 노출이 자연스러운 구현.
- **타임아웃 30분** — 너무 짧으면 활성 리뷰 끊김, 너무 길면 좀비. signal-abort(pi 인터럽트)와 timeout(사용자 이탈)이 직교하므로 둘 다 `settled` 가드로 1회 resolve 보장.
- **resume** — 게이트 판정의 권위는 `state.json`(NFR-2). `gateOpen=true`가 이미 산출물 준비를 의미하므로 재작성 요구는 잘못된 안내.
- **자동 해제** — `done` 직후 구현 단계로 자연 전환(수동 토글 부담 제거). plan 모드는 에이전트 기억이 아닌 세션 변수라 도구 응답에서 닫아도 안전.

## 대안 (Alternatives)

- **무효화를 엔진 내부에서** — 엔진은 순수함수(I/O 금지, NFR-4)라 파일 삭제는 영속/호출측. 배제.
- **FR-2 상한 도달 시 자동 게이트 강제 종료** — 사용자 통제 상실(5대 원칙 위반). 에스컬레이션 메시지로 선택지 제공 채택.
- **타임아웃 default 0 유지** — 좀비 게이트 미해결. 30분 기본 채택.
- **결함을 다시 병렬 워크트리로 분할** — seam 재발 위험. 단일-owner 직접 수정 채택(포스트모템 교훈).

## 결과 (Consequences)

- **긍정** — FR-7/FR-2 end-to-end 충족, 좀비 게이트/resume/plan모드 UX 해소. 자체체크 48건(`bun run build` 0, `loop-audit.sh` 0, review #2 CLEAN).
- **부정/트레이드오프** — `timeoutMs` 30분 하드코딩(설정 불가); FR-2 상한 `MAX_LOOPS=3` 고정(사용자 조정 불가 — [[ADR-005-mvp-implementation]] 연기 범위); `gate-server`가 `revertTo`를 unbounded `number`로 forward(엔진 clamp로 런타임 안전, server-side clamp는 선택 hardening).
- **후속(별도 scope)** — FR-2 사용자 조정 상한, gate-server server-side clamp, `timeoutMs` 설정화.

## 참고

- [[parallel-worktree-seam-defects]] — 이 결정을 촉발한 문제/포스트모템
- [[ADR-005-mvp-implementation]] · [[implementation-architecture]] · [[Changelog]] · [[Dev-Log]]
