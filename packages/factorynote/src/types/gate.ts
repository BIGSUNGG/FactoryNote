// 게이트 영역 타입: 단계·판정·코멘트·채팅·이력. harness-agnostic(Layer 1-2).

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
	/** 단계 진행 요청 기록(confirm 시 생성). 일반 채팅은 미지정.
	 * pendingChats 큐를 경유해 기존 대기 채팅 뒤에 적재되고, 실행 시 fulfilled 로 chatLog 에 기록된다. */
	kind?: "stage-request";
	status?: "pending" | "fulfilled";
	targetStage?: number;
	/** stage-request 가 큐에서 실행될 때 resolve 될 결정(서버 내부용 — 뷰어 미사용). */
	decision?: GateDecision;
	at: number;
}

/** 사용자 게이트에서 뷰어가 반환하는 결정. */
export interface GateDecision {
	verdict: GateVerdict;
	comments: Comment[];
	/** FR-7: 회귀 대상 단계(1..3). 생략 시 종래대로 1단계 회귀. 현재 단계보다 앞으로만(엔진이 clamp). */
	revertTo?: StageId;
}

/** 게이트 통과 이력(NFR-3 감사). */
export interface HistoryEntry {
	stage: StageId;
	verdict: GateVerdict;
	at: number;
}
