// @factorynote/core entry point (barrel).
// M3 Persistence · M1 Stage Registry · Engine(상태기계). harness-agnostic(Layer 1-2).
export type {
	ArtifactFormat,
	Comment,
	GateDecision,
	GateVerdict,
	GraphArtifact,
	GraphEdge,
	GraphNode,
	GraphSection,
	HistoryEntry,
	PipelineState,
	StageId,
} from "./types.ts";
export { STAGES, currentStageDef, stageById } from "./stages.ts";
export type { StageDefinition } from "./stages.ts";
export {
	applyVerdict,
	initialState,
	isComplete,
	markArtifactReady,
	nextStageId,
	requiresArtifact,
} from "./engine.ts";
export {
	artifactPath,
	featureDir,
	loadState,
	readArtifact,
	saveState,
	statePath,
	writeArtifact,
} from "./persistence.ts";
export {
	coerceGraphArtifact,
	emptyGraphArtifact,
	parseGraphArtifact,
} from "./graph.ts";
