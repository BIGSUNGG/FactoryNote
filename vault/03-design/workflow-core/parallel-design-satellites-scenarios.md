---
updated: 2026-08-18
tags: [design, workflow-core, parallel-satellites]
---

# 병렬 위성 Design 에이전트 — 동작 시나리오

> **TL;DR**: `designLevel`(low/medium/high)에 따라 Stage 의 Design 단계가 주 문서(draft.md) 에이전트 1기 + 위성 N기(draft.<role>.md)를 `runs.all`로 병렬 스폰한다. 위성은 design-prompt를 읽고 자기 파일만 쓰며 경로만 반환하고, 게이트·필수 그래프·피드백·승격·무효화는 전부 주 문서 기준. 기본 `low`는 현행 단일 에이전트와 완전히 동일하게 동작한다. ([[ADR-031-parallel-design-satellites]])

## 진입 조건

- `/factorynote` plan 모드 ON.
- `factorynote_plan` 호출 시 `designLevel` 파라미터로 수준 선택 — 미지정 시 `low`(현행과 동일).
- 수준별 에이전트 수(주 문서 + 위성):

| designLevel | 주 문서 | 위성 | 합계 |
| --- | --- | --- | --- |
| `low`(기본) | 1(`factorynote-design`) | 0 | 1 |
| `medium` | 1 | 1 | 2 |
| `high` | 1 | 2 | 3 |

## 파일 교환 레이아웃 (`.factorynote/<feature>/`)

| 파일 | 역할 | 소유 |
| --- | --- | --- |
| `design-prompt.md` | 현 단계 작성 지시(불변) | 어댑터가 기록 |
| `design-menu.md` | 현 단계 위성 역할 메뉴 + 레벨 지시 | 어댑터가 기록·전이 시 갱신 |
| `feedback-menu.md` | 피드백 에이전트 메뉴(기존) | 어댑터가 기록 |
| `draft.md` | 주 문서(게이트·그래프·승격 대상) | 주 문서 에이전트 |
| `draft.<role>.md` | 위성 문서(작업 영역 루트, 승격 제외) | 위성 에이전트 |
| `feedback.md.<axis>` | 축별 피드백 리뷰(기존) | 피드백 에이전트 |
| `stageN/…` | 승격된 그래프·확정 산출물(기존) | 어댑터 |

## 시나리오 A — designLevel=high, Stage 1 정상 흐름 (happy path)

1. **진입**: 사용자가 `factorynote_plan(feature="주문-정산", designLevel="high")` 호출. Stage 1(요구사항·시나리오).
2. **메뉴 기록**: 어댑터가 `.factorynote/주문-정산/`에 `design-prompt.md`(Stage 1 지시) · `feedback-menu.md` · `design-menu.md`(Stage 1 역할 3개 + "위성 2개" 지시)를 기록.
3. **spawn-design 지시문 반환**: `nextAction="spawn-design"`, `designLevel="high"`, `designMenuPath` 포함. 지시문 메시지는 다음을 명시:
   - 주 문서: `agent="factorynote-design"`, 과제(spawnTask) 그대로 → `draft.md` 작성·경로만 반환.
   - 위성: `design-menu.md`를 읽고 **위성 2개를 추려** `workflowScript runs.all`로 주 문서와 **병렬 스폰** — 각각 `factorynote-design-<name>`, "designPrompt를 읽고 `<focus>` 관점으로 `draft.<name>.md`만 작성, 그래프 금지, 반환은 경로만".
4. **병렬 스폰(3기)**: Director가 같은 메시지 블록에서 주 문서 에이전트 + 위성 2기를 스폰. 세 에이전트는 서로의 산출물을 읽지 않는다(주 문서와 병렬이므로 위성은 `design-prompt.md`만 읽음).
   - 주: `draft.md` — 요구사항·범위·시나리오 원문 + 그래프(Stage 2 한정).
   - 위성 예: `factorynote-design-requirements-scope` → `draft.requirements-scope.md`(요구사항 분해·범위 경계), `factorynote-design-nonfunctional-constraints` → `draft.nonfunctional-constraints.md`(성능·보안·확장성).
