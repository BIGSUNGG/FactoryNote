// 파이프라인 영속 상태 — .factorynote/<feature>/state.json 에 저장.
import type { DesignFeedbackPhase, FeedbackLevel } from "./feedback.ts";
import type { HistoryEntry, StageId, StageKind, ValidThrough } from "./gate.ts";

export interface PipelineState {
	feature: string;
	/** 디렉터가 결정한 스테이지 구성 — 종류 순서 목록(생성 시 고정). */
	stages: StageKind[];
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
	/** 사용자 지정 최대 스테이지 개수 상한(설정 메뉴 /factorynote). 미지정 시 없음. */
	maxStages?: number;
	/** 파이프라인 완료(마지막 단계 confirm) 여부. */
	done: boolean;
	history: HistoryEntry[];
	createdAt: number;
	updatedAt: number;
}
