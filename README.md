# FactoryNote

**Human-Gated Plan 생성 워크플로 패키지** — pi 하네스 위에서 동작하는 6단계 파이프라인.
AI가 코드를 서두르기 전에, 요청 이해부터 최종 검증까지 6단계 산출물을 순차 작성하고
각 단계를 **사용자가 웹 페이지 게이트에서 검토·수정·확정**한다.

> AI(Feedback 자기검토 포함)는 게이트를 통과시킬 수 없다. 오직 사용자만.

## 상태

**MVP 구현 완료** — pi 하네스에서 실동작. `/factorynote` 로 plan 모드를 켜고 기능을 요청하면,
에이전트가 6단계 산출물을 작성·제출하고 로컬 웹 페이지가 게이트가 되어 결정을 받는다.
상세는 [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md).

## 빠른 시작

```bash
# 1. 의존성 + (개발 시) 빌드/테스트
bun install
bun run build          # tsc -b (타입검사 + 선언문)
bun test               # 19개 자체체크

# 2. 로컬 pi에 확장 설치
bash scripts/install.sh    # → ~/.pi/agent/extensions/factorynote/

# 3. 새 pi 세션에서 사용
#    /factorynote         ← plan 모드 ON
#    "로그인 기능 계획해줘"  ← 에이전트가 산출물 작성 → 브라우저 게이트 오픈

# 4. (pi 밖에서) 상태 조회
node bin/factorynote.mjs status
```

사용법 전체는 [`vault/90-meta/usage-guide.md`](vault/90-meta/usage-guide.md).

## 모노레포 구조

[plannotator](https://github.com/backnotprop/plannotator) 폴더 패턴. `apps/`·`packages/`·`prototypes/` 가 배포 산출물, `vault/`·`.pi/` 는 개발 참고용(배포 제외).

```
factorynote/
├── packages/factorynote/        # Layer 1-2 코어(harness-agnostic, 런타임 의존 0)
│   └── src/                     #   types · stages(6단계 Registry) · engine(상태기계) · persistence(atomic r/w)
├── apps/pi-extension/           # Layer 3 Pi 어댑터(메인)
│   └── src/                     #   index(/factorynote·plan모드) · plan-tool(도구) · gate-server(웹 게이트)
├── prototypes/plan-page-mockup/ # 뷰어(React+Vite) — 빌드 dist 가 게이트 서버를 통해 서빙됨
├── bin/factorynote.mjs          # CLI(순수 Node, 상태 조회)
├── scripts/install.sh           # 로컬 pi 설치
├── vault/                       # 문서(Obsidian 볼트 — 기획·설계·ADR·아키텍처)
└── .pi/skills/                  # doc-workflow 스킬
```

## 3계층 (이식성 경계)

| 계층 | 위치 | harness 의존 |
| ---- | ---- | ---------- |
| Engine | `packages/factorynote/src` | 없음(런타임 npm 의존 0) |
| Adapter | `apps/pi-extension/src` | 있음(Pi) |
| Viewer | `prototypes/plan-page-mockup` | 없음(정적 웹) |

> Layer 1-2(`packages/factorynote`)만 복사하면 다른 harness로 이식. Layer 3만 harness별 재작성.

## 6단계 파이프라인

| Stage | 산출물 | 게이트 원칙 |
| ----- | ------ | ------ |
| 1 | 요구사항 명세 | 승인된 요구사항 없이 설계 불가 |
| 2 | 시나리오 명세 | 시나리오 확정 후 설계 |
| 3 | 모듈 구조도 | 승인된 설계 없이 계획 불가 |
| 4 | 클래스 명세 | 클래스 설계 확정 후 계획 |
| 5 | 구현 계획 | 승인된 계획 없이 코드 불가 |
| 6 | 최종 검증(정합) | 검증 전 반영 불가 |

## 문서

- 구현 아키텍처·데이터 흐름: [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md)
- 사용 가이드: [`vault/90-meta/usage-guide.md`](vault/90-meta/usage-guide.md)
- 개발/확장 가이드: [`vault/90-meta/development-guide.md`](vault/90-meta/development-guide.md)
- 기획·설계 진실: [`vault/Home.md`](vault/Home.md) · [`vault/01-architecture/multi-agent-pipeline.md`](vault/01-architecture/multi-agent-pipeline.md)
- 결정: [`vault/02-decisions/ADR-005-mvp-implementation.md`](vault/02-decisions/ADR-005-mvp-implementation.md)

## 라이선스

[`LICENSE`](LICENSE)
