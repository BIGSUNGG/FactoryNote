---
updated: 2026-08-18
tags: [meta, development, contributing, testing]
---

# 개발 가이드 — 빌드·테스트·확장

FactoryNote MVP를 **수정·확장**하는 기여자를 위한 가이드. 사용법은 [[usage-guide]], 코드 구조는 [[implementation-architecture]] 을 본다.

> **TL;DR**: 빌드·타입체크·테스트(`bun run build` · `bun test`) 명령과 테스트 전략, 확장 시나리오(단계 추가·뷰어 수정·새 어댑터)를 다룬다. JS 컴파일 산출물이 없고 `tsc -b`는 타입검사만 한다는 것이 핵심 전제.

## 레포 레이아웃 (요약)

```
factorynote/
├── packages/factorynote/        # Layer 1-2 코어(harness-agnostic, 런타임 의존 0)
│   └── src/{types,stages,engine,persistence,index}.ts
├── apps/pi-extension/           # Layer 3 Pi 어댑터
│   └── src/{index,plan-tool,gate-server}.ts
├── apps/plan-viewer/ # 뷰어(React+Vite, 별도 node_modules)
├── bin/factorynote.mjs          # CLI(순수 Node ESM)
├── scripts/install.mjs          # 로컬 pi 설치(순수 Node)
└── vault/                       # 문서(Obsidian, 배포 제외)
```

> 워크스페이스 패키지는 TS 소스를 직접 export(`package.json` 의 `exports["."]="./src/index.ts"`). pi(jiti)와 bun 이 TS 를 직접 로드하므로 **JS 컴파일 산출물이 없다** — `tsc -b` 는 타입검사 + 선언문(`.d.ts`)만 생성.

## 빌드 · 타입검사 · 테스트

```bash
bun install                              # 의존성 설치(최초 1회)
bun run build        # = tsc -b          # 타입검사 + 선언문 생성 (계약 #1)
bun run typecheck    # = tsc -b          # 동일
bun test                                 # 전체 자체체크 실행
bun test packages/factorynote            # 코어만
bun test apps/pi-extension               # 확장만
```

뷰어(별도):

```bash
cd apps/plan-viewer
npm install          # 최초 1회
npm run build        # vite build → dist/
npm run dev          # 개발 서버(단독 미리보기, 게이트 연동 없음)
```

## 의존성 메모

- `tsconfig.base.json` 의 `"types": ["bun-types"]` — bun-types 가 `/// <reference types="node" />` 로 node 내장 타입까지 가져온다(`node:fs`·`process`·`NodeJS`·`bun:test` 동시 해석).
- `apps/pi-extension` devDeps: `@earendil-works/pi-coding-agent`(설치된 pi 버전에 맞춤 — 현재 0.80.6) + `typebox`(pi 의존과 맞춤 — 1.1.38). **런타임에는 pi 가 둘 다 제공**하므로 설치 시 복사 불필.

## 테스트 전략 (LLM/pi 없이 검증)

모든 핵심 로직은 **LLM과 pi 없이** 단위/통합 테스트로 검증된다(게이트의 인간 판단만 예외). `bun test`:

| 파일 | 검증 대상 |
| ---- | ---- |
| `packages/factorynote/src/engine.test.ts` | 상태기계 전이(confirm/modify/revert), 6단계 완료, atomic r/w, 손상 복구, 산출물 r/w |
| `apps/pi-extension/src/gate-server.test.ts` | HTTP 서버: 뷰어 서빙 + `/api/state` + `POST /api/decision` 흐름 |
| `apps/pi-extension/src/plan-tool.test.ts` | `drivePlan` 종단 간: 산출물 제출→게이트→결정→상태 전이+디스크 저장 |
| `apps/pi-extension/src/load.test.ts` | 확장 팩토리가 명령·도구·핸들러를 에러 없이 등록 |

> 새 로직을 추가하면 대응하는 테스트를 함께 둔다(ponytail: 비자명한 분기/루프/파서/보안 경로는 최소 한 개의 실행 가능한 체크).

## 확장 시나리오

### 단계(Stage) 추가/수정

`packages/factorynote/src/stages.ts` 의 `STAGES` 배열을 편집. 각 `StageDefinition`:

