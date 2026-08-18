// M2/M4 Tier 1 — Design → Feedback(동적 다중 에이전트 병렬) → 조건부 수정 오케스트레이션(순수 로직).
// ADR-014 동적 feedback 에이전트: Director 가 현 단계 메뉴에서 상황에 맞는 N개를 추려 병렬 스폰.
// 기본 사이클 수 = DEFAULT_MAX_LOOPS(1, 파라미터화). '검토 요청' 버튼이 런타임 +1 사이클.
//
// 하이브리드 원칙: 판정·실행(전이·상한) = 이 코드(결정론적);
// 산출물 '내용' 판단 + 에이전트 '선택' = LLM(Director 가 메뉴에서 추려 스폰).
//
// 두 진입점:
//  - nextDesignFeedbackStep: 순수 단계 전이함수. drivePlan(pi 어댑터)이 호출해 지시문 반환.
//  - runDesignFeedbackLoop: 동기 스폰 harness(CLI 하네스·테스트)용 — 메뉴 전체(또는 selector) 스폰.
//
// 책임별 모듈:
//  - df-policy.ts      — 정책 상수(FEEDBACK_LEVELS·CHILD_SPAWN_OPTIONS·상한·입력 절단)
//  - df-parse.ts       — Feedback raw 파싱·집합(parseFeedback·aggregateFeedback)
//  - df-task.ts        — Design/Feedback 자식 과제(프롬프트) 구성
//  - df-transition.ts  — 순수 단계 전이함수(nextDesignFeedbackStep)
//  - df-loop.ts        — 동기 스폰 harness 루프 드라이버(runDesignFeedbackLoop)
export {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_DESIGN_LEVEL,
	DEFAULT_FEEDBACK_LEVEL,
	DEFAULT_MAX_LOOPS,
	DESIGN_LEVELS,
	FEEDBACK_LEVELS,
	MAX_REPORT_INPUT_CHARS,
	clampReportInput,
	designLevelCountSpec,
	feedbackLevelCountSpec,
} from "./df-policy.ts";
export {
	aggregateFeedback,
	parseFeedback,
	type DesignFeedbackReport,
} from "./df-parse.ts";
export {
	designRevisionTask,
	designSatelliteRevisionTask,
	designSatelliteTask,
	designTask,
	feedbackAgentTask,
} from "./df-task.ts";
export {
	nextDesignFeedbackStep,
	type DesignFeedbackTransition,
} from "./df-transition.ts";
export { runDesignFeedbackLoop } from "./df-loop.ts";
export type { DesignFeedbackLoopOptions } from "./df-loop.ts";
