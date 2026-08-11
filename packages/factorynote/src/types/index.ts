// FactoryNote core types — 도메인별 barrel. harness-agnostic(Layer 1-2).
export type {
	ArtifactFormat,
	ChatMessage,
	Comment,
	GateDecision,
	GateVerdict,
	HistoryEntry,
	StageId,
	ValidThrough,
} from "./gate.ts";
export type {
	AgentRole,
	AgentSpawn,
	ArtifactPaths,
	ChildToolBudget,
	ChildTurnBudget,
	DesignFeedbackDirective,
	DesignFeedbackPhase,
	FeedbackAxis,
	FeedbackAxisOutcome,
	FeedbackLevel,
	FeedbackOutcome,
	SpawnOptions,
} from "./feedback.ts";
export type {
	GraphFileNode,
	GraphLevel,
	GraphLevelFile,
	GraphRef,
	GraphTreeNode,
} from "./graph.ts";
export type { PipelineState } from "./pipeline.ts";
