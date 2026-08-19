// spawn 지시문 → DrivePlanOutput 변환 — 자식 스폰 과제·옵션을 에이전트 지시 메시지로 구성.
import {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_FEEDBACK_LEVEL,
	designTask,
	feedbackLevelCountSpec,
	type ArtifactPaths,
	type DesignFeedbackDirective,
	type FeedbackLevel,
	type PipelineState,
	type StageDefinition,
} from "@factorynote/core";
import { FEEDBACK_BATCH_SPLIT_RULE } from "./plan-paths.ts";
import type { DrivePlanOutput } from "./plan-types.ts";

/** spawn 지시문 반환 — 에이전트에게 자식 스폰을 지시(파일 프로토콜 + 스폰 옵션). */
export function spawnDirective(
	state: PipelineState,
	def: StageDefinition,
	d: Extract<
		DesignFeedbackDirective,
		{ action: "spawn-design" | "spawn-feedback" }
	>,
	paths: ArtifactPaths,
	feedbackLevel: FeedbackLevel = DEFAULT_FEEDBACK_LEVEL,
): DrivePlanOutput {
	const opts = d.spawnOptions;
	const optLine = `스폰 옵션(기본): skill=${opts.skill}, context="${opts.context}", toolBudget={hard:${opts.toolBudget.hard}}, turnBudget={maxTurns:${opts.turnBudget.maxTurns}}`;

	if (d.action === "spawn-design") {
		const loopNote = ` (내부 사이클 — Design ${d.loop === 0 ? "최초 작성" : `수정(${d.loop}회차)`})`;
		const message = [
			`Stage ${state.stage}(${def.name}). subagent 도구로 Design 자식 에이전트를 스폰해 ${def.artifact} 산출물을 ${d.loop === 0 ? "작성" : "재작성"}하게 하라.${loopNote}`,
			`agent="${opts.agentName}", ${optLine}`,
			`Design 자식은 산출물을 파일(${paths.draft})에 쓰고 반환은 그 경로만 한다(본문 금지). designArtifact 에는 경로만 담아 factorynote_plan 을 다시 호출하라.`,
			"코드는 쓰지 않는다(계획만).",
		].join("\n");
		return {
			done: false,
			stage: state.stage,
			stageName: def.name,
			nextAction: "spawn-design",
			spawnRole: "design",
			spawnTask: d.task,
			spawnOptions: d.spawnOptions,
			draftPath: paths.draft,
			feedbackPath: paths.feedback,
			menuPath: paths.menu,
			dfLoop: state.dfLoop,
			designPrompt: def.designPrompt,
			gateResult: null,
			message,
		};
	}

	// spawn-feedback: 동적 선택. Director 가 메뉴를 읽어 수준별 N개를 추려 병렬 스폰(ADR-017).
	const level = d.feedbackLevel ?? feedbackLevel;
	const message = [
		`Stage ${state.stage}(${def.name}). Feedback 수준: **${level}**. subagent 도구(workflowScript runs.all)로 Feedback 자식 에이전트를 **수준에 맞게 추려 병렬** 스폰해 산출물을 비판 검토하게 하라. (동적 feedback 에이전트, ADR-014)`,
		`1) 메뉴 파일 ${paths.menu} 를 읽고, 검토 대상 ${paths.draft} 산출물·기능 맥락에 가장 의미있는 **${feedbackLevelCountSpec(level)}**를 추려라. (메뉴 전체가 아닌 상황 맞춤 선택)`,
		`2) 각 선택 에이전트: agent="factorynote-feedback-<name>", ${optLine}. 과제: "<focus> 관점에서 ${paths.draft} 검토 → 판정 CLEAN/ISSUES → 상세 리뷰는 ${paths.feedback}.<name> 에 저장 → 반환은 판정만".`,
		`3) 집합 보고(필수 형식): 각 선택 에이전트를 "[name]" 헤더 + 판정("CLEAN" 또는 "ISSUES"+이슈줄)으로 나열.`,
		`4) ${FEEDBACK_BATCH_SPLIT_RULE}`,
		`feedbackResult 에 집합 텍스트를, designArtifact 에 ${paths.draft} 경로를 담아 factorynote_plan 을 다시 호출하라.`,
		"코드는 쓰지 않는다(검토만).",
	].join("\n");
	return {
		done: false,
		stage: state.stage,
		stageName: def.name,
		nextAction: "spawn-feedback",
		spawnRole: "feedback",
		spawnOptions: d.spawnOptions,
		draftPath: paths.draft,
		feedbackPath: paths.feedback,
		menuPath: paths.menu,
		feedbackLevel: level,
		dfLoop: state.dfLoop,
		designPrompt: def.designPrompt,
		gateResult: null,
		message,
	};
}
