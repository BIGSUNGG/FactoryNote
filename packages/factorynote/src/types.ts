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

// --- M4/Tier 1 에이전트 오케스트레이션(Design↔Feedback 내부 루프) ---
// vault/01-architecture/multi-agent-pipeline · ADR(Tier 1) 근거.
// Tier 0(단일 에이전트 인라인 자기검토)는 폐기. 이제 산출물은 항상
// Design 자식 → Feedback 자식 루프를 거쳐 사용자 게이트로 간다.

/** 스폰 역할(M4 AgentSpawn). */
export type AgentRole = "design" | "feedback";

/** 내부 Design↔Feedback 루프 위치(게이트 전). */
export type DesignFeedbackPhase = "design" | "feedback";

/** 자식 스폰 툴 호출 카운트 예산 — pi-subagents toolBudget(hard 필수, hard≥1) 에 매핑.
 *  hard 초과 후 남은 도구(기본 read/grep/find/ls) 차단 → 자식 종료 유도.
 *  주: 이것은 호출 '횟수' 상한이지, 시스템 프롬프트에서 도구를 빼는 기능이 아니다(ADR-012). */
export interface ChildToolBudget {
	readonly hard: number;
	readonly soft?: number;
}

/** 자식 스폰 턴 상한 — pi-subagents turnBudget 에 매핑. maxTurns 도달 시 wrap-up, graceTurns 후 중단. */
export interface ChildTurnBudget {
	readonly maxTurns: number;
	readonly graceTurns?: number;
}

/**
 * 자식 스폰 컨텍스트 제약(GLM-5.2 한도·1261 관리) — core 가 정책 소유.
 * pi 어댑터가 이 값을 subagent 도구의 agent/skill/context/toolBudget/turnBudget 파라미터로
 * 매핑해 Director 에게 전달한다.
 *
 * 도구 제거(시스템 프롬프트 고정 세금 절감)는 SpawnOptions 가 아니라 **명명 에이전트의
 * `tools:` allowlist**(에이전트 정의 파일)가 담당한다. 이전 toolBudgetBlock 은 프롬프트에서
 * 도구를 빼지 못해(런타임 카운트 게이트일 뿐, hard 누락으로 무효) 1261 방어에 실패했다 —
 * 도구 allowlist 로 대체(ADR-012). SpawnOptions 는 (a) 스폰할 명명 에이전트,
 * (b) 호출/턴 카운트 상한만 정책 소유한다.
 */
export interface SpawnOptions {
	readonly skill: false;
	readonly context: "fresh";
	/** 스폰할 명명 에이전트(tools allowlist·context·skill 은 에이전트 정의에 고정). */
	readonly agentName: string;
	/** 툴 호출 카운트 상한(hard 필수, hard≥1). */
	readonly toolBudget: ChildToolBudget;
	/** 어시스턴트 턴 상한. 과도 reasoning/파일 읽기로 컨텍스트 팽창 시 강제 종료. */
	readonly turnBudget: ChildTurnBudget;
}

/**
 * 파일 경로 기반 산출물 교환 — Director(영구 에이전트) 컨텍스트 누적 차단.
 * designPrompt(stage 불변)·draft·feedback 상세리뷰 모두 파일로 영속;
 * spawnTask 와 designArtifact/feedbackResult 보고는 경로(+요약)만 주고받는다.
 * core 는 harness-agnostic(파일 I/O 無) — 경로를 데이터로 주입받아 task 에 끼운다.
 * paths 미제공(동기 스폰 목 하네스) 시 inline 모드로 동작(기존 호환).
 */
export interface ArtifactPaths {
	readonly designPrompt: string;
	readonly draft: string;
	readonly feedback: string;
}

/**
 * M4 AgentSpawn 계약 — 동기 스폰이 가능한 harness가 구현하는 인터페이스.
 * pi는 확장 코드가 서브에이전트를 동기 스폰할 수 없으므로(에이전트 전용 도구),
 * pi 어댑터는 이 인터페이스를 '에이전트 매개'로 실현한다(factorynote_plan 이
 * 단계 지시문을 반환 → Director 에이전트가 자신의 subagent 도구로 스폰 →
 * 결과를 보고). 동기 스폰 harness(CLI 테스트 하네스 등)는 runDesignFeedbackLoop
 * 에 이 구현을 직접 주입한다.
 */
export interface AgentSpawn {
	spawn(role: AgentRole, task: string): Promise<string>;
}

/** Feedback 에이전트의 산출물 검토 판정(코어 파싱 결과). */
export type FeedbackOutcome =
	| { clean: true }
	| { clean: false; issues: string[] };

/** 오케스트레이션 단계 지시문 — drivePlan이 에이전트에게 반환하는 다음 행동. */
export type DesignFeedbackDirective =
	| {
			action: "spawn-design";
			/** Design 프롬프트(루프 시 이전 이슈 인용 포함). */
			task: string;
			loop: number;
			/** 자식 스폰 컨텍스트 제약(core 정책) — 어댑터가 subagent 파라미터로 매핑. */
			spawnOptions: SpawnOptions;
	  }
	| {
			action: "spawn-feedback";
			/** 검토 대상 산출물 + 체크리스트 과제. */
			task: string;
			spawnOptions: SpawnOptions;
	  }
	| {
			action: "gate";
			/** 게이트에 저장·표시할 산출물(클린 판정본 또는 에스컬레이션 시 마지막 초안). */
			artifact: string;
			/** 내부 루프 상한 도달 — 에스컬레이션 프레이밍으로 게이트 오픈. */
			escalated: boolean;
			loops: number;
			/** 에스컬레이션 시 잔존 이슈(클린 시 빈 배열). */
			issues: string[];
	  };

/** 파이프라인 영속 상태. `.factorynote/<feature>/state.json`에 저장. */
export interface PipelineState {
	feature: string;
	stage: StageId;
	/** 현재 단계 산출물이 사용자 검토 대기 중인지. */
	gateOpen: boolean;
	/** 사용자-modify 루프 시도 횟수(게이트 후). 상한 → FR-2 에스컬레이션. */
	loopCount: number;
	/** Tier 1: 현 단계 내부 Design↔Feedback 루프 위치(게이트 전). */
	dfPhase: DesignFeedbackPhase;
	/** Tier 1: 내부 Design↔Feedback 루프 시도 횟수. 상한 → 에스컬레이션. */
	dfLoop: number;
	/** FR-7: 해당 단계까지 산출물 유효(0=미승인). confirm→증가, revert→감소, modify→불변. */
	validThrough: ValidThrough;
	/** 파이프라인 완료(Stage 3 confirm) 여부. */
	done: boolean;
	history: HistoryEntry[];
	createdAt: number;
	updatedAt: number;
}
