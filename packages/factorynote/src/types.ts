// FactoryNote core types. Harness-agnostic (no pi, no LLM) — Layer 1-2.

/** 3단계 파이프라인 단계 식별자. */
export type StageId = 1 | 2 | 3;

/** FR-7: 0..3. validThrough = 해당 단계까지 산출물이 승인됨(0=아직 승인된 산출물 없음). */
export type ValidThrough = 0 | StageId;

/** 산출물 포맷(ADR-003). Stage 2 도 마크다운 단일진실로 통일(F2). */
export type ArtifactFormat = "markdown";

/** 사용자 게이트 판정. confirm=다음 단계, modify=현 단계 재작성, revert=이전 단계 회귀. */
export type GateVerdict = "confirm" | "modify" | "revert";

/** 뷰어에서 수집된 코멘트(수정 지시). 블록/셀/드래그 영역 공통. */
export interface Comment {
	blockId?: string;
	/** 드래그 영역 코멘트의 인용 텍스트. */
	quote?: string;
	text: string;
}

/** 게이트 열린 동안의 실시간 에이전트 채팅 메시지. 사용자 질문/수정요청 ↔ 에이전트 답변. */
export interface ChatMessage {
	id: string;
	role: "user" | "agent";
	text: string;
	/** 부분 코멘트: 대상 블록(미지정 시 전체 산출물에 대한 질문). */
	blockId?: string;
	/** 드래그 영역 코멘트의 선택 텍스트(인용). */
	quote?: string;
	at: number;
}

// --- 그래프 에디터(Stage 2 모듈·클래스) 데이터 모델 ---
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

/** 그래프 산출물 전체. F2 부터 Stage 2 md 의 ```factorynote-graph 펜스 안 JSON 으로 직렬화된다. */
export interface GraphArtifact {
	sections: GraphSection[];
}

/** 사용자 게이트에서 뷰어가 반환하는 결정. */
export interface GateDecision {
	verdict: GateVerdict;
	comments: Comment[];
	/** Stage 2(설계)에서 사용자가 직접 편집한 마크다운 산출물. 직접 펭집 → 에이전트가 채택해 저장(5대 원칙 — 게이트 거쳐 채택). */
	artifactMd?: string;
	/** FR-7: 회귀 대상 단계(1..3). 생략 시 종래대로 1단계 회귀. 현재 단계보다 앞으로만(엔진이 clamp). */
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
	/** 파이프라인 완료(Stage 3 confirm) 여부. */
	done: boolean;
	history: HistoryEntry[];
	createdAt: number;
	updatedAt: number;
}
