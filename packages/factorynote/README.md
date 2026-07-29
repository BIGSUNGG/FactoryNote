# @factorynote/core

Harness-agnostic 코어. Layer 1-2만 복사하면 다른 harness로 이식 가능하다.
근거: [[vault/03-design/workflow-core/03-module-architecture]].

> **현재 상태(스캐폴드)**: 폴더 골조 + 설정만. `src/` 는 배럴만 두고, M3/M4/타입 스텁은 Stage 5 구현 시 추가한다. 아래 표는 **목표 매핑**이다.

## 3계층 (vault 기준)

| 계층 | 위치 | 형태 |
| ---- | ---- | ---- |
| Protocol | `protocol/`, `orchestrator/` | 마크다운(규칙·데이터) |
| Engine | `src/persistence.ts` (예정) | 얇은 코드(state atomic r/w) |
| Adapter | 인터페이스만(`src/agent-adapter.ts` 예정) | 구현체는 `apps/<harness>/` |

## 5모듈 → 파일 (목표)

| 모듐 | 파일 | 형태 |
| ---- | ---- | ---- |
| M1 Stage Registry | `protocol/stages/` | 마크다운(단계 정의·템플릿·검증 기준) |
| M2 Orchestrator | `orchestrator/` | 마크다운(Director·Design↔Feedback·게이트 규칙) |
| M3 Persistence | `src/persistence.ts` (예정) | 얇은 코드(`.factorynote/state.json` atomic r/w + 감사 로그) |
| M4 Agent Adapter | `src/agent-adapter.ts` (예정) | 인터페이스(`AgentSpawn`) — 구현은 `apps/pi-extension` 등 |
| M5 Command Entry | `apps/<harness>/` | harness 바인딩(`/factorynote <feature>`) |

> 판정·실행은 프로토콜, 신뢰성·연결은 코드(hybrid).
