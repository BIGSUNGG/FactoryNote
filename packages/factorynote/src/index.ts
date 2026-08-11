// @factorynote/core entry point (barrel).
// M3 Persistence · M1 Stage Registry · Engine(상태기계). harness-agnostic(Layer 1-2).
export type {
	ArtifactFormat,
	AgentRole,
	AgentSpawn,
	ArtifactPaths,
	ChatMessage,
	ChildToolBudget,
	ChildTurnBudget,
	Comment,
	DesignFeedbackDirective,
	DesignFeedbackPhase,
	FeedbackAxis,
	FeedbackAxisOutcome,
	FeedbackLevel,
	FeedbackOutcome,
	GateDecision,
	GateVerdict,
	GraphFileNode,
	GraphLevel,
	GraphLevelFile,
	GraphRef,
	GraphTreeNode,
	HistoryEntry,
	PipelineState,
	SpawnOptions,
	StageId,
	ValidThrough,
} from "./types/index.ts";
export { STAGES, currentStageDef, stageById } from "./stages.ts";
export type { StageDefinition } from "./stages.ts";
export {
	FEEDBACK_AGENTS,
	FEEDBACK_TOOLS,
	feedbackMenuForStage,
} from "./feedback-agents.ts";
export type {
	FeedbackAgent,
	FeedbackCapability,
} from "./feedback-agents.ts";
export {
	atLoopCeiling,
	applyVerdict,
	initialState,
	isComplete,
	MAX_LOOPS,
	markArtifactReady,
	nextStageId,
	requiresArtifact,
} from "./engine.ts";
export {
	artifactPath,
	featureDir,
	invalidateArtifactsAfter,
	loadState,
	promoteGraphTree,
	readArtifact,
	saveState,
	statePath,
	writeArtifact,
} from "./persistence.ts";
export {
	collectGraphChildFiles,
	coerceGraphLevelFile,
	graphDirNameFor,
	graphJsonNameFor,
	graphRefFile,
	GRAPH_REF_RE,
	isSafeChildPath,
	loadGraphTree,
	parseGraphLevelFile,
} from "./graph.ts";
export {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_FEEDBACK_LEVEL,
	DEFAULT_MAX_LOOPS,
	FEEDBACK_LEVELS,
	MAX_REPORT_INPUT_CHARS,
	aggregateFeedback,
	clampReportInput,
	designTask,
	feedbackAgentTask,
	feedbackLevelCountSpec,
	nextDesignFeedbackStep,
	parseFeedback,
	runDesignFeedbackLoop,
} from "./orchestration.ts";
export type {
	DesignFeedbackReport,
	DesignFeedbackTransition,
} from "./orchestration.ts";
