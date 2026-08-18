---
updated: 2026-08-18
tags: [design, work-principles, pi-harness]
---

# 4대 작업 원칙 하네스 적용 — 구현 기록

[[01-plan|기획]]의 구현 결과. 원칙 3(문서주의)에 따라 기획과 분리해 기록한다.

## 산출물

| 파일 | 역할 |
| ------ | ------ |
| `AGENTS.md` | 4대 작업 원칙 + 프로젝트 오리엔테이션(레이아웃·빌드·문서 규칙). 매 세션 자동 로드. |
| `.pi/skills/` 원칙별 4스킬 | 절차 스킬 분할 — `ask-before-guess`(질문 임계값·형식), `future-proof-code`(모듈화 기준), `doc-first-workflow`(문서 선행·훅 알림 대응), `critical-review`(완료 전 체크리스트). 단일 스킬(work-principles)에서 분할(2026-08-18 사용자 요청). |
| `.pi/extensions/work-principles.ts` | 문서주의 리마인더 훅 — `tool_call`에서 쓰기류 도구 경로 분류(문서/코드), `agent_settled`에 코드 변경·문서 미변경이면 경고 알림. 차단 없음. |
| `.pi/tsconfig.json` | 확장 TS 타입 연결 — 전역 설치 pi 패키지의 `dist/index.d.ts`로 paths 매핑(LSP 오류 해소). |

## 계획과의 차이

- **AGENTS.md 신규 작성**: 구현 착수 시점에 기존 AGENTS.md가 작업 트리에서 삭제된 상태(미스테이지, 세션 중 외부 삭제 추정) 발견. 사용자 지시로 복원 대신 신규 작성 — 4대 원칙을 핵심으로 하고 삭제 파일에 있던 오리엔테이션(레이아웃·빌드 명령·5대 원칙 참조)은 축소 복원. `.pi/skills/design/SKILL.md`도 함께 삭제되어 있었으나 사용자 지시 범위 밖이라 그대로 둠.

## 검증 상태

- 확장 타입검사: LSP clean(`.pi/tsconfig.json` paths 연결 후).
- 마크다운: 문서 lint 통과.
- **미검증**: 훅 런타임 동작 — `/reload`(또는 새 세션) 후 "문서 미갱신 코드 변경" 시나리오에서 알림 발생 확인 필요. 확장은 세션 시작 시 로드되므로 현 세션에서는 동작하지 않음.

## 후속 후보

- 원칙 4 `agent_settled` 체크리스트 자동 출력.
- `@aliou/pi-guardrails`(기설치)와의 게이트류 기능 중복 점검.
- 문서 판정 기준(`DOC_PATTERNS`) 오탐 모니터링 — 확장 상단 상수에서 조정.
