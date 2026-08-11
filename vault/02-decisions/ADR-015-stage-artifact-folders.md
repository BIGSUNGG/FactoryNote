---
status: accepted
updated: 2026-08-11
tags: [adr, persistence, layout]
---

# ADR-015: 단계 산출물 stageN/ 서브폴더 배치

## 상태

accepted

## 날짜

2026-08-11

## 맥락 (Context)

모든 산출물이 `<root>/<feature>/` 한 폴더에 평평하게 쌓여, 단계 산출물(`01-*.md`, `02-*.md`, `03-*.md`)과 런타임 보조 파일(`state.json`, `design-prompt.md`, `feedback-menu.md`, `draft.md`, `feedback.md.*`)이 뒤섞인다. 사용자가 단계별 폴더 분리를 요청했다.

## 결정 (Decision)

3개 단계 산출물(STAGES 레지스트리에 `artifactFile` 로 등록된 파일)만 `<root>/<feature>/stageN/` 서브폴더에 작성한다(N=단계 id). `state.json` 과 보조 파일(design-prompt.md·feedback-menu.md·draft.md·feedback.md.*)은 `<root>/<feature>/` 루트에 유지한다. 구현은 `persistence.ts` 의 `artifactPath` 한 지점: STAGES 조회로 파일명→`stageN/` 매핑(`stageSubdir`). 읽기·쓰기·무효화(`invalidateArtifactsAfter`)·게이트 서빙이 전부 `artifactPath` 경유라 호출측 변경 없음.

## 이유 (Rationale)

- 모든 경로 계산이 `artifactPath` 로 수렴하므로 한 함수 수정이 전체 일관성 보장 — 호출측 N곳 수정보다 작은 diff, 드리프트 불가.
- feature 폴더 안에 stage 폴더를 두면 한 기능의 파일이 한 디렉토리 트리에 모여 `state.json` 위치가 자연스럽다.

## 대안 (Alternatives)

- **stage 폴더를 feature 위에**(`<root>/stageN/<feature>/`): 한 기능이 3개 상위 폴더에 나뉘고 state.json 위치가 모호해 배제.
- **호출측(plan-tool·gate-server)에서 경로 조립**: 동일 로직 3곳 이상 중복, 신규 호출측이 경로 규칙을 놓칠 위험. 배제.

## 결과 (Consequences)

- 새 feature 산출물은 `stage1/`, `stage2/`, `stage3/` 에 배치.
- 기존 평평한 feature 폴더는 마이그레이션하지 않음 — resume 시 stage 폴더의 파일이 없으면 `readArtifact` 가 `undefined` 반환해 정상 처리(해당 단계 재생성). 오래된 평평 산출물은 무효화(`invalidateArtifactsAfter`)가 새 경로를 보므로 디스크에 잔존 가능(허용).
- 폴더명을 `stageN` 문자열로 고정(파라미터 없음) — 변경 필요 시 `stageSubdir` 한 곳만.

## 참고

- [[ADR-008-3-stage-pipeline]] — 3단계 정의
- [[implementation-architecture]] — persistence 구조
