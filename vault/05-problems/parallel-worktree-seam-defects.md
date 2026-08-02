---
status: resolved
updated: 2026-08-03
tags: [problem, postmortem, orchestration, seam]
---

# 병렬 워크트리 seam 결함 + gate-server revertTo drop (포스트모템)

`fn-integration` 병합 직후 발견된 통합 결함군의 현상·원인·조치·교훈. 해결은 [[ADR-007-pipeline-hardening]].

## 현상

MVP를 병렬 3-워크트리×pi 에이전트(코어/어댑터/게이트)로 통합한 직후:

- **신규 코어 심볼 dead code** — `invalidateArtifactsAfter`·`atLoopCeiling`이 정의만 되고 어댑터에서 **한 번도 호출되지 않음** → FR-7 산출물 무효화·FR-2 상한 미동작.
- **#4 좀비 게이트 미해결** — `runGate` `timeoutMs` default 0 + `plan-tool`이 전달 안 함 → 사용자 이탈 시 무한 대기.
- **P0 (최심)** — `gate-server` `/api/decision` 핸들러가 decision 객체를 재조립하면서 **`revertTo`를 탈락** → D5(뷰어 회귀대상 Stage 셀렉터)가 end-to-end로 완전 무력화(엔진이 항상 1단계 회귀만 수행). `tsc`/`bun test` green, ast-grep audit도 **구조상 검출 불가**.

## 원인

1. **병렬 분할이 "연결 wiring"을 어느 워커 소유로도 명시하지 않음** — 코어 역량(WT-1)과 어댑터 호출(WT-2) 사이의 glue(누가 `invalidateArtifactsAfter`/`atLoopCeiling`/`timeoutMs`를 소비하는가)이 빠짐. 각 워커는 주어진 파일 스펙을 정확히 수행했으나, **빈 곳은 워커 경계가 아니라 coordinator의 분할 사이**.
2. **gate-server P0는 "재조립 화이트리스트" 패턴의 부산물** — `verdict`/`comments`/`graphSections`만 복사하고 `revertTo`(신규 필드)는 누락. 타입은 optional라 `tsc` 통과.
3. **자동 검증(ast-grep audit)은 서명 기반**이라 뷰어 송신·엔진 수신은 잡지만 **중간 서버 전달 누락**은 구조상 못 잡음.

## 조치

- **단일-owner 직접 수정(wiring pass)** — D1-D4(`invalidateArtifactsAfter` 호출·`atLoopCeiling` 소비·`timeoutMs` 전달·`validThrough` 마이그레이션)를 coordinator가 한 소유자로 직접 연결. 병렬 분할 재발 방지.
- **review 서브 재심사 도입** — metricless /loop 구동 중 신규 컨텍스트 review 서브에이전트가 P0(`revertTo` drop) 포착 → `gate-server` forward + 회귀테스트 + audit D6 가드 추가.
- **P1(NaN)** 도 review에서 포착 → `Number.isFinite` 가드 + 테스트.
- **FR-2 경성 에스컬레이션** 추가(advisory → 경성).

## 영향

- **사용자 영향 0** — 출시 전(`fn-integration`, main 미반영) 단계에서 발견·수정.
- **코드** — 7 코드 커밋(D1-D5 wiring + P0 + P1 + FR-2 경성 에스컬레이션) + 4 doc 커밋.
- **검증** — `bun run build` 0 · `bun test` 48 pass · `loop-audit.sh` 0 · review #2 CLEAN.

## 교훈

1. **병렬 워크트리는 빠르나 seam 관리가 관건** — coordinator가 호출처(consumer)를 단일 워커에 **명시 귀속**해야 이음새가 안 끊김. 같은 파일을 공유하거나 호출·피호출 관계인 변경은 한 워커로 묶거나 coordinator가 직접 수정할 것.
2. **자동 서명 audit는 필요충분이 아님** — end-to-end 필드 흐름(뷰어→서버→엔진)은 정성 재심사(review 서브)로 보완해야. 특히 "재조립 화이트리스트" 패턴은 신규 필드를 자동 누락하므로 의심할 것.
3. **metricless /loop에도 정성 게이트는 필수** — 이 머신에선 metric 측정(`spawn bash` ENOENT)이 깨져 metricless로 갔으나, review 서브 재심사가 수렴 판단을 대행해 P0를 잡음. metric이든 metricless든 독립 재심사 한 번은 거칠 것.

## 상태

resolved — 수정 완료. 결정 사항은 [[ADR-007-pipeline-hardening]].

## 참고

- [[ADR-007-pipeline-hardening]] · [[Changelog]] · [[Dev-Log]] · [[implementation-architecture]]
