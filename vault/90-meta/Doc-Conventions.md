---
updated: 2026-07-26
tags: [meta, convention]
---

# 문서 작성 컨벤션

FactoryNote 볼트의 모든 문서가 따르는 규칙이다. [[Home]]과 [[How-To-Update-Docs]]와 함께 본다.

## 파일 이름

- `Kebab-Case.md` (하이픈 구분, 공백 없음, 영문 권장). 예: `system-architecture.md`
- ADR: `ADR-NNN-kebab-title.md` (예: `ADR-002-json-state-store.md`)
- 설계 산출물: `03-design/<feature>/<artifact>.md` (예: `03-design/auth/requirements.md`)

## 구조

- 모든 문서는 `# 제목`(H1)으로 시작.
- frontmatter는 선택적이나 권장. 최소 형태:

  ```yaml
  ---
  updated: 2026-07-26
  tags: [area, topic]
  ---
  ```

- ADR은 추가로 `status: proposed | accepted | superseded` 필수.
- 본문은 한국어. 코드/식별자/파일경로는 영문 그대로.

## 링크와 태그

- 관계는 Obsidian 위키링크 `[[Kebab-Name]]`로 표현. 관련 문서는 적극 연결.
- 태그: 영역 + 주제. 예: `#adr`, `#design/auth`, `#problem`, `#architecture`.
- 새 문서를 만들면 [[Home]] MOC나 소속 영역 인덱스에서 링크한다.

## 신선도 (freshness)

- 문서를 다루는 변경을 할 때는 해당 문서의 `updated`를 오늘로 갱신.
- 코드 변경과 같은 커밋/세션에서 관련 문서도 함께 업데이트. ([[How-To-Update-Docs]] 참고)
- 오래되거나 틀린 내용을 발견하면 그 자리에서 고치거나 05-problems에 기록.

## 그래프 친화적 작성

- graphify가 본 볼트를 인덱싱하므로, H1/H2 제목을 명확히 한다.
- 파일 하나 = 주제 하나. 한 파일에 너무 많은 주제를 섞지 않는다.
- 외부 문서 링크보다 내부 위키링크를 우선 (그래프 노드로 잡힘).
