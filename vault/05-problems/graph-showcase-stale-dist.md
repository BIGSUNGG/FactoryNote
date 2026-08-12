---
updated: 2026-08-12
tags: [problems, viewer, build, dist, repro, postmortem, resolved]
status: resolved
---

# 그래프 쇼케이스 미출력 — 낡은 뷰어 dist 서빙

## 현상

`bun repro-graph-kinds.mjs` 로 그래프 종류 쇼케이스 게이트([[ADR-018-hierarchical-graph-tree]]·[[ADR-020-multi-named-graphs]]·[[ADR-021-sequence-flowchart-graphs]])를 띄우면, 그래프 블록 자리는 나오지만 안에 **"그래프 데이터(...)를 찾을 수 없습니다"** 빈 상태만 표시됐다. 4종(계층 트리·sequence·flowchart·구 고정이름) 전부 미출력.

## 원인

게이트가 서빙하는 뷰어 번들 `apps/plan-viewer/dist`(gitignore 빌드 산출물)가 **최신 소스보다 낡았다.** `/api/state` 는 다중 그래프 API(`artifacts[].graphs` 배열, 각 `{file,type,data}`)를 내려주고 있었으나(curl 로 4종 모두 정상 서빙 확인), 실행된 dist 는 그 이전의 **단일 그래프 API(`artifact.graph.{file,tree}`)** 를 소비하도록 빌드된 구 버전이었다:

```js
// 낡은 dist 의 graphData 조립 (구 API)
const h = f?.graph ? { [f.graph.file]: f.graph.tree } : {};  // f.graph === undefined → {}
```

`f.graph`(단수)를 찾지만 state엔 `graphs`(복수 배열)만 있어 `graphData={}` → 블록의 `graphData[file]` undefined → 빈 박스 분기.

**왜 기존 검증이 못 잡았나:**

1. `gate-server.test.ts` 는 `/api/state` JSON(백엔드)만 검증한다 — 브라우저 렌더링(dist 소비)은 구동 안 함. 그래서 state 가 4종을 내려줘도 PASS.
2. `ensure-viewer-dist.ts` preload(bun:test)는 dist 가 **없을 때만** 빌드하고, **stale 일 때는** 빌드하지 않았다 → 소스 변경 후 낡은 dist 가 방치.

dist 는 gitignore(로컬 빌드)라 CI 가 아니면 누가 최신인지 보장하는 주체가 없었고, repro 는 서빙 전 빌드 산물의 신선도를 검사 없이 곧바로 서빙했다.

## 조치

- `ensure-viewer-dist.ts` 를 **staleness 인식**으로 일반화: dist 가 없거나 `apps/plan-viewer` 소스(node_modules·dist 제외)보다 낡았으면 `vite build` 로 재빌드. 순결정 helper `viewerDistIsStale(distMtimeMs, srcMtimeMs)` 분리(단위 테스트용). `bun:test` preload 도 같이 개선 — 소스 변경 후 테스트 시 자동 재빌드.
- `repro-graph-kinds.mjs` 가 서빙 전 `ensure-viewer-dist` 를 import → 항상 최신 dist 보장(낡은 dist 로 그래프가 안 보이는 회귀 차단).
- 회귀 셀프체크: `ensure-viewer-dist.test.ts` — `viewerDistIsStale` 결정(null/fresh/stale/동일-순간) 4케이스.

## 영향

- 쇼케이스 4종 그래프 정상 렌더(트리 드릴다운 + sequence fragment + flowchart shape·백엔지 + legacy). 백엔드 state·코어 무변경(이미 정상이었음).
- 자체체크 140 pass(신규 4 + 기존 136). `bun run build` 0 종료. 기존 무관 `@happy-dom/global-registrator` 2 실패는 유지(별개 이슈).
- 부수 효과: `bun test` 시 낡은 dist 자동 재빌드 → 게이트 테스트가 항상 최신 UI 에 대해 돌아감.

## 교훈

- **gitignore 빌드 산출물(dist)을 서빙하는 도구는 "없으면 빌드"만으로 부족**하다 — "소스보다 낡으면 빌드"까지 보장해야 한다. 빌드 단계(`bun run build`)에만 의존하면 소스-빌드 사이 간극이 회귀로 나타난다.
- 백엔드 state JSON 테스트는 **프론트엔드 빌드 신선도를 검증하지 못한다.** 렌더링 경로가 깨지려면 빌드 산물 자체를 검사해야 한다.
- repro/데모 스크립트는 서빙 직전 빌드 산물의 신선도를 **스스로** 보장해야 — 별도 빌드 단계를 사용자가 먼저 돌렸으리라 가정하면 안 된다.
