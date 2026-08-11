// 게이트 이벤트/채팅 타입 — 서버·핸들러·드라이버가 공유하는 계약.
import type { ChatMessage, GateDecision } from "@factorynote/core";

/** 게이트 대기 중 발생 이벤트: 사용자 최종 결정, 실시간 채팅, 또는 '검토 요청'(AI 재검토 +1 사이클). */
export type GateEvent =
	| { kind: "decision"; decision: GateDecision }
	| { kind: "chat"; messages: ChatMessage[] }
	| { kind: "review-request" };

export type { ChatMessage };
