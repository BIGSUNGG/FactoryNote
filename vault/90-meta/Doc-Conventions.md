---
updated: 2026-08-18
tags: [meta, convention, agent-readability]
---

# 문서 작성 컨벤션

FactoryNote 볼트의 모든 문서가 따르는 규칙이다. [[Home]]과 [[How-To-Update-Docs]]와 함께 본다.

## 파일 이름

- `Kebab-Case.md` (하이픈 구분, 공백 없음, 영문 권장). 예: `system-architecture.md`
- ADR: `ADR-NNN-kebab-title.md` (예: `ADR-002-json-state-store.md`)
- 설계 산출물: `03-design/<feature>/<artifact>.md` (예: `03-design/auth/requirements.md`)

## 구조

- 모든 문서는 `# 제목`(H1)으로 시작.
- frontmatter는 **필수**. 최소 형태:

  ```yaml
  ---
  updated: 2026-08-18
  tags: [area, topic]
  ---
  ```

- ADR은 추가로 `status: proposed | accepted | superseded` 필수.
- 본문은 한국어. 코드/식별자/파일경로는 영문 그대로.

## 에이전트 가독성 (agent readability)

에이전트가 문서를 빠르고 정확하게 읽게 하는 규칙. 사람이 읽는 순서가 아니라 **검색·스캔 순서**로 설계한다.

1. **TL;DR 선행**: 실질 내용이 있는 문서(Changelog·Dev-Log·Home 등 로그/인덱스 제외)는 H1과 서론 바로 아래에 요약 블록을 둔다. 3문장 이내로 "이 문서가 무엇이고, 무엇을 알 수 있는지"를 쓴다.

   ```markdown
   > **TL;DR**: 이 문서는 ~를 다룬다. 핵심은 A·B·C. ~할 때 참고한다.
   ```

2. **결론 먼저**: 문단·섹션은 결론/요약을 먼저 쓰고 근거를 뒤에 쓴다. 에이전트는 앞부분을 먼저 읽는다.
3. **안정적 섹션 어휘**: 문서 유형별 표준 H2 어휘를 유지한다 — 에이전트는 제목으로 필요한 섹션을 찾는다.
   - ADR: 상태 · 날짜 · 맥락 · 결정 · 이유 · 대안 · 결과 · 참고
   - 문제(05-problems): 현상 · 재현 · 원인 · 조치 · 영향 · 교훈
   - 조사(06-research): 요약 · 증거 · 결론
   - 설계(03-design): 요구사항 · 시나리오 · 모듈/클래스 · UI (단계 산출물 번호 유지)
4. **freshness 엄수**: `updated`는 문서 마지막 수정일이며 누락 금지. 코드와 문서를 같은 세션에서 갱신한다.
5. **링크 무결성**: 위키링크·상대경로 링크의 대상 파일은 반드시 존재해야 한다. 새 문서 작성·이름 변경 시 링크를 점검한다.
6. **하나의 문서 = 하나의 주제**: 유지. 주제가 섞이면 스캔 비용이 급증한다.

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
