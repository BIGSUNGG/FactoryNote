---
status: accepted
updated: 2026-07-26
tags: [adr, harness, tooling]
---

# ADR-002: 하이브리드 harness + graphify-out은 커밋한다

## 상태

accepted

## 날짜

2026-07-26

## 맥락

[[ADR-001-documentation-system]]에서 문서 시스템을 정했으나 두 세부 전략이 남았다.

1. **PI harness 주입 방식**: 루트 `AGENTS.md`(항상 로드, 트러스트 불필요) vs `.pi/skills/`(온디맨드, 트러스트 1회 필요) — 어느 쪽으로 컨텍스트를 주입할 것인가.
2. **`graphify-out/` Git 관리**: 재생성 산출물이라 전체 gitignore 할 것인가, 그래프는 커밋해 팀 공유/이식성을 얻을 것인가.

이전 세션에서는 `AGENTS.md` 단일 + graphify-out 커밋 방식을 썼으나 산출물이 디스크에서 사라졌고, 이번 세션에서 처음엔 `.pi/skills` 단일 + gitignore 로 구축했다가 두 접근의 장단을 비교해 최종 결정이 필요했다.

## 결정

1. **하이브리드 harness** — 루트 `AGENTS.md`(상시 프로젝트 오리엔테이션: 정체·5원칙·레이아웃·탐색 protocol) + `.pi/skills/doc-workflow/`(온디맨드 문서 규칙: ADR/Changelog/컨벤션). 역할을 분리한다.
2. **graphify-out/은 커밋**, 단 `graphify-out/cache/`와 `graphify-out/cost.json`만 `.gitignore`. `graph.json`·`graph.html`·`GRAPH_REPORT.md`·`manifest.json`은 커밋.

## 이유

- **하이브리드**: AGENTS.md는 매 세션 필요한 최소 오리엔테이션을 토큰 효율적으로 항상 주입(트러스트 프롬프트 없음). 반면 상세 문서 규칙은 문서 작업시에만 의미 있으므로 스킬로 온디맨드 로드해 평소 컨텍스트를 줄인다. 관심사 분리 + 점진적 공개(progressive disclosure).
- **graphify-out 커밋**: `manifest.json`이 경로를 상대 기준으로 저장해 이식성이 보장된다. 코드 pass(AST)는 무료이므로 재빌드 비용이 낮고, 팀/다른 기계가 그래프를 즉시 사용 가능. `cache/`(기계별·재생성)와 `cost.json`(실행 비용 기록)만 제외하면 된다.

## 대안

- **AGENTS.md 단일**: 트러스트 불필요하지만 상세 문서 규칙까지 항상 로드해 토큰 낭비, 관심사 혼재.
- **`.pi/skills` 단일**: 온디맨드라 토큰 효율은 좋으나 프로젝트 오리엔테이션(정체·5원칙)이 매 세션 자동 주입 안 됨 + 트러스트 1회 필요.
- **graphify-out 전체 gitignore**: 가장 단순하나 그래프를 매번 재빌드해야 하고 팀 공유가 안 됨.

## 결과

- 긍정: 오리엔테이션은 항상, 상세 규칙은 필요시. 그래프 팀 공유 + 이식성.
- 부정: harness가 두 메커니즘(AGENTS.md + 스킬)으로 늘어남. graphify-out 커밋으로 저장소에 그래프 파일이 추가됨(크기 증가).
- 후속: graphify 첫 빌드 후 `graph.json` 크기 모니터, 필요시 `--no-viz`로 HTML만 빌드에서 제외.

## 참고

- [[ADR-001-documentation-system]]
- `AGENTS.md`(루트), `.pi/skills/doc-workflow/SKILL.md`
- `vault/06-research/graphify.md`
