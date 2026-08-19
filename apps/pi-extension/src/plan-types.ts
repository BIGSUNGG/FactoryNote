// drivePlan 공유 타입 — 어댑터 계층 계약(파이프라인 입력/출력).
import type {
	ChatMessage,
	DesignLevel,
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
	/** 신규 파이프라인 구성 — 스테이지 종류 순서 목록(첫 호출에서만 적용). */
	stages?: readonly string[];
	/** 최대 스테이지 개수 상한(사용자 지정). 구성 길이가 초과하면 잘라서 적용. */
	maxStages?: number;
	/** Feedback 수준(ADR-017). 미지정 시 DEFAULT_FEEDBACK_LEVEL(medium). */
	feedbackLevel?: FeedbackLevel;
	/** Design 위성 수준(ADR-031). 미지정 시 DEFAULT_DESIGN_LEVEL(low — 주 문서만). */
	designLevel?: DesignLevel;
	autoAdvance?: boolean;
	signal?: AbortSignal;
	open?: boolean;
	onReady?: (url: string) => void | Promise<void>;
}

export type NextAction = "compose" | "spawn-design" | "spawn-feedback" | "done";

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
	/** 현 단계 design 메뉴 파일 경로(Director 가 designLevel 에 따라 위성 선택, ADR-031). */
	designMenuPath?: string;
	/** 현 Design 위성 수준(ADR-031) — spawn-design 일 때 위성 수 결정 기준. */
	designLevel?: DesignLevel;
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
