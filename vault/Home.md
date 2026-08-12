---
updated: 2026-08-11
tags: [moc]
---

# FactoryNote 문서 홈

FactoryNote 개발 문서의 중앙 인덱스(MOC)다. 모든 영역과 주요 문서로 연결된다.

## 영역

| 영역 | 용도 | 상태 |
| ------ | ------ | ------ |
| `00-vision/` | 정체성 · 목표 · 5대 원칙 · 용어집 | [[project-identity]] |
| `01-architecture/` | 3단계 파이프라인 · 에이전트 역할 · 구현 아키텍처 | [[multi-agent-pipeline]] · [[implementation-architecture]] |
| `02-decisions/` | ADR (정해진 사항) | [[ADR-001-documentation-system]] · [[ADR-002-hybrid-harness-and-graph-git]] · [[ADR-003-viewer-architecture]] · [[ADR-004-monorepo-structure]] · [[ADR-005-mvp-implementation]] · [[ADR-006-graph-editor]] · [[ADR-007-pipeline-hardening]] · [[ADR-008-3-stage-pipeline]] · [[ADR-009-tier-1-agent-orchestration]] · [[ADR-009-realtime-chat-loop]] · [[ADR-010-context-overflow-file-protocol]] · [[ADR-010-md-design-stage]] · [[ADR-011-comment-to-chat-consolidation]] · [[ADR-012-child-tool-allowlist-spawn]] · [[ADR-013-parallel-feedback-pipeline]] · [[ADR-014-dynamic-feedback-agents]] · [[ADR-015-stage-artifact-folders]] · [[ADR-016-graph-json-externalization]] · [[ADR-017-feedback-levels]] · [[ADR-018-hierarchical-graph-tree]] · [[ADR-019-stage-2-graph-required]] · [[ADR-020-multi-named-graphs]] |
| `03-design/` | 기능별 설계 산출물 | [[03-design/plan-page/core-features | plan-page]] · [[03-design/module-design/features | 모듈 설계]] · [[03-design/classes/features | 클래스]] · [[03-design/plan-viewer/ui-mapping | UI 매핑]] · [[03-design/workflow-core/06-viewer-ui | 뷰어 사양]] |
| `04-development/` | Changelog · Dev-Log (수정 사항) | [[Changelog]] · [[Dev-Log]] |
| `05-problems/` | 이슈 · 블로커 · 포스트모템 | [[parallel-worktree-seam-defects]] · [[graph-output-stale-design-prompt]] · [[graph-drilldown-pointer-events]] |
| `06-research/` | 조사 노트 | [[graphify]] · [[plannotator-plan-page]] |
| `90-meta/` | 컨벤션 · 템플릿 · 매뉴얼 · 가이드 | [[Doc-Conventions]] · [[How-To-Update-Docs]] · [[usage-guide]] · [[development-guide]] |

## 주요 문서

