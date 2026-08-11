// 내부 Design↔Feedback 루프 정책: 수준 스펙 · 상한 · 자식 스폰 고정 옵션 · 보고 입력 절단.
// 순수 로직, harness-agnostic. ADR-014/ADR-017.
import type { AgentRole, FeedbackLevel, SpawnOptions } from "./types/index.ts";

/**
 * FR-2(내부 사이클): Design→병렬 Feedback→조건부 수정 시도 상한(기본값).
 * 파라미터화 — drivePlan/루프 드라이버가 maxLoops 로 주입. '검토 요청' 버튼은 상한과 무관하게 +1.
 */
export const DEFAULT_MAX_LOOPS = 1;

/**
 * Feedback 수준 스펙(ADR-017) — 수준별 Feedback 자식 에이전트 수.
 * none = 스폰 0(Design 산출물 게이트 직행, opt-in Tier 0).
 * low 는 1개가 1~3개 검토 영역 담당(과제에 지시). 수치는 Director 지시문으로 전달되는 프로토콜 값.
 */
export const FEEDBACK_LEVELS: Readonly<
	Record<FeedbackLevel, { minAgents: number; maxAgents: number; label: string }>
> = Object.freeze({
	none: { minAgents: 0, maxAgents: 0, label: "없음 — 게이트 직행" },
	low: { minAgents: 1, maxAgents: 1, label: "1개(1~3 영역 담당)" },
	medium: { minAgents: 2, maxAgents: 3, label: "2~3개" },
	high: { minAgents: 4, maxAgents: 6, label: "4~6개" },
	ultra: { minAgents: 9, maxAgents: 9, label: "9개" },
});

export const DEFAULT_FEEDBACK_LEVEL: FeedbackLevel = "medium";

/** 수준별 에이전트 수 지시 문구(Director 지시문·메뉴 공통). */
export function feedbackLevelCountSpec(level: FeedbackLevel): string {
	const s = FEEDBACK_LEVELS[level];
	if (level === "low")
		return "정확히 1개 — 메뉴에서 가장 관련 높은 1개를 골라 1~3개 검토 영역을 맡긴다";
	if (s.minAgents === s.maxAgents) return `정확히 ${s.minAgents}개`;
	return `${s.minAgents}~${s.maxAgents}개`;
}

/**
 * 자식 스폰 고정 옵션 — 컨텍스트 한도 관리 정책(core 소유).
 * 도구 제거는 명명 에이전트 정의의 tools: allowlist 가 담당(ADR-012). 역량별 도구는 에이전트 파일이 결정.
 */
export const CHILD_SPAWN_OPTIONS: Readonly<Record<AgentRole, SpawnOptions>> =
	Object.freeze({
		design: {
			skill: false,
			context: "fresh",
			agentName: "factorynote-design",
			toolBudget: { hard: 20, soft: 14 },
			turnBudget: { maxTurns: 15, graceTurns: 2 },
		},
		feedback: {
			skill: false,
			context: "fresh",
			// 동적 선택: Director 가 메뉴에서 고른 factorynote-feedback-<name> 스폰. 기본 예산.
			agentName: "factorynote-feedback",
			toolBudget: { hard: 15, soft: 10 },
			turnBudget: { maxTurns: 10, graceTurns: 2 },
		},
	});

/**
 * 방향 3b: 자식 보고 입력이 과도히 길면 절단해 Director 컨텍스트 누적(1261) 차단.
 */
export const MAX_REPORT_INPUT_CHARS = 4000;
export function clampReportInput(
	raw: string,
	maxLen: number = MAX_REPORT_INPUT_CHARS,
): string {
	if (raw.length <= maxLen) return raw;
	const nl = raw.indexOf("\n");
	const head = nl === -1 ? raw : raw.slice(0, nl);
	return (
		head.slice(0, Math.min(head.length, maxLen)) +
		`\n[입력이 ${raw.length}자로 과대 — ${maxLen}자 한도로 절단(방향 3b). 상세는 산출물 파일 참조.]`
	);
}
