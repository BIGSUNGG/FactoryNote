// Engine — 파이프라인 상태기계(순수 함수). 판정의 통제 흐름 + 게이트 전이.
// 산출물 '내용' 판단은 LLM(Design/Feedback 역할)이 담당하고, 여기는 제어·전이만.
// Tier 0: Design↔Feedback 내부 루프는 1패스 자기검토로 단순화(MVP).
import type {
	GateDecision,
	GateVerdict,
	PipelineState,
	StageId,
} from "./types.ts";
import { STAGES } from "./stages.ts";

export function initialState(feature: string, now = Date.now()): PipelineState {
	return {
		feature,
		stage: 1,
		gateOpen: false,
		loopCount: 0,
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

/**
 * 사용자 게이트 판정 적용.
 * - confirm: 다음 단계(Stage 6 confirm → done).
 * - modify: 현 단계 재작성(gate 닫힘, loopCount 증가, 코멘트는 호출자가 에이전트에 전달).
 * - revert: 이전 단계 회귀(Stage 1에서는 no-op).
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
		const prev = Math.max(1, state.stage - 1) as StageId;
		return {
			...withHistory,
			stage: prev,
			gateOpen: false,
			loopCount: 0,
			updatedAt: now,
		};
	}

	// confirm
	if (state.stage >= 6) {
		return {
			...withHistory,
			stage: 6,
			gateOpen: false,
			done: true,
			updatedAt: now,
		};
	}
	const next = (state.stage + 1) as StageId;
	return {
		...withHistory,
		stage: next,
		gateOpen: false,
		loopCount: 0,
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
