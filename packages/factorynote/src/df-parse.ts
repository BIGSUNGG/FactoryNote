// Feedback raw 출력 파싱·집합 — 안전 기본값 ISSUES. 순수 로직.
import type { FeedbackAxisOutcome, FeedbackOutcome } from "./types/index.ts";

/** Feedback 에이전트의 raw 출력을 판정으로 파싱. 안전 기본값 ISSUES. */
export function parseFeedback(raw: string): FeedbackOutcome {
	const lines = raw
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const head = (lines[0] ?? "").toUpperCase();
	if (head === "CLEAN" || head.startsWith("VERDICT: CLEAN")) {
		return { clean: true };
	}
	const body =
		head.startsWith("ISSUES") || head.startsWith("VERDICT: ISSUES")
			? lines.slice(1)
			: lines;
	const issues = body
		.map((l) => l.replace(/^[-*]\s*/, ""))
		.filter((l) => l.length > 0);
	return {
		clean: false,
		issues: issues.length > 0 ? issues : ["(구체적 이슈 없음)"],
	};
}

/** Feedback 자식 보고. outcomes 는 Director 가 선택·스폰한 에이전트별 결과 집합. */
export type DesignFeedbackReport =
	| { role: "design"; draft: string }
	| { role: "feedback"; outcomes: FeedbackAxisOutcome[] };

/** 에이전트별 결과 집합 → 전체 클린 여부 + 취합된 이슈(에이전트명 접두). */
export function aggregateFeedback(outcomes: FeedbackAxisOutcome[]): {
	allClean: boolean;
	issues: string[];
} {
	const issues: string[] = [];
	let allClean = true;
	for (const o of outcomes) {
		if (!o.outcome.clean) {
			allClean = false;
			for (const i of o.outcome.issues) issues.push(`[${o.axis}] ${i}`);
		}
	}
	return { allClean, issues };
}
