# AGENTS.md — FactoryNote

FactoryNote는 PI에 설치하는 **Human-Gated Agentic Development Workflow Package**다.
(독립 CLI ❌ / PI 포크 ❌ / ADE ❌.) AI가 의도를 충분히 파악하기 전에 코드를 서두르는 문제를
9단계 인간 승인 게이트로 통제한다. 전체 설계·배경은 `vault/` 참고.

## 5대 원칙 (타협 불가)

1. 승인되지 않은 요구사항으로 설계할 수 없다.
2. 승인되지 않은 설계로 구현 계획을 만들 수 없다.
3. 승인되지 않은 구현 계획으로 코드를 작성할 수 없다.
4. 승인된 계획과 다른 코드는 검수를 통과할 수 없다.
5. 검증되지 않은 코드는 사용자 작업 공간에 반영할 수 없다.

## 리포 레이아웃

- `vault/` — Obsidian 문서 볼트(진실의 원천). 진입점 `vault/Home.md`.
- `AGENTS.md` — 본 파일. PI 시작 시 항상 로드(프로젝트 오리엔테이션).
- `.pi/skills/doc-workflow/` — 문서 작성 규칙 스킬(온디맨드 로드, 프로젝트 트러스트 필요).
- `graphify-out/` — graphify 지식 그래프(커밋됨, `cache/`·`cost.json`만 제외).
- 코드는 아직 없음 — 모노레포 스캐폴딩 예정.

## 탐색 protocol (질문에 답하기 전)

1. `graphify-out/`가 있으면 `graphify query`/`explain`/`path`로 먼저 질의.
2. 그 다음 `vault/` 문서를 읽는다(`Home.md` → 해당 영역).
3. 날(raw) grep은 마지막 수단.

## vault 영역

`00-vision` · `01-architecture` · `02-decisions`(ADR) · `03-design/<feature>/` ·
`04-development`(Changelog + Dev-Log) · `05-problems` · `06-research` · `90-meta`(규칙·템플릿).

## 문서 작업 시

문서를 쓰거나 갱신할 때 → `doc-workflow` 스킬을 로드해 규칙을 따른다
(`vault/90-meta/Doc-Conventions.md`, `vault/90-meta/How-To-Update-Docs.md`와 동일).
트리거: 결정→`02-decisions/` ADR, 코드 변경→`04-development/` Changelog+Dev-Log,
문제→`05-problems/`. **문서는 코드와 같은 변경에서 항상 최신으로.**

## 주요 결정

- `vault/02-decisions/ADR-001-documentation-system.md` — Obsidian 볼트 + graphify 도입
- `vault/02-decisions/ADR-002-hybrid-harness-and-graph-git.md` — AGENTS.md+스킬 하이브리드, graphify-out 커밋

## 명령

- graphify: `graphify . [--obsidian|--update]`, `graphify query "Q"`, `graphify path "A" "B"`, `graphify explain "X"`
- PI 워크플로 명령(`/plan-feature` 등)은 MVP 구현 후 활성화.
