// drivePlan 공유 타입 — 어댑터 계층 계약(파이프라인 입력/출력).
import type {
	ChatMessage,
	FeedbackLevel,
	GateDecision,
	PipelineState,
	SpawnOptions,
} from "@factorynote/core";

export interface DrivePlanInput {
	root: string;
	viewerDistDir: string;
	feature: string;
	designArtifact?: string;
	feedbackResult?: string;
	chatResponse?: string;
	/** Feedback 수준(ADR-017). 미지정 시 DEFAULT_FEEDBACK_LEVEL(medium). */
	feedbackLevel?: FeedbackLevel;
	autoAdvance?: boolean;
	signal?: AbortSignal;
	open?: boolean;
	onReady?: (url: string) => void | Promise<void>;
}

export type NextAction = "spawn-design" | "spawn-feedback" | "done";

export interface DrivePlanOutput {
	done: boolean;
	stage: number;
	stageName: string;
	nextAction: NextAction;
	spawnRole?: "design" | "feedback";
	spawnTask?: string;
	spawnOptions?: SpawnOptions;
	draftPath?: string;
	feedbackPath?: string;
	/** 현 단계 feedback 메뉴 파일 경로(Director 동적 선택용). */
	menuPath?: string;
	/** 현 Feedback 수준(ADR-017) — spawn-feedback 일 때 에이전트 수 결정 기준. */
	feedbackLevel?: FeedbackLevel;
	dfLoop: number;
	designPrompt: string;
	gateResult: GateDecision | null;
	message: string;
	gateUrl?: string;
	chatPending?: ChatMessage[];
}

/** 파이프라인 상태 중 drivePlan 이 사용하는 일부(전이 함수 인자). */
export type DfStateSlice = Pick<PipelineState, "dfPhase" | "dfLoop">;
