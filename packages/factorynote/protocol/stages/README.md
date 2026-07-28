# M1 Stage Registry (Protocol)

읽기 전용 데이터. 6단계의 이름·산출물·포맷·Design 프롬프트·Feedback 검증 기준을 정의한다.
코드 투영은 `src/types.ts` (`StageDefinition`). 근거: [[vault/03-design/workflow-core/03-module-architecture]].

| Stage | 단계 | 산출물 | 포맷 (ADR-003) |
| ----- | ---- | ------ | -------------- |
| 1 | 요청 이해 | 요구사항 명세 | markdown |
| 2 | 정상 동작 시나리오 | 시나리오 명세 | markdown |
| 3 | 모듈 아키텍처 | 모듈 구조도 | nodes-edges |
| 4 | 클래스 구조 | 클래스 명세 | nodes-edges |
| 5 | 구현 계획 | 구현 순서·의존성 | markdown |
| 6 | 사용자 최종 검증 | (산출물 없음 — 총괄 정합 매트릭스) | matrix |

> Stage 6은 산출물을 새로 만들지 않는다. 1-5 간 정합성을 검증하고 전체 Plan을 사용자에게 제시한다.
> 게이트 원칙(5대 원칙 1-5)은 각 Stage 경계를 가른다.
