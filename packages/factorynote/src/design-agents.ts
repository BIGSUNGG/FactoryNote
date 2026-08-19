// 위성 design 에이전트 정의 — 전역 레지스트리(단일 진실). ADR-031.
// Director 가 매 사이클마다 현 단계 메뉴를 읽고 designLevel 에 따라 N개를 추려
// feedback 과 동일하게 병렬(runs.all) 스폰한다. 각 위성은 자기 파일
// draft.<name>.md 만 쓴다(주 문서에 병합·그래프 작성 금지 — ADR-031).
// 주 문서(draft.md) 는 기존 factorynote-design 에이전트가 담당(레벨 무관 항상 1기).
// 이 파일이 레지스트리 단일 진실; apps/pi-extension/agents/factorynote-design-<name>.md 는 생성기 산출물.
import type { DesignAgent, StageId } from "./types/index.ts";

export type { DesignAgent } from "./types/index.ts";

/** 전문 위성 design 에이전트 전체 목록(9개 — 단계별 3역할). */
export const DESIGN_AGENTS: readonly DesignAgent[] = [
	// Stage 1 — 요구사항·시나리오 명세
	{
		name: "requirements-scope",
		focus: "요구사항 분해 · 범위 경계 · 제약·가정",
		stages: [1],
	},
	{
		name: "scenario-acceptance",
		focus: "동작 시나리오 · 수용 조건 · 시나리오↔요구사항 연결",
		stages: [1],
	},
	{
		name: "nonfunctional-constraints",
		focus: "비기능 요구사항 · 성능·보안·확장성 제약",
		stages: [1],
	},
	// Stage 2 — 설계(모듈·클래스)
	{
		name: "module-structure",
		focus: "모듈 분해 · 모듈 의존성 · 계층 경계",
		stages: [2],
	},
	{
		name: "data-model",
		focus: "데이터 모델 · 엔티티·속성·관계 · 저장 흐름",
		stages: [2],
	},
	{
		name: "behavior-flows",
		focus: "핵심 동작 흐름 · 유스케이스별 처리 경로",
		stages: [2],
	},
	// Stage 3 — 구현 계획
	{
		name: "work-breakdown",
		focus: "구현 순서 · 작업 분해 · 마일스톤",
		stages: [3],
	},
	{
		name: "risk-effort",
		focus: "리스크 · 난이도·노력 추정 · 일정 의존성",
		stages: [3],
	},
	{
		name: "verification-plan",
		focus: "검증·테스트 계획 · 수용 조건 매핑",
		stages: [3],
	},
];

/** 단계 필터 메뉴 — Director 가 여기서 designLevel 수만큼 위성을 추려 병렬 스폰. */
export function designMenuForStage(stage: StageId): DesignAgent[] {
	return DESIGN_AGENTS.filter((a) => a.stages.includes(stage));
}