5. **집합 보고**: Director가 주 문서 경로를 `designArtifact`로, 위성 각각을 `[requirements-scope] <경로>` 헤더 + 경로로 보고.
6. **Feedback**: `nextAction="spawn-feedback"` — 피드백은 기존과 동일하게 **주 문서(draft.md)를 검토** (위성 문서는 검토 대상 아님).
7. **게이트**: Feedback CLEAN → 웹 게이트 오픈 → 사용자 승인 시 다음 Stage 전이. 전이 시 `design-prompt.md`·`feedback-menu.md`·`design-menu.md`가 다음 단계(Stage 2) 것으로 갱신됨.

## 시나리오 B — 재작성 라운드 (반려 → 동일 웨이브 재스폰)

1. Feedback(주 문서 검토)이 ISSUES → 어댑터가 `nextAction="spawn-design"`, `dfLoop=1`로 재반환.
2. 주 문서 에이전트 재스폰: `designRevisionTask` — 축별 피드백 파일을 모두 읽고 **하나의 일관된 draft.md**로 재작성.
3. 위성도 **같은 웨이브로 재스폰**: `designSatelliteRevisionTask` — 반려 이슈를 해당 관점에서 자기 `draft.<role>.md`에만 반영 (주 문서를 다시 읽지 않음).
4. 상한(`DEFAULT_MAX_LOOPS`) 소진 시 게이트 에스컬레이션 — 사용자가 근본 재작성 지시·회귀·재협의 중 선택.

## 시나리오 C — Stage 2 필수 그래프 (주 문서 소유 유지)

1. Stage 2(설계) 진입, `def.graph === "required"`.
2. 위성(예: `module-structure`·`data-model`)은 설계 초점 문서만 쓰고 **그래프를 만들지 않는다** — 그래프 어휘(모듈 트리·시퀀스 참여자·노드 id) 분기 방지.
3. 주 문서만 그래프를 `<!-- graph: … -->`로 참조. `checkRequiredGraph`가 주 문서 기준으로 필수 그래프 트리를 검증 — 없으면 feedback 전 재작성 반려(시나리오 B), 상한 소진 시 게이트 에스컬레이션.
4. 승인 시 `promoteGraphTree`가 주 문서의 그래프 트리를 `stage2/`로 승격. 위성 문서는 작업 영역 루트에 남고 승격 제외.

## 시나리오 D — 회귀(롤백) 시 위성 무효화

1. 게이트에서 사용자가 "이전 단계로 회귀"(revert).
2. `invalidateArtifactsAfter(root, feature, stage)`가 `stage` 이후 단계의 주 문서·그래프 트리·`.prev`와 함께 **각 단계의 위성 파일(`draft.<role>.md`)을 삭제** — 역할명은 `designMenuForStage(단계 id)`로 결정론적 도출(스폰 여부 상태 불필요).
3. 유지된 단계의 위성 파일은 보존(잔존해야 함 — 테스트로 검증).

## 시나리오 E — 기본 `low` (회귀 없음)

- `designLevel` 미지정 시 위성 0 — 주 문서 에이전트 단독 스폰, 지시문도 "위성 없음(low)" 문구. 기존 단일 에이전트 동작과 1:1 동일 → 기존 테스트·사용자 흐름 무변경.

## 뷰어 제약 (알려진 한계)

- 현재 뷰어는 단계당 단일 산출물(주 문서)만 표시 — 위성 문서는 미표시. `viewer-state.ts` 읽기 경로에 TODO 주석으로 기록됨(다중 문서 뷰어 구현은 ADR-031 범위 밖).

## 자체검증 매핑

| 시나리오 | 검증 |
| --- | --- |
| A(high 병렬 지시) | `plan-tool.test.ts` "design 위성: high 수준 spawn-design 지시문이 주+위성 병렬 스폰과 파일 경로 명시" |
| A(레벨·메뉴) | `orchestration.test.ts` "designMenuForStage·designLevelCountSpec·designLevel/메뉴 경로 전달" |
| B(위성 재작성 과제) | `df-task.ts` `designSatelliteTask`/`designSatelliteRevisionTask` |
| D(위성 무효화) | `engine.test.ts` "invalidateArtifactsAfter: 위성 design 문서도 함께 삭제" |
| E(low 기본) | 기존 plan-tool/engine 테스트 전체 무변경 통과 |
| 파일 생성 | 헤드리스 스모크: `draft.md` + 위성 2개 실생성 확인 (라이브 게이트 확정은 수동) |

## 참고

- [[ADR-031-parallel-design-satellites]] · [[02-scenarios]] · [[ADR-014-dynamic-feedback-agents]] · [[ADR-017-feedback-levels]]