```ts
{
  id: 7,                         // StageId 타입(1-6) 도 widen 필요 시 types.ts 의 union 업데이트
  name: "...",
  artifact: "...",
  format: "markdown",            // MVP는 모두 markdown 렌더
  artifactFile: "07-....md",     // 산출물 파일명(없으면 null)
  producesArtifact: true,
  designPrompt: "...",           // Design 역할 작성 지시(에이전트 프롬프트에 주입)
  feedbackChecklist: ["..."],    // Feedback 자기검토 항목
}
```

엔진(`engine.ts`)은 `stage >= 6` 완료 임계치가 하드코딩되어 있으니, 단계 수가 바뀌면 `applyVerdict`/`isComplete` 임계치와 뷰어(`App.jsx` 의 `pickMarkdown` Stage 6 분기)도 함께 조정.

### 뷰어 수정

`apps/plan-viewer/src/` 편집 → `bun run build` → `bun scripts/install.mjs` 로 재배포.
게이트 계약(`/api/state`·`/api/decision` 셰이프)은 [[implementation-architecture#데이터 계약 Contracts]] 참조. 뷰어는 이 계약만 지키면 된다.

**사용자에게 보이는 변경 시 테스트 뷰어 갱신 (문서 우선 원칙 3 하위 룰, [[ADR-031-viewer-test-viewer-rule]])** —
렌더링·UI·레이아웃·예시 문서 등 사용자가 게이트에서 보는 것에 변화가 생기면, 같은 세션에서 테스트 뷰어 데모를 함께 갱신해 사용자가 바로 확인할 수 있게 한다. 확인할 수 없는 가시 변경은 완료가 아니다.

1. `apps/plan-viewer/dev/mock-api.js` — 실게이트 서버 의미론(큐·stage-request·취소·SSE, [[ADR-024-chat-send-queue]]·[[ADR-022-viewer-sse-push]])을 모방한 목업 시나리오. 새 동작을 시연하도록 (필요 시) 확장하고, 의미론이 바뀌었으면 목업 자체체크 `dev/mock-api.test.js` 도 함께 갱신한다(`bun test apps/plan-viewer/dev`).
2. `apps/plan-viewer/src/data/*.md` — 데모에 쓰는 예시 산출물(`plan.md`·`scenarios.md`·`impl.md`). 새 화면·상태를 보여줄 수 있게 (필요 시) 교체·추가한다.
3. 검증: `cd apps/plan-viewer && bun run dev`(또는 루트에서 `bun run dev:viewer`, 5180 포트)로 브라우저에서 가시 변경을 확인한다.
4. 미갱신 채 마무리하면 `.pi/extensions/viewer-test-viewer.ts` 훅이 종료 시 경고(비차단 — 룰 자체는 판단의무).

### 새 harness 어댑터 추가(Codex / Claude Code)

코어(`packages/factorynote`)는 harness 를 모른다. `apps/<harness>/` 에 새 어댑터를 만들어:

- 그 환경의 명령/스킬 주입 방식으로 plan 모드 구현.
- `drivePlan`(코어)과 그 환경의 게이트 UI 를 연결.
- 코어 수정 없이 추가 가능(NFR-1). 참고: [[project-identity]] 의 harness별 주입 방식.

### Tier 1(pi-crew 분리 에이전트) 로升级

현재 Tier 0(단일 에이전트 역할 전환). [[01-requirements|FR-6/NFR-7]] 의 `AgentSpawn` 인터페이스를 두고, `apps/pi-extension` 에서 pi-crew 로 Design/Feedback 을 **분리된 서브에이전트**로 스폰하도록 구현. MVP 연기 항목([[ADR-005-mvp-implementation]]).

## 문서 갱신 규칙

코드/기능을 바꾸면 `.pi/skills/doc-workflow` 스킬 규칙에 따라 같은 세션에서:

- 결정 → `vault/02-decisions/ADR-NNN-*.md`(`90-meta/templates/adr.md` 사용).
- 변경 → [[Changelog]](Added/Changed/Fixed/Removed) + [[Dev-Log]](오늘 항목).
- 신규 문서 → [[Home]] 에서 링크(고립 금지).

## 참고

- [[implementation-architecture]] — 코드 구조·데이터 흐름·데이터 계약
- [[90-meta/usage-guide]] — 설치·사용법
- [[ADR-005-mvp-implementation]] · [[ADR-004-monorepo-structure]]
- [[Home]]
