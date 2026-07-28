---
updated: 2026-07-28
tags: [design, workflow-core, viewer, ui, stage-format]
---

# Workflow Core 뷰어/UI 사양 — Stage 산출물 포맷과 게이트 연결

[[ADR-003-viewer-architecture]]에서 뷰어 레이어를 정했다. 이 문서는 workflow-core가 **각 Stage 산출물을 어떤 포맷으로 생산**하고, 뷰어가 그걸 **어떻게 렌더**하며, 코멘트가 **게이트에 어떻게 연결**되는지 명세한다. M1 Stage Registry 강화의 근거.

> 코어는 산출물 파일만 생산([[03-design/workflow-core/03-module-architecture|M1]]). 뷰어는 그 파일을 읽어 렌더. 이 문서는 **산출물 포맷**(코어 책임)을 정의한다 — 뷰어 구현(React/Pi 프롬프트)은 별개.

---

## Stage별 산출물 포맷

| Stage | 산출물 | 포맷 | 뷰어 양식 |
| --- | --- | --- | --- |
| 1 | 요구사항 명세 | **마크다운** | 문서형 |
| 2 | 시나리오 | **마크다운** | 문서형 |
| 3 | 모듈 아키텍처 | **그래프 JSON**(nodes/edges) + 메타 MD | 그래프 에디터형 |
| 4 | 클래스 구조 | **그래프 JSON**(nodes/edges, parent-child) + 메타 MD | 그래프 에디터형 |
| 5 | 구현 계획 | **마크다운** | 문서형 |
| 6 | (검증 게이트) | 산출물 없음 — 1-5 정합 매트릭스 | 검토형 |

### 문서형 (1·2·5)

- 단일 `.md` 파일. 목차·타이틀은 헤딩에서 자동 파생.
- 뷰어: 블록 단위 hover-to-comment, 드래그 영역, 표 셀 코멘트([[03-design/plan-page/core-features|plan-page 사양]]).

### 그래프형 (3·4)

- **`<outputDir>/<feature>/03-modules.json`** 등 — nodes/edges 데이터. 코어가 생산, 뷰어(react-flow 등)가 렌더.
- Stage 4는 `parentNode`로 모듈 그룹이 클래스를 감쌈([[03-design/classes/features|classes 사양]]).
- 메타 MD(설명)를 병행할 수 있다.

### 검토형 (6)

- 산출물 없음. 뷰어가 1-5 산출물을 교차 검증해 정합 매트릭스 표시.

---

## 뷰어 인터페이스 (코어가 보장해야 할 계약)

코어는 산출물 파일을 **표준 포맷**으로 생산해야 뷰어가 렌더 가능:

- **문서형**: 마크다운(markdown-it 호환).
- **그래프형**: `nodes: [{id, type, position, data, parentNode?}]`, `edges: [{id, source, target, data}]` (react-flow 호환).
- 산출물 경로는 [[03-design/workflow-core/04-class-structure|state.json]] `artifacts[n].path`에 기록. `artifacts[n].format` 필드 추가 제안(`document | graph | review`).

---

## 코멘트 → 수정 게이트 연결

1. 뷰어에서 코멘트 작성(블록/영역/셀/노드/엣지) → **pending 큐**(`{targetId, quote?, text}`).
2. 사용자 **'수정 지시'** 클릭 → pending 코멘트 일괄 → workflow-core **FR-3 수정 판정**.
3. 코어가 Design Agent에게 코멘트 전달 → 산출물 재작성 → Feedback 재검토 루프.
4. **직접 편집 ❌** — 코멘트→Agent 경로만(5대 원칙, [[project-identity]]).

> Pi Tier 0에서 코멘트 큐는 `.factorynote/comments.json`(또는 state.json 내)에 임시 저장 → '수정 지시' 시 Agent 컨텍스트로 주입.

---

## M1 Stage Registry 강화 (후속)

[[03-design/workflow-core/03-module-architecture|M1]]의 Stage 정의에 **산출물 포맷**(위 표)을 추가한다. 각 Stage 템플릿:

- 문서형: 마크다운 템플릿(현행).
- 그래프형: nodes/edges 스키마 템플릿(신규) — `ModuleNode`/`ClassNode`/`modGroup` 타입 정의 포함.

---

## 향후 본 구현 체크리스트

- [ ] Stage 3·4 산출물을 nodes/edges JSON 으로 생산
- [ ] state.json `artifacts[n]` 에 `format`(document|graph|review) 기록
- [ ] 코멘트 큐 → '수정 지시' → Design Agent 전달 경로
- [ ] 그래프 산출물에 parent-child(Stage 4 모듈 계층) 지원
- [ ] 검토형(Stage 6)이 1-5 산출물을 교차 읽어 매트릭스 생성

---

## 참고

- [[ADR-003-viewer-architecture]] — 뷰어 레이어 결정
- [[03-design/plan-viewer/ui-mapping|ui-mapping]] — Stage UI 매핑
- [[03-design/plan-page/core-features|plan-page]] · [[03-design/module-design/features|module]] · [[03-design/classes/features|classes]] — 뷰어 UI 사양
- [[03-design/workflow-core/03-module-architecture|M1 Stage Registry]] · [[03-design/workflow-core/04-class-structure|M3 state.json]]
- [[Home]]
