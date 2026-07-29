# FactoryNote

**Human-Gated Plan 생성 워크플로 패키지** — harness-agnostic 6단계 파이프라인.
AI가 코드를 서두르기 전에, 요청 이해부터 최종 검증까지 6단계 산출물을 순차적으로 작성하고
각 단계마다 사용자가 검토·수정·확정한다.

> AI(Feedback Agent 포함)는 게이트를 통과시킬 수 없다. 오직 사용자만.

## 모노레포 구조

[plannotator](https://github.com/backnotprop/plannotator) 폴더 패턴을 따른다.
`vault/` · `.pi/` 는 **개발 참고용**(배포 제외). `apps/` · `packages/` 가 배포 산출물.

```
factorynote/
├── apps/                      # harness 어댑터 (Layer 3)
│   ├── pi-extension/          #   메인: M4 Tier1(pi-crew) + M5(/factorynote)
│   ├── claude-code/           #   뼈대 (인터페이스만)
│   └── codex/                 #   뼈대 (인터페이스만)
├── packages/
│   └── factorynote/           # harness-agnostic 코어 (Layer 1-2)
│       ├── protocol/stages/   #   M1 Stage Registry (마크다운)
│       ├── protocol/templates/#   산출물 템플릿
│       ├── orchestrator/      #   M2 Director 규칙 (프로토콜)
│       └── src/               #   M3 Persistence + M4 AgentSpawn 인터페이스 + 타입
├── docs/                      # 사용자 문서 (설치/사용법)
├── bin/factorynote.mjs        # CLI 진입점 (Tier 0, 순수 Node)
├── scripts/                   # 설치/빌드 스크립트
├── tests/                     # 통합/수동 테스트
├── vault/                     # 참고: 기획·설계·ADR (Obsidian, 배포 제외)
└── .pi/                       # 참고: doc-workflow 스킬
```

## 3계층 (이식성 경계)

| 계층 | 위치 | harness 의존 |
| ---- | ---- | ---------- |
| Protocol | `packages/factorynote/protocol`, `orchestrator/` | 없음 |
| Engine | `packages/factorynote/src` | 없음 |
| Adapter | `apps/<harness>/` | 있음 |

> Layer 1-2(`packages/factorynote`)만 복사하면 다른 harness로 이동. Layer 3(`apps/`)만 harness별 재작성.

## 빠른 시작

```bash
bun install
bun run typecheck   # tsc -b
```

## 6단계 파이프라인

| Stage | 산출물 | 게이트 |
| ----- | ------ | ------ |
| 1 | 요구사항 명세 | 승인된 요구사항 없이 설계 불가 |
| 2 | 시나리오 명세 | 시나리오 확정 후 설계 |
| 3 | 모듈 구조도 | 승인된 설계 없이 계획 불가 |
| 4 | 클래스 명세 | 클래스 설계 확정 후 계획 |
| 5 | 구현 계획 | 승인된 계획 없이 코드 불가 |
| 6 | 최종 검증(정합 매트릭스) | 검증 전 반영 불가 |

## 참고

- 설계 진실: [`vault/Home.md`](vault/Home.md) · [`vault/01-architecture/multi-agent-pipeline.md`](vault/01-architecture/multi-agent-pipeline.md)
- 에이전트 오리엔테이션: [`AGENTS.md`](AGENTS.md)
- 라이선스: [`LICENSE`](LICENSE)
