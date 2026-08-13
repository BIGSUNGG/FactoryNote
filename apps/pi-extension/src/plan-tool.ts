// factorynote_plan 도구 드라이버 — 3단계 게이트 파이프라인의 단일 진입.
// Tier 1(ADR-014 동적 feedback 에이전트): Director 가 현 단계 메뉴에서 상황에 맞는 N개를
// 추려 병렬 스폰(runs.all) → 집합 보고 → 조건부 수정 → 게이트. 기본 사이클=DEFAULT_MAX_LOOPS(1).
// '검토 요청' 버튼이 게이트 열린 동안 +1 사이클을 런타임 강제.
// pi 확장 코드는 서브에이전트를 동기 스폰할 수 없으므로, 스폰은 Director 가 subagent 도구로 수행.
//
// 책임별 모듈:
//  - plan-types.ts     — DrivePlanInput/Output 계약 타입
//  - plan-paths.ts     — 산출물 교환 경로·feedback 메뉴·보고 파싱
//  - plan-directive.ts — spawn 지시문 → DrivePlanOutput(자식 스폰 과제 구성)
//  - plan-gate.ts      — 게이트 오픈/결정/채팅/검토요청 처리(runOpenGate)
import {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_FEEDBACK_LEVEL,
	DEFAULT_MAX_LOOPS,
	checkRequiredGraph,
	designRevisionTask,
	designTask,
	initialState,
	loadState,
	nextDesignFeedbackStep,
	readArtifact,
	requiresArtifact,
	saveState,
	stageById,
	writeArtifact,
} from "@factorynote/core";
import { buildMenuMarkdown, deriveReport, resolvePaths } from "./plan-paths.ts";
import { spawnDirective } from "./plan-directive.ts";
import { runOpenGate } from "./plan-gate.ts";
import { closeGate } from "./gate-server.ts";

export type {
	DrivePlanInput,
	DrivePlanOutput,
	NextAction,
} from "./plan-types.ts";

/** 파이프라인 1스텝 구동. Tier 1 동적 feedback 에이전트 오케스트레이션(ADR-014). */
export async function drivePlan(
	input: import("./plan-types.ts").DrivePlanInput,
): Promise<import("./plan-types.ts").DrivePlanOutput> {
	const { root, feature } = input;

	let state = await loadState(root, feature);
	if (!state) state = initialState(feature);
	if (state.done) {
		await closeGate(root, feature);
		return complete(state.stage);
	}

	const def = stageById(state.stage);

	// #3 인터럽트 복구: 게이트 열린 채 끊겼고 산출물이 디스크에 있으면 재오픈.
	const resumeFile = def.artifactFile;
	if (resumeFile) {
		const onDisk = await readArtifact(root, feature, resumeFile);
		if (
			state.gateOpen &&
			input.designArtifact === undefined &&
			input.feedbackResult === undefined &&
			onDisk !== undefined
		) {
			return await runOpenGate(input, state, def, onDisk, true);
		}
	}

	// 채팅 수정 요청 등으로 게이트 열린 상태에서 재작성(designArtifact)이 들어옴:
	// 산출물(draft.md)을 반영해 갱신된 내용으로 게이트를 다시 연다(게이트 유지 — ADR-009).
	// resume=false 로 재작성 반영. chatResponse 도 함께 오면 runOpenGate 가 답변을 chatLog 에 push.
	// (이전엔 이 경로가 빠져 폴백으로 빠졌다 → 산물 미반영·게이트 끊김·뷰어 멈춤.)
	if (state.gateOpen && input.designArtifact !== undefined) {
		const { draftFile } = resolvePaths(root, feature, def);
		const gateArtifact = (await readArtifact(root, feature, draftFile)) ?? "";
		return await runOpenGate(input, state, def, gateArtifact, false);
	}

	if (requiresArtifact(state.stage) && !state.gateOpen) {
		const feedbackLevel = input.feedbackLevel ?? DEFAULT_FEEDBACK_LEVEL;
		const report = deriveReport(input, state, def);
		const draft = input.designArtifact;
		const { paths, draftFile } = resolvePaths(root, feature, def);
		// designPrompt(불변) + feedback 메뉴(현 단계) 파일 기록 — 자식/Director 가 읽도록.
		// 그래프 검증·반려보다 먼저: 반려 라운드 재작성 자식도 현 단계 지시를 읽어야 한다.
		await writeArtifact(root, feature, "design-prompt.md", def.designPrompt);
		await writeArtifact(
			root,
			feature,
			"feedback-menu.md",
			buildMenuMarkdown(def, feedbackLevel),
		);
		// 그래프 강제(Stage 2 required): design 보고의 필수 그래프 트리가 없으면 Feedback 전 재작성 반려.
		if (report?.role === "design" && def.graph === "required") {
			const graphIssue = await checkRequiredGraph(root, feature, draftFile);
			if (graphIssue) {
				if (state.dfLoop < DEFAULT_MAX_LOOPS) {
					state = { ...state, dfLoop: state.dfLoop + 1 };
					await saveState(root, state);
					return spawnDirective(
						state,
						def,
						{
							action: "spawn-design",
							task: designRevisionTask(def, [graphIssue], paths),
							loop: state.dfLoop,
							spawnOptions: CHILD_SPAWN_OPTIONS.design,
						},
						paths,
						feedbackLevel,
					);
				}
				// 상한 소진: 게이트로 에스컬레이션해 사용자 판단에 맡긴다(Feedback 미수렴과 동일 기제).
				state = { ...state, dfPhase: "design", dfLoop: 0 };
				const gateArtifact =
					(await readArtifact(root, feature, draftFile)) ?? "";
				return await runOpenGate(input, state, def, gateArtifact, false, {
					issues: [graphIssue],
					loops: DEFAULT_MAX_LOOPS,
				});
			}
		}
		const t = nextDesignFeedbackStep(
			def,
			{ dfPhase: state.dfPhase, dfLoop: state.dfLoop },
			report,
			draft,
			paths,
			DEFAULT_MAX_LOOPS,
			feedbackLevel,
		);
		state = { ...state, dfPhase: t.dfPhase, dfLoop: t.dfLoop };
		const d = t.directive;

		if (d.action === "spawn-design" || d.action === "spawn-feedback") {
			await saveState(root, state);
			return spawnDirective(state, def, d, paths, feedbackLevel);
		}
		const gateArtifact = (await readArtifact(root, feature, draftFile)) ?? "";
		return await runOpenGate(
			input,
			state,
			def,
			gateArtifact,
			false,
			d.escalated ? { issues: d.issues, loops: d.loops } : undefined,
		);
	}

	// 도달 불가 — 안전 추락.
	await saveState(root, state);
	const { paths: fallbackPaths } = resolvePaths(root, feature, def);
	return spawnDirective(
		state,
		def,
		{
			action: "spawn-design",
			task: designTask(def, fallbackPaths),
			loop: state.dfLoop,
			spawnOptions: CHILD_SPAWN_OPTIONS.design,
		},
		fallbackPaths,
	);
}

function complete(stage: number): import("./plan-types.ts").DrivePlanOutput {
	return {
		done: true,
		stage,
		stageName: "Stage 3",
		nextAction: "done",
		dfLoop: 0,
		designPrompt: "",
		gateResult: null,
		message:
			"파이프라인 완료 — 3단계 모두 사용자 승인됨. 계획 산출물은 .factorynote/<feature>/ 에 저장되었다.",
	};
}
