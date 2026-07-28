---
updated: 2026-07-26
tags: [development, dev-log]
---

# Dev-Log

날짜별 작업 기록. 무엇을 했는지, 왜, 무엇이 남았는지. [[Changelog]]는 외부용 단위, 본 파일은 일일 흐름.

## 2026-07-26

### 한 일

- FactoryNote 프로젝트 요구사항(9단계 Human-Gated 워크플로 PI 패키지) 파악 및 프로젝트 메모리 저장.
- graphify 조사: Pi 공식 지원 확인, CLI 0.9.27 + Obsidian 설치됨 확인, Pi 통합 문서 인덱싱.
- graphify 스킬을 PI에 설치(`graphify install --platform pi` → `~/.pi/agent/skills/graphify/`).
- 문서 볼트 구조 설계 및 검증: `vault/` 7영역(vision/architecture/decisions/design/development/problems/research/meta).
- 볼트 스캐폴드 + 핵심 문서 작성: Home, Doc-Conventions, How-To-Update-Docs, ADR 템플릿, ADR-001, Changelog, Dev-Log, graphify 조사 노트.
- 이전 세션 메모리(5개)와 충돌 발견: 디스크는 그린필드(이전 산출물 없음), 메모리만 남아 하이브리드 harness·graphify-out 커밋 등 다른 결정 포함.
- 사용자 검증으로 harness·Git 정책 재확정: 하이브리드(루트 `AGENTS.md` + `.pi/skills/doc-workflow`) + `graphify-out/` 커밋(`cache/`·`cost.json` 제외) → [[ADR-002-hybrid-harness-and-graph-git]].
- 루트 `AGENTS.md` 작성(상시 오리엔테이션), `.gitignore` 정책 변경, 프로젝트 메모리 stale 항목 정리 예정.

### 왜

- AI가 의도 파악 전 코드를 서두르는 문제를 통제하려면 결정·설계·문제를 단계별로 기록하는 체계가 선행되어야 함.
- 문서 규율을 사람 기억이 아닌 harness로 굳혀 갱신 누락을 방지.

### 남은 것 / 다음

- 볼트 영역에 실문서 채우기(00-vision Overview/Goals/Glossary, 01-architecture).
- 모노레포 스캐폴딩 또는 Workflow Core 설계 착수.
- 코드 생긴 뒤 graphify 첫 빌드(`/graphify . --obsidian`) 후 `graphify-out/` 검증(graph.json 크기 모니터, 필요시 `--no-viz`).
- 필요시 설계 산출물·포스트모템 템플릿 추가.
