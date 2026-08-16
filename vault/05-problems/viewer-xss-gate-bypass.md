---
updated: 2026-08-16
tags: [problem, security, viewer, gate]
---

# 뷰어 XSS — 산출물 마크다운 원시 HTML 실행으로 게이트 자동 확정 가능

**상태**: 해결 (2026-08-16, 하드닝 루프 이터레이션 4)

## 현상

`apps/plan-viewer/src/lib/mdToBlocks.js` 가 `MarkdownIt({ html: true })` 로 산출물 `.md` 를 파싱하고, 변환된 HTML(`block.html` 등)을 `Block.jsx` 의 `dangerouslySetInnerHTML` 5곳에 주입 — 마크다운에 포함된 원시 HTML(`<img onerror=...>`, `<script>` 등)이 **게이트 페이지 오리진에서 그대로 실행**됨. opengrep(CWE-79)이 4건 지적.

## 위협 모델 — 왜 실재 결함인가

주석에는 ".md 는 신뢰하는 산출물이므로 html 허용"이라 적혀 있었으나 이 가정이 성립하지 않는다:

1. 산출물 markdown은 **Design/Feedback 자식이 작성**하며, web 역량 feedback 에이전트(`web_search`)와 Design 조사는 **외부 콘텐츠를 인용**해 산출물에 끼워 넣는다. 프롬프트 인젝션(악성 웹 페이지) → 산출물에 `<img src=x onerror="fetch('/api/decision',{method:'POST',...})">` 삽입 경로가 열려 있었다.
2. 뷰어는 게이트 서버(localhost)와 **동일 오리진** — 실행된 스크립트는 `POST /api/decision`(confirm)·`POST /api/chat` 등 게이트 API 를 호출할 수 있다.
3. 즉 **"AI 는 게이트를 넘길 수 없다"(5대 원칙 1)를 XSS 를 통해 무력화**하고 사용자 동작 없이 단계를 자동 확정하는 권한 상승이 가능했다. 원칙 1 은 보안 경계이기도 하다.

## 조치

- `html: true → false` — 모든 원시 HTML은 이스케이프된 텍스트로 렌더(구조적 차단, 살균 라이브러리 불필요).
- 그래프 참조(`<!-- graph: ... -->`, ADR-016)는 `html:false` 에서 `html_block` 토큰이 사라지므로 **문단 전체가 참조 코멘트인 경우 그래프 블록으로 전환**하는 감지로 이동(기존 그래프 테스트 3건 무변경 통과).
- 회귀 테스트 3건: 인라인 `img onerror` 이스케이프·`script` 블록 이스케이프·제목 인라인 이스케이프.

## 교훈

- "에이전트가 쓴 산출물"은 신뢰 경계 밖 입력이다 — 에이전트가 외부 콘텐츠를 흡수하는 한 사용자 입력과 동일하게 취급해야 한다.
- 마크다운→HTML 렌더에서 `html:false`가 기본값이어야 하며, 원시 HTML 허용은 그 근거(누가 쓰는지)를 문서화한 경우에만.
- 관련: [[ADR-016-graph-json-externalization]] · [[ADR-003-viewer-architecture]]
