// FactoryNote core types. Harness-agnostic (no pi, no LLM) — Layer 1-2.

/** 6단계 파이프라인 단계 식별자. */
export type StageId = 1 | 2 | 3 | 4 | 5 | 6;

/** FR-7: 0..6. validThrough = 해당 단계까지 산출물이 승인됨(0=아직 승인된 산출물 없음). */
export type ValidThrough = 0 | StageId;

/** 산출물 포맷(ADR-003). MVP는 모든 단계를 마크다운으로 렌더한다. */
export type ArtifactFormat = "markdown" | "nodes-edges" | "matrix";

/** 사용자 게이트 판정. confirm=다음 단계, modify=현 단계 재작성, revert=이전 단계 회귀. */
export type GateVerdict = "confirm" | "modify" | "revert";

/** 뷰어에서 수집된 코멘트(수정 지시). 블록/셀/드래그 영역 공통. */
export interface Comment {
	blockId?: string;
	/** 드래그 영역 코멘트의 인용 텍스트. */
	quote?: string;
	text: string;
}

// --- 그래프 에디터(Stage 3 모듈 / Stage 4 클래스) 데이터 모델 ---
// 코어는 envelope(sections) 만 다루고 노드/엣지 내부는 불투명(react-flow 호환 필드를 그대로 담는다).
/** 그래프 노드(react-flow Node 호환 필드를 자유롭게 포함). */
export type GraphNode = Record<string, unknown>;
/** 그래프 엣지(react-flow Edge 호환 필드를 자유롭게 포함). */
export type GraphEdge = Record<string, unknown>;

/** 관계도 섹션 — 한 단계 내의 독립 그래프(예: 프론트엔드/백엔드/인터). */
export interface GraphSection {
	id: string;
	title: string;
	nodes: GraphNode[];
	edges: GraphEdge[];
}

/** 그래프 산출물 전체(=.json 파일 내용). Stage 3/4 산출물 포맷. */
export interface GraphArtifact {
	sections: GraphSection[];
}

/** 사용자 게이트에서 뷰어가 반환하는 결정. */
export interface GateDecision {
	verdict: GateVerdict;
	comments: Comment[];
	/** 그래프 단계(Stage 3/4)에서 사용자가 편집한 그래프. 직접 편집 → 에이전트가 채택해 산출물로 저장. */
	graphSections?: GraphSection[];
	/** FR-7: 회귀 대상 단계(1..6). 생략 시 종래대로 1단계 회귀. 현재 단계보다 앞으로만(엔진이 clamp). */
	revertTo?: StageId;
}

/** 게이트 통과 이력(NFR-3 감사). */
export interface HistoryEntry {
	stage: StageId;
	verdict: GateVerdict;
	at: number;
}

/** 파이프라인 영속 상태. `.factorynote/<feature>/state.json`에 저장. */
export interface PipelineState {
	feature: string;
	stage: StageId;
	/** 현재 단계 산출물이 사용자 검토 대기 중인지. */
	gateOpen: boolean;
	/** 현 단계 Design 시도 횟수(modify 시 증가). */
	loopCount: number;
	/** FR-7: 해당 단계까지 산출물 유효(0=미승인). confirm→증가, revert→감소, modify→불변. */
	validThrough: ValidThrough;
	/** 파이프라인 완료(Stage 6 confirm) 여부. */
	done: boolean;
	history: HistoryEntry[];
	createdAt: number;
	updatedAt: number;
}
