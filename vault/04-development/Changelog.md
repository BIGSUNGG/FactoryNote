---
updated: 2026-07-26
tags: [development, changelog]
---

# Changelog

FactoryNote의 주요 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 양식.
코드/기능 변경을 같은 세션에서 이 파일에 반영한다.

## [Unreleased]

### Added

- 문서 시스템 구축: `vault/` Obsidian 볼트(7영역) + Doc-Conventions/How-To-Update-Docs + ADR 템플릿.
- 루트 `AGENTS.md`(상시 프로젝트 오리엔테이션) 추가 — [[ADR-002-hybrid-harness-and-graph-git]].
- graphify 스킬 설치(`~/.pi/agent/skills/graphify/`). 코드 생긴 뒤 첫 빌드 예정.

### Changed

- `valut/` 오타 폴더 제거 → `vault/`로 재생성.
- PI harness를 `.pi/skills` 단일 → 루트 `AGENTS.md` + `.pi/skills/doc-workflow` **하이브리드**로 변경([[ADR-002-hybrid-harness-and-graph-git]]).
- `graphify-out/` Git 정책: 전체 gitignore → **그래프는 커밋**(`cache/`·`cost.json`만 제외).

### Fixed

- _(없음)_

### Removed

- 빈 `valut/` 폴더.

## [0.0.0] - 2026-07-26

- 리포 초기화(`.gitattributes`, `LICENSE`).
