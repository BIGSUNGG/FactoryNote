# Plan: FactoryNote 프로젝트 기획 Vault 문서 작성

## Context

FactoryNote는 AI 코딩 harness(Codex, Pi, Claude Code 등) 위에서 동작하는 **범용 Human-Gated Plan 생성 워크플로 패키지**다. AI가 의도를 충분히 파악하기 전에 코드를 서두르는 문제를, 6단계 산출물을 AI가 작성하고 사용자가 각 단계마다 검토·수정·확정하는 인간 승인 게이트로 통제한다.

사용자가 이 핵심 기획(vision + multi-agent architecture)을 vault 문서로 정리해달라고 요청했다. 현재 `00-vision/`과 `01-architecture/`가 비어있으며, 이 기획 문서들이 그 빈칸을 채운다.

### 핵심 개념 (사용자 확인 완료)

**Plannotator와의 차별점**: Plannotator는 구현 계획을 직접(one-shot) 작성한다. FactoryNote는 6단계로 나누어 각 단계마다 AI가 산출물을 작성 → 사용자가 검토·수정·확인 → 승인 후 다음 단계로 진행한다. 사용자가 프로젝트 구조를 원하는 대로 통제하고 이해할 수 있다.

**6단계 워크플로** (사용자 확인: "6단계가 맞음"):

| # | 단계 | 산출물 |
| --- | ------ | -------- |
| 1 | 요청 이해 | 요구사항 명세 |
| 2 | 정상 동작 시나리오 | 시나리오 명세 |
| 3 | 모듈 아키텍처 설계 | 모듈 구조도 |
| 4 | 클래스 수준 구조 설계 | 클래스 명세 |
| 5 | 구현 계획 | 구현 순서·의존성 |
| 6 | 검증 단계 | 테스트 계획·검증 기준 |

**멀티에이전트 구조** (사용자 확인: "현재 3개, 향후 확장·단계별 변형 가능"):

- **Director Agent** (조율자): 각 단계에서 하위 에이전트 생성, Design↔Feedback 루프 관리, 사용자 승인 게이트 관리
- **Design Agent** (설계자): 요청 이해, 구조 설계, 산출물 작성
- **Feedback Agent** (검토자): 보안·병목·구조 문제 탐지 → Design Agent에게 재설계 요청

## Approach

vault 컨벤션(`vault/90-meta/Doc-Conventions.md`)을 따라 2개의 문서를 작성한다.

### 문서 1: `vault/00-vision/project-identity.md`

정체성·차별점·원칙을 정의하는 비전 문서.

**포함 내용:**

- FactoryNote 정의 (범용 Human-Gated Plan 생성 워크플로)
- 해결하는 문제 (AI가 의도 파악 전 코드 서두름)
- Plannotator와의 차이 (one-shot → 6단계 반복적 인간 승인)
- 범용성 (Codex, Pi, Claude Code 등 harness-agnostic)
- 5대 원칙 (`AGENTS.md`에서 인용, 단계별 게이트와 연결)
- 용어집 (Director/Design/Feedback Agent, Stage, Artifact, Gate, Harness)

**frontmatter:**

```yaml
---
updated: 2026-07-28
tags: [vision, identity]
---
```

### 문서 2: `vault/01-architecture/multi-agent-pipeline.md`

에이전트 구조와 파이프라인을 정의하는 아키텍처 문서.

**포함 내용:**

- 멀티에이전트 아키텍처 개요 (Director → Design + Feedback)
- 각 에이전트 역할·책임
- Design↔Feedback 루프 (산출물 작성 → 검토 → 이슈 시 재설계 → 클린 시 사용자 게이트)
- 6단계 파이프라인 (위 표 + 각 단계별 상세)
- 인간 승인 게이트 (단계 간 사용자 검토·승인)
- 확장성 (단계별 에이전트 변형, 향후 역할 추가 가능성 명시)

**frontmatter:**

```yaml
---
updated: 2026-07-28
tags: [architecture, agents, pipeline]
---
```

## Files to modify

| 파일 | 작업 |
| ------ | ------ |
| `vault/00-vision/project-identity.md` | **신규 작성** — 비전 문서 |
| `vault/01-architecture/multi-agent-pipeline.md` | **신규 작성** — 아키텍처 문서 |
| `vault/Home.md` | **수정** — 상태 "비어있음" → 문서 링크로 교체 |
| `AGENTS.md` | **수정** — "9단계" → "6단계"로 정정 (Home MOC 설명 일치화) |
| `vault/04-development/Changelog.md` | **갱신** — Added: 비전·아키텍처 문서 |
| `vault/04-development/Dev-Log.md` | **갱신** — 오늘 작업 기록 |

## Reuse (기존 자산)

- `AGENTS.md` — 5대 원칙 원문 (비전 문서에서 인용)
- `vault/02-decisions/ADR-001-documentation-system.md` — vault 구조 결정 배경
- `vault/90-meta/Doc-Conventions.md` — 파일명·frontmatter·wikilink 규칙
- `.pi/skills/doc-workflow/SKILL.md` — 트리거→행동 맵 (문서 작성 규칙)

## Steps

- [ ] `vault/00-vision/project-identity.md` 작성 (정체성, 차별점, 범용성, 5대 원칙, 용어집)
- [ ] `vault/01-architecture/multi-agent-pipeline.md` 작성 (에이전트 구조, Design↔Feedback 루프, 6단계, 게이트, 확장성)
- [ ] `vault/Home.md` 수정 (00-vision, 01-architecture 상태 "비어있음" → wikilink로 교체)
- [ ] `AGENTS.md` 수정 ("9단계" 참조 → "6단계"로 정정, 필요시 맥락 보완)
- [ ] `vault/04-development/Changelog.md` 갱신 (Added 섹션)
- [ ] `vault/04-development/Dev-Log.md` 갱신 (오늘 날짜 항목)

## Verification

- [ ] 두 문서가 Doc-Conventions 규칙(kebab-case 파일명, frontmatter, wikilink, 한국어 본문, H1 시작)을 따르는가
- [ ] 두 문서 간 wikilink로 상호 연결되어 있는가
- [ ] [[Home]] MOC에서 두 문서로 링크가 연결되는가
- [ ] AGENTS.md의 5대 원칙과 새 문서의 6단계 파이프라인이 일관성을 갖는가
- [ ] 기존 "9단계" 참조가 "6단계"로 정정되었는가
- [ ] Changelog/Dev-Log에 문서 추가가 기록되었는가
- [ ] `updated` 필드가 2026-07-28로 갱신되었는가
