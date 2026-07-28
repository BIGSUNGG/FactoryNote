---
name: doc-workflow
description: "FactoryNote 프로젝트 문서 워크플로. vault/에 기획·설계·결정(ADR)·Changelog·Dev-Log·문제·조사 노트를 작성/갱신할 때, 또는 결정을 내리거나 코드/기능을 구현·변경하거나 문제·블로커에 부딪혔을 때 로드. vault/ 7영역 구조, ADR 작성, Changelog/Dev-Log 갱신, 문서 컨벤션(kebab-case 파일명, wikilink, tags, freshness)을 강제하고 '문서는 코드와 함께 항상 최신' 원칙을 적용한다."
---

# FactoryNote 문서 워크플로

이 스킬은 FactoryNote 리포의 문서를 항상 최신으로 유지하고, 결정·수정·문제를 적극 기록하게 만드는 프로젝트 규칙이다.

## 핵심 원칙

1. **문서는 코드와 같은 변경에서 함께 갱신한다.** 오래된 문서는 버그다.
2. **망설이면 기록한다.** 결정은 ADR로, 변경은 Changelog로, 문제는 05-problems로.
3. **진실의 원천은 `vault/`** (수기 볼트). `graphify-out/`은 재생성 산출물이라 편집 금지.

## vault 구조 (절대 경로 기준)

```
vault/
├─ Home.md                  ← MOC. 새 문서는 여기서 링크.
├─ 00-vision/               ← 정체성·목표·5대원칙·용어집
├─ 01-architecture/         ← 3계층 구조·패키지맵·9단계·에이전트 역할
├─ 02-decisions/            ← ADR-NNN-kebab-title.md (정해진 사항)
├─ 03-design/<feature>/     ← 기능별 설계 산출물(워크플로 9단계 출력)
├─ 04-development/          ← Changelog.md + Dev-Log.md (수정 사항)
├─ 05-problems/             ← 이슈·블로커·포스트모템
├─ 06-research/             ← 조사 노트
└─ 90-meta/                 ← Doc-Conventions.md, How-To-Update-Docs.md, templates/
```

## 트리거 → 행동

작업을 시작하거나 마치기 전에 아래를 점검하라.

| 상황 | 행동 |
| ------ | ------ |
| 아키텍처·도구·컨벤션 결정 | `02-decisions/ADR-NNN-*.md` 작성 (`90-meta/templates/adr.md` 사용). 기존 결정을 바꾸면 기존 ADR을 `superseded`로 하고 새 ADR로 링크. |
| 코드·기능 구현/변경 | `04-development/Changelog.md`(Added/Changed/Fixed/Removed)와 `Dev-Log.md`(오늘 날짜 항목)를 같은 세션에서 갱신. |
| 버그·블로커·예상치 못한 문제 | `05-problems/<short-name>.md` 작성(현상/원인/조치/영향/교훈). 해결 시 상태 표시. |
| 외부 도구·라이브러리·접근법 조사 | `06-research/<topic>.md` 작성(요약+증거+결론). |
| 기능 설계 산출물 | `03-design/<feature>/<artifact>.md` (requirements/scenarios/module-architecture/...). |
| 비전·원칙·용어 정립 | `00-vision/`, `01-architecture/`에 문서 추가. |

## 컨벤션 (요약)

- 파일명: `Kebab-Case.md`, 공백 없음. ADR은 `ADR-NNN-kebab-title.md`.
- 모든 문서는 H1 제목으로 시작.
- frontmatter(선택·권장): `updated: YYYY-MM-DD`, `tags: [area, topic]`. ADR은 `status` 필수.
- 관계는 Obsidian 위키링크 `[[Kebab-Name]]`로 연결. 새 문서는 [[Home]]이나 소속 영역에서 링크.
- 본문 한국어, 식별자/경로는 영문 그대로.
- 문서를 건드리면 `updated`를 오늘로.
- 전체 규칙: `vault/90-meta/Doc-Conventions.md`, `vault/90-meta/How-To-Update-Docs.md`.

## 절차 (매 변경 시)

1. **영향 파악**: 이 변경이 어떤 문서에 영향을 주는가? (graphify 그래프가 있으면 `graphify query`/`explain`으로 범위 확인)
2. **기록**: 위 트리거 표에 따라 해당 문서를 갱신 또는 생성.
3. **링크**: 새 문서를 [[Home]]이나 관련 문서에 연결.
4. **신선도**: 갱신한 문서의 `updated`를 오늘로.
5. **검증**: PR/커밋 전 "어떤 문서가 영향받았나" 자문하고 빠진 기록 보충.

## graphify 연동

- `/graphify . --obsidian`으로 리포(vault 포함)를 그래프화. 출력은 `graphify-out/`(gitignore).
- 수기 볼트와 graphify 출력을 섞지 않는다.
- 자세한 건 `vault/06-research/graphify.md`.

## 피해야 할 안티패턴

- 결정을 ADR 없이 채팅/코드 주석에만 남기기.
- 코드는 바꿨는데 Changelog/Dev-Log를 안 갱신하기.
- 문서 제목에 공백/대문자 혼용(`User Auth.md` ❌ → `user-auth.md` ✅).
- `graphify-out/`을 수동 편집하거나 커밋하기.
- 새 문서를 만들고 [[Home]]에서 링크하지 않기(고립된 문서).