- [[implementation-architecture]] — **구현된 코드 구조·모듈 책임·런타임 데이터 흐름·데이터 계약** (구현 이해의 시작점)
- [[project-identity]] — FactoryNote 정체성, Plannotator와의 차이, 5대 원칙, 용어집
- [[multi-agent-pipeline]] — 멀티에이전트 구조, 6단계 파이프라인, 승인 게이트(기획)
- [[Doc-Conventions]] — 문서 작성 규칙 (이름, 링크, 태그, frontmatter)
- [[How-To-Update-Docs]] — 결정/구현/문제 발생 시 무엇을 기록할지
- [[ADR-004-monorepo-structure]] — 코드 레포 폴더 구조(plannotator 모노레포 패턴 채택)
- [[ADR-005-mvp-implementation]] — MVP 구현 결정(plan 모드 토글·웹-as-게이트·통합 런타임 디렉터리·Tier 0; 결정 #4·NFR-7 은 ADR-009 로 폐지)
- [[ADR-006-graph-editor]] — Stage 3/4 다중 섹션 그래프 에디터(직접 편집→에이전트 채택) — ADR-016 로 대체됨
- [[ADR-007-pipeline-hardening]] — 파이프라인 경화(다단계 회귀·FR-2 경성 에스컬레이션·게이트 타임아웃·resume·plan 모드 자동 해제)
- [[ADR-009-realtime-chat-loop]] — 게이트 오픈 중 실시간 에이전트 채팅 루프(runGate 이벤트 유니온·chatPending·루프카운트 미포함)
- [[ADR-010-md-design-stage]] — Stage 2 설계 md 단일진실(그래프 파생/역동기화) — 인라인 펜스는 ADR-016 로 대체됨
- [[ADR-011-comment-to-chat-consolidation]] — 코멘트를 실시간 채팅으로 통합(SidePanel 검토 큐·"수정 지시" 버튼 폐지, 레이아웃 [문서|채팅] 2단)
- [[ADR-009-tier-1-agent-orchestration]] — Tier 1 에이전트 오케스트레이션 도입(Tier 0·NFR-7 폐지; Design↔Feedback 자식 스폰 루프; 폐지된 Tier 0는 ADR-017 에서 none 수준으로 opt-in 부활)
- [[ADR-010-context-overflow-file-protocol]] — Director 컨텍스트 누적 차단(파일 경로 산출물 교환 + 자식 스폰 컨텍스트 제약; 1261 해소)
- [[ADR-015-stage-artifact-folders]] — 단계 산출물을 `<feature>/stageN/` 서브폴더에 배치(보조 파일은 feature 루트 유지)
- [[ADR-016-graph-json-externalization]] — 그래프 데이터 동반 `.json` 분리 + 3단계 동일 문서 렌더 + 관계 기반 자동 배치(직접편집·인라인 펜스·수동 배치 폐지)
- [[ADR-017-feedback-levels]] — Feedback 수준(none|low|medium|high|ultra)으로 검토 에이전트 수 조절(none = 게이트 직행 opt-in Tier 0, 리밋 시 3-4개 배치 분할)
- [[ADR-018-hierarchical-graph-tree]] — 그래프 단일 파일을 계층 트리(루트 + 자식 파일 서브디렉터리, 나가는 refs {to,comment})로 재구조화 + 임의 깊이 드릴다운 뷰어(더블클릭 토글·다중 선택 병합·미선택 참조 숨김)
- [[ADR-019-stage-2-graph-required]] — Stage 2 그래프 작성 필수(코드 검증·Feedback 전 반려) + 단계별 스폰 명령 분기(none/required/optional)
- [[ADR-020-multi-named-graphs]] — 산출물당 다중 그래프 + 에이전트 자유 네이밍(이름 그대로 승격, 고정 이름·md 재작성 폐지, stageN/ 명시 접두 라우팅)
- [[parallel-worktree-seam-defects]] — 병렬 워크트리 seam 결함 + gate-server `revertTo` drop 포스트모템
- [[graph-output-stale-design-prompt]] — 그래프 미출력: 낡은 design-prompt.md 주입 + 참조 규약 위반 포스트모템
- [[graph-drilldown-pointer-events]] — 그래프 드릴다운 미출력: ReactFlow v11 pointer-events:none 주입 포스트모템
- [[usage-guide]] · [[development-guide]] — 설치/사용법 · 빌드/테스트/확장 가이드
- [[ADR-001-documentation-system]] — 이 볼트 구조와 도구를 왜 이렇게 정했는가
- [[Changelog]] · [[Dev-Log]] — 변경 이력과 일일 작업 기록
- [[graphify]] — 코드 지식 그래프 도구 조사 노트

## 원칙

> 문서는 코드와 같은 변경에서 함께 갱신한다. 오래된 문서는 버그다.
> 정해진 사항은 ADR로, 수정 사항은 Changelog로, 문제는 05-problems로 적극 기록한다.
