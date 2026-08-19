// spawn 지시문 → DrivePlanOutput 변환 — 자식 스폰 과제·옵션을 에이전트 지시 메시지로 구성.
import {
	DEFAULT_DESIGN_LEVEL,
	DEFAULT_FEEDBACK_LEVEL,
	DESIGN_LEVELS,
	feedbackLevelCountSpec,
	type ArtifactPaths,
	type DesignFeedbackDirective,
	type FeedbackLevel,
	type PipelineState,
	type StageDefinition,
} from "@factorynote/core";
import {
	DESIGN_BATCH_SPLIT_RULE,
	FEEDBACK_BATCH_SPLIT_RULE,
} from "./plan-paths.ts";
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
	const optLine = `스폰 옵션: skill=${opts.skill}, context="${opts.context}", toolBudget={hard:${opts.toolBudget.hard}}, turnBudget={maxTurns:${opts.turnBudget.maxTurns}}`;

	if (d.action === "spawn-design") {
		const loopNote = ` (내부 사이클 — Design ${d.loop === 0 ? "최초 작성" : `수정(${d.loop}회차)`})`;
		const designLevel = d.designLevel ?? DEFAULT_DESIGN_LEVEL;
		const satCount = DESIGN_LEVELS[designLevel].satellites;
		const mainLines = [
			`Stage ${state.stage}(${def.name}). subagent 도구로 Design 자식 에이전트를 스폰해 ${def.artifact} 산출물을 ${d.loop === 0 ? "작성" : "재작성"}하게 하라.${loopNote}`,
			`Design 위성 수준: **${designLevel}** — 주 문서(draft.md) + 위성 ${satCount}.`,
			`1) 주 문서: agent="${opts.agentName}", ${optLine}. 과제(spawnTask)를 그대로 전달 — ${def.artifact} 산출물 작성 지시이며 파일 경로·검토 기준을 담고 있다. Design 자식은 산출물을 파일(${paths.draft})에 쓰고 반환은 그 경로만(본문 금지).`,
		];
		if (designLevel !== "low") {
			mainLines.push(
				`2) 위성 에이전트: design 메뉴 파일 ${paths.designMenu} 를 읽고 위성 ${satCount}개를 추려 subagent(workflowScript runs.all)로 주 문서와 병렬 스폰하라. 각 위성은 agent="factorynote-design-<name>", ${optLine}. 과제: "designPrompt를 읽고 <focus> 관점으로 위성 문서를 작성 — 저장 파일 ${paths.draftDir}/draft.<name>.md 만 쓰고, 그래프 금지, 반환은 경로만"(재작성 라운드면 반려 이슈를 해당 위성 관점에서 자기 파일에만 반영).`,
				`3) 집합 보고(필수): 주 문서 경로를 designArtifact로. 각 위성은 "[name]" 헤더 + 저장 경로로 포함.`,
				`4) ${DESIGN_BATCH_SPLIT_RULE}`,
			);
		} else {
			mainLines.push(
				`2) 위성 없음(low) — 주 문서만 스폰한다.`,
				`3) designArtifact에 ${paths.draft} 경로만 담아 factorynote_plan을 다시 호출하라.`,
			);
		}
		mainLines.push("코드는 쓰지 않는다(계획만).");
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
			designMenuPath: paths.designMenu,
			designLevel,
			dfLoop: state.dfLoop,
			designPrompt: def.designPrompt,
			gateResult: null,
			message: mainLines.join("\n"),
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
