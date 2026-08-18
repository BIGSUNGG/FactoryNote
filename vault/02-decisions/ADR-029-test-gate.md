---
status: accepted
updated: 2026-08-18
tags: [adr, pi-harness, test-gate]
---

# ADR-029: 테스트 통과 전 작업 종료 불가 게이트 (에이전트 훅 + pre-commit)

## 상태

accepted

## 날짜

2026-08-18

## 맥락 (Context)

사용자 요청: 에이전트 작업이 끝난 후 테스트 코드를 실행해 통과해야만 작업이 끝나게 하고, 커밋에도 동일 논리를 적용하라. 이 리포의 품질 기준은 `bun test` 0 종료(AGENTS.md). 기존에는 이 기준이 프롬프트 유도(AGENTS.md)에만 의존했다.

## 결정 (Decision)

1. **에이전트 게이트**: `.pi/extensions/test-gate.ts` — `agent_settled`(실행이 완전히 끝난 시점)에서 `bun test`를 실행한다. 실패하면 실패 출력 끝부분과 함께 수정 지시를 `pi.sendUserMessage`로 주입해 에이전트를 계속 돌린다. 자동 수정 지시는 **최대 3회**, 초과 시 사용자에게 알림으로 에스컬레이션하고 시도 예산을 초기화한다. 통과 시에만 작업이 종료된다.
2. **커밋 게이트**: `scripts/git-hooks/pre-commit`(POSIX sh) — `bun test` 실행, 실패 시 exit 1로 커밋 차단. `git config core.hooksPath scripts/git-hooks`로 활성화(로컬 1회). `.gitattributes`로 훅 파일 LF 고정(Windows CRLF 방지).

## 이유 (Rationale)

- `agent_settled`는 pi가 자동 재시도·컴팩션·큐 처리를 더 하지 않는 시점이라 "작업 종료" 판정에 정확하다.
- 주입 방식(수정 지시 → 재실행 → 재검사)은 하드 차단 없이 에이전트가 스스로 수습하게 하며, 횟수 상한으로 무한 루프·토큰 낭비를 막는다.
- pre-commit은 git 네이티브 메커니즘이라 pi 밖(수동 커밋·다른 도구)에서도 동일 기준이 적용된다.
- 상수(명령·횟수·출력 길이)를 파일 상단에 집중해 조정 비용을 한 곳으로.

## 대안 (Alternatives)

- **agent_end 시점 검사**: pi가 자동 재시도·컴팩션으로 계속할 수 있어 중간에 게이트가 도는 문제 — 배제.
- **코드 변경 시에만 검사**(tool_call 경로 추적): 순수 문서·채팅 실행의 불필요한 테스트 실행은 줄지만, 이전 실행에서 깨진 테스트를 방치한 채 작업이 끝나는 구멍이 생김 — 엄격 판(항상 검사) 채택.
- **husky 등 훅 관리자**: 의존 추가가 과함 — sh 스크립트 + hooksPath로 충분.

## 결과 (Consequences)

- 매 실행 종료마다 `bun test`(현재 약 7초) 실행 — 허용 범위.
- 사용자 중단(abort) 직후에도 게이트가 돌 수 있다(중단 판별 API 부재) — 허용, 필요 시 후속.
- 사전 존재하던 테스트 실패가 있으면 에이전트가 수정 지시를 받는다 — 의도된 압박이나, 무관한 작업을 멈출 수 있으므로 알림으로 인지 가능.
- pre-commit 활성화는 클론 후 수동 1회 — AGENTS.md에 기재.

## 참고

- [[ADR-028-work-principles-harness-application]] — 훅 리마인더 방식의 전례
- AGENTS.md 빌드/테스트 섹션
