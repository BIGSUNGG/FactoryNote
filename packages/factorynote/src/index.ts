// @factorynote/core entry point (barrel).
// M3 Persistence · M1 Stage Registry · Engine(상태기계). harness-agnostic(Layer 1-2).
export type {
	ArtifactFormat,
	AgentRole,
	AgentSpawn,
	ArtifactPaths,
	ChatMessage,
	Comment,
	DesignFeedbackDirective,
	DesignFeedbackPhase,
	FeedbackOutcome,
	GateDecision,
	GateVerdict,
	GraphArtifact,
	GraphEdge,
	GraphNode,
	GraphSection,
	HistoryEntry,
	PipelineState,
	SpawnOptions,
	StageId,
	ValidThrough,
} from "./types.ts";
export { STAGES, currentStageDef, stageById } from "./stages.ts";
export type { StageDefinition } from "./stages.ts";
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
	readArtifact,
	saveState,
	statePath,
	writeArtifact,
} from "./persistence.ts";
export {
	applyStructureToMarkdown,
	coerceGraphArtifact,
	emptyGraphArtifact,
	parseDesignMarkdown,
	parseGraphArtifact,
	serializeDesignMarkdown,
} from "./graph.ts";
export type { DesignMarkdown } from "./graph.ts";
export {
	CHILD_SPAWN_OPTIONS,
	MAX_DESIGN_FEEDBACK_LOOPS,
	designTask,
	feedbackTask,
	nextDesignFeedbackStep,
	parseFeedback,
	runDesignFeedbackLoop,
} from "./orchestration.ts";
export type {
	DesignFeedbackReport,
	DesignFeedbackTransition,
} from "./orchestration.ts";
