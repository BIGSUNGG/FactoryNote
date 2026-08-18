---
updated: 2026-08-18
tags: [research, pi-harness]
---

# pi 하네스 엔지니어링 표면 조사

pi v0.84.0(`@earendil-works/pi-coding-agent`)에서 에이전트 동작을 프로그래밍할 수 있는 표면 조사. 4대 작업 원칙 적용([[01-plan|work-principles 기획]])의 근거 문서.

## 요약

엔지니어링 표면은 6개 층. 코드 수준 엔지니어링은 **확장(Extension)** 과 **SDK/RPC** 가 핵심이고, 나머지는 선언적 구성.

## 6개 층

| 층 | 매커니즘 | 위치/문서 |
| ------ | ------ | ------ |
| 1. 확장 | TypeScript 모듈 — 도구 등록/대체(`pi.registerTool`), `/command`(`pi.registerCommand`), 이벤트 훅(`before_agent_start`·`agent_start/end/settled`·`tool_call` 등), UI(위젯·푸터·오버레이), 커스텀 프로바이더(`pi.registerProvider`) | `~/.pi/agent/extensions/`, `.pi/extensions/`, `docs/extensions.md`, 예제 ~75개 |
| 2. 프롬프트·컨텍스트 | 시스템 프롬프트 교체/추가(`.pi/SYSTEM.md`·`APPEND_SYSTEM.md`), 컨텍스트 파일(AGENTS.md 자동 로드), 프롬프트 템플릿(`prompts/*.md`), 스킬(Agent Skills 표준) | 선언적, 코드 불필요 |
| 3. 설정 | `settings.json`(모델·steering·컴팩션), `keybindings.json`, 테마 JSON(핫리로드), `models.json`(호환 API 프로바이더), 환경변수(`PI_*`) | `docs/settings.md` 등 |
| 4. 임베딩·외부 통합 | SDK(`createAgentSession`·`AgentSessionRuntime`), RPC 모드(`pi --mode rpc`, LF-JSONL), 세션 포맷(JSONL 트리) | `docs/sdk.md`·`rpc.md`·`session-format.md` |
| 5. 유통 | Pi 패키지 — 확장+스킬+템플릿+테마 번들, npm/git 설치(`package.json`의 `pi` 키) | `docs/packages.md` |
| 6. 격리 | 내장 샌드박스 없음(의도적 설계) — 컨테이너/VM 계층에서 해결 | `docs/security.md`·`containerization.md` |

## 훅 구현에 사용한 API 세부

- `pi.on("tool_call", async (event, ctx))` — `event.toolName`·`event.input`(가변), `{ block: true }`로 차단 가능.
- `pi.on("agent_start" ...)` / `pi.on("agent_settled", ...)` — settled는 pi가 자동 계속(재시도·컴팩션·큐)하지 않는 시점.
- `ctx.ui.notify(msg, "info"|"warning"|"error")` — 토스트 알림.
- 확장 상태는 모듈 변수로 충분(도구 결과에 의존하는 상태만 session `details`에 저장).

## 결론

원칙 적용은 2층(AGENTS.md) + 스킬 + 1층(확장 훅 리마인더) 조합이 최소 비용·최대 효과. 하드 게이트(도구 차단)는 오탐 위험으로 배제 → [[ADR-028-work-principles-harness-application]].
