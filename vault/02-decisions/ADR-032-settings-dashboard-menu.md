---
status: accepted
updated: 2026-08-19
tags: [adr, pi-harness, settings]
---

# ADR-032: 설정 대시보드 — /factorynote 서브커맨드 폐지·설정 메뉴 통합

## 상태

accepted

## 날짜

2026-08-19

## 맥락 (Context)

FactoryNote의 세션 설정은 plan 모드 on/off · auto-advance · feedback 수준([[ADR-017-feedback-levels]]) · 최대 스테이지 개수 상한([[ADR-031-dynamic-stage-composition]]) · design 위성 수준(designLevel, [[ADR-031-parallel-design-satellites]]) 으로 늘어났다. 그러나 진입점이 나뉘어 있었다 — 대부분은 `/factorynote <서브커맨드>` 로, designLevel 은 도구 파라미터로만 설정 가능했다. 인자 없이 명령을 실행하면 커맨드 영역에 설정 메뉴(대시보드)가 이미 열리므로(feedback 항목만 구현 상태), 사용자는 **서브커맨드를 전부 없애고 모든 값 조절을 대시보드에서** 하도록 요청했다. 여기에 design·stage 조절 항목 추가를 요청했다.

## 결정 (Decision)

1. **서브커맨드 전부 폐지**: `/factorynote` 는 인자 없는 단일 명령이다. `on`·`off`·`auto`·`feedback`·`stage` 등 모든 서브커맨드 파싱을 제거한다.
2. **설정 대시보드 = 설정 메뉴**: 인자 없는 `/factorynote` 가 여는 메뉴에서 feedback 수준 · design 위성 수준 · 최대 스테이지 개수 상한 · auto-advance 4개 설정 항목과 plan 모드 전환(`confirm` → ON, `off` → OFF, `close` → ON 유지하고 나가기)을 처리한다. 각 설정 항목은 현재 값을 표시하고, 하위 선택 창에서 고른 뒤 메뉴로 복귀한다.
3. **세션 메모리만**: 모든 설정은 확장 프로세스의 세션 내에서만 유지한다(기존과 동일). pi 재시작 시 기본값으로 복귀 — 디스크 영속화 없음.
4. **도구 파라미터 우선 유지**: `factorynote_plan` 의 `maxStages`·`designLevel` 파라미터는 메뉴 설정보다 우선한다(파라미터 > 세션 설정 > 기본값). designLevel 은 세션 기본값을 신설한다 — 도구 호출이 파라미터를 생략하면 메뉴 설정값이 적용된다.
5. **UI 없는 환경 폴백**: `ctx.hasUI` 가 false 면 호출마다 plan 모드 토글.

## 이유 (Rationale)

- 설정이 늘어나면 서브커맨드 암기보다 한 화면에 현재 값이 표시되는 메뉴가 발견 가능성·조작 일관성에서 유리하다.
- 세션 메모리·파라미터 우선은 기존 시맨틱 그대로 — 진입점만 메뉴로 옮기므로 동작 변화가 최소다.
- plan 모드 OFF 수단도 메뉴에 있어야 한다(`off` 서브커맨드 폐지) — off 항목은 ON 상태에서만 표시해 메뉴를 단순하게 유지한다.

## 결과 (Consequences)

- 서브커맨드를 쓰던 사용자는 메뉴 조작으로 전환해야 한다(사용 가이드 갱신으로 안내).
- [[ADR-017-feedback-levels]]·[[ADR-031-dynamic-stage-composition]] 의 명령 기반 설정 문구(`/factorynote feedback <level>`·`/factorynote stage <n>`)는 본 결정으로 대체된다 — 수준·상한의 시맨틱 자체는 그대로 유효하다.
