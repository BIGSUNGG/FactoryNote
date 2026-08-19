// 산출물 교환 경로·feedback 메뉴·보고 파싱 — Director(에이전트)와 파일로 주고받는 규약.
import { join } from "node:path";
import {
	clampReportInput,
	feedbackLevelCountSpec,
	feedbackMenuForStage,
	feedbackProfileOf,
	parseFeedback,
	type ArtifactPaths,
	type FeedbackAgent,
	type FeedbackLevel,
	type PipelineState,
	type StageDefinition,
} from "@factorynote/core";
import type { DrivePlanInput } from "./plan-types.ts";

/** ADR-017: 라우터 호출 수 제한 실패 시 3-4개 순차 배치 분할 프로토콜 문구. */
export const FEEDBACK_BATCH_SPLIT_RULE =
	"스폰이 에이전트 호출 수/레이트 리밋 에러로 실패하면 선택 에이전트를 3-4개씩 순차 배치로 나눠 재시도하고, 전 배치 판정을 하나의 집합 보고로 합친다.";

/** 현 stage 산출물 교환 파일 경로 + feedback 메뉴 파일. */
export function resolvePaths(
	root: string,
	feature: string,
	_def: StageDefinition,
): { paths: ArtifactPaths; draftFile: string } {
	const dir = join(root, feature);
	const ext = "md";
	const draftFile = `draft.${ext}`;
	return {
		paths: {
			designPrompt: join(dir, "design-prompt.md"),
			draft: join(dir, draftFile),
			feedback: join(dir, "feedback.md"),
			menu: join(dir, "feedback-menu.md"),
		},
		draftFile,
	};
}

/** 현 단계 feedback 메뉴 마크다운 — Director 가 읽어 수준별 N개를 추려 병렬 스폰. */
export function buildMenuMarkdown(
	def: StageDefinition,
	level: FeedbackLevel,
): string {
	const menu = feedbackMenuForStage(feedbackProfileOf(def.kind));
	const lines = [
		`# Stage ${def.id}(${def.name}) Feedback 메뉴`,
		"",
		`검토 대상: draft.md. Feedback 수준: **${level}** — 아래 에이전트 중 **${feedbackLevelCountSpec(level)}**를 추려 subagent 의 workflowScript runs.all 로 **병렬** 스폰하라.`,
		'각 에이전트는 factorynote-feedback-<name> (fresh, 최소 도구). 과제: "<focus> 관점에서 draft 검토, 판정 CLEAN/ISSUES, 상세는 feedback.md.<name> 저장, 반환은 판정만".',
		"집합 보고(필수): 각 선택 에이전트를 '[name]' 헤더 + 판정 줄로 나열.",
		FEEDBACK_BATCH_SPLIT_RULE,
		"",
		"| name | 역량 | 검토 초점 | 체크리스트 |",
		"| --- | --- | --- | --- |",
	];
	for (const a of menu) {
		lines.push(
			`| ${a.name} | ${a.capability} | ${a.focus} | ${a.checklist.join(" / ")} |`,
		);
	}
	return lines.join("\n");
}

/**
 * Director 의 에이전트별 집합 보고(raw) → outcomes.
 * 규약: 각 에이전트를 "[name]" 헤더 + 판정. 헤더/이름 누락 시 안전 기본 ISSUES.
 */
export function parseFeedbackBatch(
	raw: string,
	menu: FeedbackAgent[],
): { axis: string; outcome: ReturnType<typeof parseFeedback> }[] {
	const lines = raw.split("\n");
	const sections = new Map<string, string[]>();
	let cur: string | null = null;
	for (const line of lines) {
		const m = line.match(/^\[([^\]]+)\]\s*$/);
		const heading = m?.[1];
		if (heading !== undefined) {
			cur = heading.trim();
			if (!sections.has(cur)) sections.set(cur, []);
			continue;
		}
		if (cur) sections.get(cur)?.push(line);
	}
	if (sections.size === 0) {
		return menu.map((a) => ({ axis: a.name, outcome: parseFeedback(raw) }));
	}
	return menu.map((a) => {
		const body = (sections.get(a.name) ?? []).join("\n").trim();
		const outcome = body
			? parseFeedback(body)
			: { clean: false, issues: ["(해당 에이전트 보고 누락)"] };
		return { axis: a.name, outcome };
	});
}

/** 입력(에이전트 보고) → 코어 보고 객체. */
export function deriveReport(
	input: DrivePlanInput,
	state: PipelineState,
	def: StageDefinition,
): import("@factorynote/core").DesignFeedbackReport | undefined {
	if (input.feedbackResult !== undefined) {
		return {
			role: "feedback",
			outcomes: parseFeedbackBatch(
				clampReportInput(input.feedbackResult),
				feedbackMenuForStage(feedbackProfileOf(def.kind)),
			),
		};
	}
	if (input.designArtifact !== undefined && state.dfPhase === "design") {
		return { role: "design", draft: clampReportInput(input.designArtifact) };
	}
	return undefined;
}
