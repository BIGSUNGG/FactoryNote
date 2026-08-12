---
status: accepted
updated: 2026-08-12
tags: [adr, graph, stage-2, orchestration, validation]
---

# ADR-019: Stage 2 그래프 필수 + 단계별 스폰 명령 분기

## 상태

accepted ([[ADR-018-hierarchical-graph-tree]] 후속 — 계층 그래프 트리 규약은 승계하고, Stage 2에서 작성 의무를 코드로 강제)

## 날짜

2026-08-12

## 맥락 (Context)

ADR-018 이후 Stage 2 designPrompt는 계층 그래프 트리(루트 json + 자식 파일 서브디렉터리)를 요구하지만, 이는 프롬프트 문구일 뿐이었다. 세 가지 문제가 있었다.

1. **강제 수단 부재** — Design 자식이 그래프를 빼고 md만 넘겨도 파이프라인은 Feedback·게이트로 그대로 진행됐다. 그래프 없는 설계가 승인되면 뷰어의 드릴다운 검토가 무의미해진다.
2. **전 단계 동일 스폰 명령** — `designTask`가 1·2·3단계 공통 문구("지시에 그래프 작성이 포함되면…")를 사용해, 단계별 그래프 의무(없음·필수·선택)가 자식 과제에 드러나지 않았다.
3. **검증 시점 부재** — 그래프 유무를 확인할 코드가 없어 불량 그래프(참조 누락·파일 없음·envelope 위반)가 게이트까지 가서야 드러났다.

사용자 요구: "2단계에서 그래프를 필수로 생성하게 해줘. 이를 위해 1·2·3 단계별로 다른 명령을 실행해줘."

## 결정 (Decision)

1. **단계별 그래프 의무 필드** — `StageDefinition.graph: "none" | "optional" | "required"`. Stage 1 = `none`(언급 없음), Stage 2 = `required`, Stage 3 = `optional`(선택). 데이터가 스폰 명령과 검증을 분기한다.
2. **단계별 스폰 명령** — `designTask`·`designRevisionTask`(core `df-task.ts`)가 `def.graph`로 문구를 분기한다. required는 "계층 그래프 파일 트리는 **필수**… 없거나 불량하면 자동 반려"를, optional은 선택 규약을, none은 그래프 언급 없이 과제를 구성한다.
3. **코드 강제(검증)** — `checkRequiredGraph(root, feature, mdFile)`(core `artifact.ts`): md의 `<!-- graph: ... -->` 참조 코멘트 존재 → 참조 루트 json 존재 → `version:2` envelope 파싱. 미충족 시 이슈 문자열 반환.
4. **검증 시점 = Feedback 전** — `drivePlan`(pi 어댑터)이 design 보고 시 `def.graph === "required"`면 검증한다. 미충족이고 `dfLoop < DEFAULT_MAX_LOOPS`면 재작성 지시(`designRevisionTask`에 이슈 주입, dfLoop+1)로 Feedback 자식 스폰을 막고, 상한 소진 시 게이트 에스컬레이션(Feedback 미수렴과 동일 기제)으로 사용자 판단에 맡긴다.
5. **재시도 상한** — 별도 카운터 없이 내부 사이클 상한(`DEFAULT_MAX_LOOPS`)을 공유한다. 무한 재시도 불가.

## 이유 (Rationale)

- 프롬프트 요청만으로는 "필수"가 아니다. 기계적 검증 + 반려가 유일한 보증이다(5대 원칙의 게이트 정신 — 검증 안 된 산출물은 진행 불가).
- 검증이 Feedback **앞**에 있으면 불량 그래프 한 번에 Feedback 자식 N개 스폰 비용이 날아간다. 가장 싼 시점에서 거른다.
- dfLoop 공유는 새 상태 필드 없이 기존 상한·에스컬레이션 기제를 재사용한다(ponytail). 그래프 실패 1회가 Feedback 재검토 기회를 소진하는 것은 `DEFAULT_MAX_LOOPS=1`의 기존 "1회 수정 후 게이트" 의미와 동일하다.

## 대안 (Alternatives)

- **프롬프트 문구 강화만** — 배제. 준수 보장이 없어 같은 실패가 반복된다.
- **게이트 승인 시 검증(승인 거부)** — 배제. 사용자가 이미 검토한 뒤에 반려하면 피드백이 늦고, Feedback 자식들이 그래프 없는 초안을 검토하는 낭비가 남는다.
- **그래프 전용 재시도 카운터(별도 상태 필드)** — 배제. 상한 하나 더 늘리는 것만으로 dfLoop 공유로 충분히 유한하다.

## 결과 (Consequences)

- Stage 2 Design 자식은 그래프 없이는 Feedback·게이트에 도달할 수 없다.
- 단계별 스폰 명령이 달라져 자식 과제가 단계 의무를 명시한다.
- `stageById` 등 기존 호출측 변경 없음(필드 추가만). Stage 3 선택 그래프·Stage 1 무그래프 동작 불변.
