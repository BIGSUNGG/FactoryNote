// M1 Stage Registry + M3 state 스키마. vault/03-design/workflow-core 기반.
// 단계 정의 본체는 protocol/stages/ 마크다운(데이터) — 이 파일은 코드 투영.

/** 6단계 파이프라인. */
export type StageId = 1 | 2 | 3 | 4 | 5 | 6;

/** Stage UI 포맷 (ADR-003 뷰어 매핑). */
export type ArtifactFormat = "markdown" | "nodes-edges" | "matrix";

/** Stage 정의 (M1). */
export interface StageDefinition {
	readonly id: StageId;
	readonly name: string;
	readonly artifact: string;
	readonly format: ArtifactFormat;
}

/** 게이트 판정 — AI(Feedback 포함)는 통과시킬 수 없다 (5대 원칙). */
export type GateVerdict = "confirm" | "modify" | "revert";

/** 회귀 이력 항목 (M3 감사 로그). */
export interface RegressionEntry {
	readonly from: StageId;
	readonly to: StageId;
	readonly reason: string;
	readonly at: string;
}

/** `.factorynote/state.json` 스키마 (M3). */
export interface PipelineState {
	readonly feature: string;
	currentStage: StageId;
	loopCount: number;
	verdicts: Partial<Record<StageId, GateVerdict>>;
	regressions: RegressionEntry[];
	updatedAt: string;
}
