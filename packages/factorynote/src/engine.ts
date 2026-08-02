// Engine — 파이프라인 상태기계(순수 함수). 판정의 통제 흐름 + 게이트 전이.
// 산출물 '내용' 판단은 LLM(Design/Feedback 역할)이 담당하고, 여기는 제어·전이만.
// Tier 0: Design↔Feedback 내부 루프는 1패스 자기검토로 단순화(MVP).
import type {
	GateDecision,
	GateVerdict,
	PipelineState,
	StageId,
	ValidThrough,
} from "./types.ts";
import { STAGES } from "./stages.ts";

/** FR-2: 단계별 Design↔Feedback 루프 반복 상한(기본값). 상한 도달 시 게이트 에스컬레이션. */
export const MAX_LOOPS = 3;

/**
 * FR-2: loopCount 가 상한 도달 여부. 엔진은 순수함수(판정만);
 * 에스컬레이션(게이트 오픈·사용자 메시지)은 어댑터가 이 값을 보고 결정.
 */
export function atLoopCeiling(state: PipelineState, max = MAX_LOOPS): boolean {
	return state.loopCount >= max;
}

export function initialState(feature: string, now = Date.now()): PipelineState {
	return {
		feature,
		stage: 1,
		gateOpen: false,
		loopCount: 0,
		validThrough: 0,
		done: false,
		history: [],
		createdAt: now,
		updatedAt: now,
	};
}

/** 현 단계가 산출물을 생성하는가(Stage 6은 제외). */
export function requiresArtifact(stage: StageId): boolean {
	const def = STAGES[stage - 1];
	return def ? def.producesArtifact : false;
}

/** Design 역할이 산출물을 완성해 사용자 게이트를 열 준비가 됨. */
export function markArtifactReady(
	state: PipelineState,
	now = Date.now(),
): PipelineState {
	return { ...state, gateOpen: true, updatedAt: now };
}

function record(
	state: PipelineState,
	verdict: GateVerdict,
	now: number,
): PipelineState {
	return {
		...state,
		history: [...state.history, { stage: state.stage, verdict, at: now }],
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/**
 * 사용자 게이트 판정 적용.
 * - confirm: 다음 단계(Stage 6 confirm → done). validThrough = max(기존, 승인된 단계).
 * - modify: 현 단계 재작성(gate 닫힘, loopCount 증가; validThrough 불변).
 * - revert: 회귀 — revertTo(생략 시 1단계) 로 점프. clamp 상한 = stage-1(앞으로만).
 *   validThrough = target-1(target 단계 산출물부터 무효). Stage 1에서는 no-op.
 */
export function applyVerdict(
	state: PipelineState,
	decision: GateDecision,
	now = Date.now(),
): PipelineState {
	const { verdict } = decision;
	const withHistory = record(state, verdict, now);

	if (verdict === "modify") {
		return {
			...withHistory,
			gateOpen: false,
			loopCount: state.loopCount + 1,
			updatedAt: now,
		};
	}

	if (verdict === "revert") {
		// FR-7: 여러 단계 점프 회귀. 현재 단계보다 앞으로만(clamp 상한 = stage-1).
		const target = clamp(
			decision.revertTo ?? state.stage - 1,
			1,
			state.stage - 1,
		) as StageId;
		return {
			...withHistory,
			stage: target,
			gateOpen: false,
			loopCount: 0,
			validThrough: (target - 1) as ValidThrough,
			updatedAt: now,
		};
	}

	// confirm: 한 단계 승인 = 그 단계까지 유효.
	const confirmedValid = Math.max(
		state.validThrough,
		state.stage,
	) as ValidThrough;
	if (state.stage >= 6) {
		return {
			...withHistory,
			stage: 6,
			gateOpen: false,
			done: true,
			validThrough: confirmedValid,
			updatedAt: now,
		};
	}
	const next = (state.stage + 1) as StageId;
	return {
		...withHistory,
		stage: next,
		gateOpen: false,
		loopCount: 0,
		validThrough: confirmedValid,
		updatedAt: now,
	};
}

/** 파이프라인 완료(Stage 6 confirm). */
export function isComplete(state: PipelineState): boolean {
	return state.done;
}

/** 다음 단계 예상(안내용). */
export function nextStageId(stage: StageId): StageId | null {
	return stage >= 6 ? null : ((stage + 1) as StageId);
}
