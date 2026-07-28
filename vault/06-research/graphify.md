---
updated: 2026-07-26
tags: [research, tooling, graphify]
---

# graphify — 코드 지식 그래프

## 요약

graphify는 코드·문서·PDF·이미지 등을 지식 그래프로 변환하는 오픈소스(Apache 2.0) AI 코딩 어시스턴트 스킬이다. 온디바이스에서 tree-sitter AST로 파싱하고, 관계마다 EXTRACTED/INFERRED/AMBIGUOUS 태그를 달아 근거를 추적할 수 있다. PI를 공식 지원한다.

## 왜 도입했나

FactoryNote는 요구사항→시나리오→모듈→클래스→코드→테스트 추적성이 핵심이다. graphify가 코드와 `vault/` 문서를 노드/엣지 그래프로 만들면, 변경 영향 범위와 산출물 간 연결을 그래프 질의로 확인할 수 있다. RAG(벡터 유사도)와 달리 근거가 명확한 경로 기반 답변이 나온다.

## 설치 상태 (2026-07-26)

- Python 패키지: `graphifyy`(PyPI), `uv tool`로 설치됨. CLI `graphify` 0.9.27 확인.
- PI 스킬: `graphify install --platform pi` 실행 → `~/.pi/agent/skills/graphify/SKILL.md` (+ `references/`).
- MCP 서버: 스킬이 bash로 graphify를 구동하므로 별도 등록 불필요(필요시 `graphify install`로 등록 가능).
- Obsidian: 설치됨(`$APPDATA/obsidian` 확인).

## 주요 사용법

```bash
graphify .                          # 전체 파이프라인 (HTML 기본)
graphify . --obsidian               # Obsidian 볼트도 생성
graphify vault/ --obsidian          # 문서만 그래프화
graphify . --update                 # 증분 빌드 (변경분만)
graphify . --wiki                   # 커뮤니티별 위키 markdown
graphify query "Auth는 어떻게 연결되나"   # 그래프 질의
graphify path "A" "B"               # 두 노드 간 최단 경로
graphify explain "AuthService"      # 노드와 이웃 설명
graphify . --svg --graphml          # 외부 도구용 내보내기
```

- 출력 디렉터리: `graphify-out/` (graph.json, graph.html, GRAPH_REPORT.md, obsidian/). `.gitignore` 처리.
- PI 세션 안에서는 `/graphify .` 로 실행(다음 세션부터 스킬 인식).

## FactoryNote에서의 역할

- **입력**: 리포 전체(코드 + `vault/`). 볼트의 설계 산출물·ADR도 노드가 됨.
- **출력**: `graphify-out/` 그래프. 수기 볼트(`vault/`)와 분리 — 재생성 산출물은 진실의 원천과 섞지 않는다([[ADR-001-documentation-system]]).
- **질의**: "이 요구사항이 어떤 코드로 구현됐나", "이 클래스 변경 시 영향받는 산출물" 등.

## 한계 / 주의

- 코드가 없는 현재 시점에서 빌드는 의미 없음 — 코드 생긴 뒤 첫 빌드 예정.
- 의미적 추론(INFERRED) 엣지는 모델 호출이라 비용/정확도 편차가 있음. EXTRACTED 엣지 위주로 신뢰.
- `--mode deep`은 더 느리고 비용이 큼. 기본 모드 우선.

## 참고

- 공식: <https://graphify.com/> · Pi 통합: <https://graphify.com/integrations/pi>
- CLI 레퍼런스: <https://graphify.net/graphify-cli-commands.html>
- 결정 배경: [[ADR-001-documentation-system]]
