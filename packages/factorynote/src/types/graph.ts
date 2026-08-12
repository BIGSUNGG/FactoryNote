// 그래프(계층 트리) 데이터 모델(ADR-018).
// 그래프는 산출물 md 옆 계층 파일 트리: 루트 <산출물>-graph.json +
// <산출물>-graph/ 서브디렉터리에 자식이 있는 노드마다 파일 1개(임의 깊이).
// 관계는 나가는 참조(refs {to, comment})만 소스 노드 파일에 작성 — 단방향 한쪽, 양방향 양쪽.
// 코어는 envelope(version/nodes/refs/children 경로) 만 보증하고 노드 표시 필드는 불투명.
// position 등 좌표 필드 금지 — 뷰어 자동 배치(ADR-016 원칙 승계).

/** 나가는 참조 — 소스 노드 파일에만 작성. 단방향=한쪽만, 양방향=양쪽 파일에 각각. */
export interface GraphRef {
	to: string;
	/** 관계 설명 코멘트(필수). */
	comment: string;
}

/** 레벨 파일 안의 노드 — `children` 은 자식 레벨 파일 경로(문자열). */
export interface GraphFileNode {
	id: string;
	refs?: GraphRef[];
	/** 자식 레벨 파일 경로(루트 디렉터리 기준 상대경로). 자식이 있을 때만 존재. */
	children?: string;
	[k: string]: unknown;
}

/** 그래프 레벨 파일 1개(루트 또는 자식 파일). */
export interface GraphLevelFile {
	/** 트리 프로토콜 버전 — 현재 2. */
	version: 2;
	/** 이 레벨이 펼치는 부모 노드 id(루트는 생략). */
	id?: string;
	/** 레벨 제목(뷰어 표시용). */
	title?: string;
	/** 다음 레벨 이름(예: "modules"/"classes"/"methods"). */
	childLevel?: string;
	nodes: GraphFileNode[];
}

/** 조립된 트리 노드 — `children` 은 중첩 레벨(없음/읽기 실패 시 생략). */
export interface GraphTreeNode extends Omit<GraphFileNode, "children"> {
	children?: GraphLevel;
}

/** 조립된 그래프 트리 레벨 — 게이트 서버가 중첩으로 뷰어에 서빙한다. */
export interface GraphLevel {
	/** 루트 파일 기준 상대경로(루트에겐 루트 파일명). */
	file: string;
	/** 부모 노드 id(루트는 생략). */
	parentId?: string;
	title?: string;
	childLevel?: string;
	nodes: GraphTreeNode[];
}

// --- Sequence 다이어그램(ADR-021): 단일 파일, 참여자 + 시간축 메시지/fragment. ---

/** 시퀀스 참여자(컬럼). */
export interface GraphSequenceParticipant {
	id: string;
	[k: string]: unknown;
}

/** 시퀀스 메시지 — kind 생략 시 call. */
export interface GraphSequenceMessage {
	from: string;
	to: string;
	label: string;
	kind?: "call" | "reply";
	[k: string]: unknown;
}

/** 시퀀스 fragment — alt/loop/opt 구간, body 에 메시지·중첩 fragment(임의 깊이). */
export interface GraphSequenceFragment {
	kind: "alt" | "loop" | "opt";
	label?: string;
	body: GraphSequenceItem[];
	[k: string]: unknown;
}

export type GraphSequenceItem = GraphSequenceMessage | GraphSequenceFragment;

/** 시퀀스 그래프 파일 envelope. */
export interface GraphSequenceFile {
	version: 2;
	type: "sequence";
	id?: string;
	title?: string;
	participants: GraphSequenceParticipant[];
	body: GraphSequenceItem[];
}

// --- Flowchart(ADR-021): 단일 파일, 노드 + 엣지, 뷰어 자동 배치. ---

/** 플로우차트 노드 모양 — 생략 시 process. */
export type GraphFlowchartShape = "terminal" | "process" | "decision";

export interface GraphFlowchartNode {
	id: string;
	label: string;
	shape?: GraphFlowchartShape;
	[k: string]: unknown;
}

export interface GraphFlowchartEdge {
	from: string;
	to: string;
	label?: string;
	[k: string]: unknown;
}

/** 플로우차트 그래프 파일 envelope. */
export interface GraphFlowchartFile {
	version: 2;
	type: "flowchart";
	id?: string;
	title?: string;
	nodes: GraphFlowchartNode[];
	edges: GraphFlowchartEdge[];
}

/** 그래프 파일 종류 판별 — type 필드 없음 = 계층 트리(ADR-018 하위 호환). */
export type GraphKind = "tree" | "sequence" | "flowchart";
