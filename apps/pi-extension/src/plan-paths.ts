// 산출물 교환 경로·feedback/design 메뉴·보고 파싱 — Director(에이전트)와 파일로 주고받는 규약.
import { join } from "node:path";
import {
	clampReportInput,
	designLevelCountSpec,
	designMenuForStage,
	DESIGN_LEVELS,
	feedbackLevelCountSpec,
	feedbackMenuForStage,
	parseFeedback,
	type ArtifactPaths,
	type DesignAgent,
	type DesignLevel,
	type FeedbackAgent,
	type FeedbackLevel,
	type PipelineState,
	type StageDefinition,
} from "@factorynote/core";
import type { DrivePlanInput } from "./plan-types.ts";

/** ADR-017: 라우터 호출 수 제한 실패 시 3-4개 순차 배치 분할 프로토콜 문구. */
export const FEEDBACK_BATCH_SPLIT_RULE =
	"스폰이 에이전트 호출 수/레이트 리밋 에러로 실패하면 선택 에이전트를 3-4개씩 순차 배치로 나눠 재시도하고, 전 배치 판정을 하나의 집합 보고로 합친다.";

/** ADR-031: 위성 design 스폰이 레이트 리밋 등으로 실패하면 순차 재시도 문구(위성은 최대 2개). */
export const DESIGN_BATCH_SPLIT_RULE =
	"스폰이 에이전트 호출 수/레이트 리밋 에러로 실패하면 나머지를 순차로 재시도하고 전 결과를 하나의 집합 보고로 합친다.";

/** 위성 design 문서 파일명(결정론적) — draft.<name>.md, draft 와 같은 폴더. */
export function satelliteFileName(agent: DesignAgent): string {
	return `draft.${agent.name}.md`;
}

/** 현 stage 산출물 교환 파일 경로 + feedback/design 메뉴 파일. */
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
			// 위성 문서(draft.<role>.md) 를 쓰는 폴더 — draft 와 동일(ADR-031).
			draftDir: dir,
			feedback: join(dir, "feedback.md"),
			menu: join(dir, "feedback-menu.md"),
			// 위성 design 메뉴(Director 가 designLevel 에 맞게 위성 선택, ADR-031).
			designMenu: join(dir, "design-menu.md"),
		},
		draftFile,
	};
}

/** 현 단계 feedback 메뉴 마크다운 — Director 가 읽어 수준별 N개를 추려 병렬 스폰. */
export function buildMenuMarkdown(
	def: StageDefinition,
	level: FeedbackLevel,
): string {
	const menu = feedbackMenuForStage(def.id);
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

/** 현 단계 design 메뉴 마크다운 — Director 가 읽어 designLevel 수만큼 위성을 추려 병렬 스폰(ADR-031). */
export function buildDesignMenuMarkdown(
	def: StageDefinition,
	level: DesignLevel,
): string {
	const menu = designMenuForStage(def.id);
	const satCount = DESIGN_LEVELS[level].satellites;
	const lines = [
		`# Stage ${def.id}(${def.name}) Design 메뉴(위성)`,
		"",
		`Design 위성 수준: **${level}**(총 ${designLevelCountSpec(level)}: 주 문서 1 + 위성 ${satCount}) — 주 문서(draft.md) 는 기존 factorynote-design 가 작성하고, 아래 메뉴 중 **위성 ${satCount}개** 를 추려 subagent 의 workflowScript runs.all 로 **병렬** 스폰하라.`,
		"",
		'각 위성 에이전트는 factorynote-design-<name> (fresh, 최소 도구 read/write/bash). 과제: "designPrompt 를 읽고 <focus> 관점 위성 문서 작성 — 저장 파일(draft.<name>.md) 만 쓰고 반환은 경로만".',
		"집합 보고(필수): 각 위성을 '[name]' 헤더 + 저장 경로로 나열.",
		"위성 에이전트는 그래프 파일을 만들지 않는다(그래프는 주 문서 소유).",
		DESIGN_BATCH_SPLIT_RULE,
		"",
		"| name | 초점 | 저장 파일 |",
		"| --- | --- | --- |",
	];
	for (const a of menu) {
		lines.push(`| ${a.name} | ${a.focus} | draft.${a.name}.md |`);
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
				feedbackMenuForStage(def.id),
			),
		};
	}
	if (input.designArtifact !== undefined && state.dfPhase === "design") {
		return { role: "design", draft: clampReportInput(input.designArtifact) };
	}
	return undefined;
}
