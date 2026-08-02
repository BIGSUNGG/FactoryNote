// factorynote_plan 도구 드라이버 — 6단계 게이트 파이프라인의 단일 진입.
// 에이전트가 호출: 산출물 작성→제출(artifactMd) → 게이트(웹) → 결과 반환(수정/승인/완료).
// 코어(@factorynote/core) 상태기계 + gate-server(웹 게이트) 를 연결.
import {
	STAGES,
	applyVerdict,
	initialState,
	isComplete,
	loadState,
	markArtifactReady,
	readArtifact,
	requiresArtifact,
	saveState,
	stageById,
	writeArtifact,
	type GateDecision,
	type PipelineState,
} from "@factorynote/core";
import { runGate } from "./gate-server.ts";

export interface DrivePlanInput {
	root: string;
	/** 뷰어 빌드 산출물(dist) 디렉토리. */
	viewerDistDir: string;
	feature: string;
	/** 현 단계 산출물(마크다운 또는 그래프 JSON). 없으면 산출물 작성 지시를 반환한다. */
	artifactMd?: string;
	signal?: AbortSignal;
	/** false 면 브라우저 자동 오픈 생략(테스트용). */
	open?: boolean;
	/** 게이트 서버 준비 시 URL 통보(테스트/디버그용). */
	onReady?: (url: string) => void;
}

export interface DrivePlanOutput {
	done: boolean;
	stage: number;
	stageName: string;
	/** true면 에이전트가 산출물을 작성해 artifactMd와 함께 재제출해야 한다. */
	needArtifact: boolean;
	designPrompt: string;
	feedbackChecklist: string[];
	gateResult: GateDecision | null;
	message: string;
	/** 사용자에게 열린 게이트 URL(디버그/안내용). */
	gateUrl?: string;
}

/**
 * 파이프라인 1스텝 구동. 상태를 로드/저장하고, 필요시 웹 게이트를 열어 결정을 받는다.
 * 에이전트는 반환값의 message·needArtifact 에 따라 다음 행동을 정한다.
 */
export async function drivePlan(
	input: DrivePlanInput,
): Promise<DrivePlanOutput> {
	const { root, feature } = input;

	let state = await loadState(root, feature);
	if (!state) state = initialState(feature);
	if (state.done) {
		return complete(state.stage);
	}

	const def = stageById(state.stage);
	const graphStage = def.format === "nodes-edges";
	const artifactKind = graphStage
		? "그래프 JSON({sections:[{id,title,nodes,edges}]})"
		: "마크다운";

	// #3 인터럽트 복구: 게이트가 열린(gateOpen) 채 끊겼고 산출물이 이미 디스크에 있으면,
	// 산출물 재작성을 요구하지 않고 곧바로 게이트를 재오픈한다.
	if (
		requiresArtifact(state.stage) &&
		input.artifactMd === undefined &&
		state.gateOpen &&
		def.artifactFile &&
		(await readArtifact(root, feature, def.artifactFile)) !== undefined
	) {
		return await runOpenGate(input, state, def, true);
	}

	// 산출물이 필요한 단계인데 artifactMd 가 없으면 작성 지시.
	if (requiresArtifact(state.stage) && input.artifactMd === undefined) {
		return {
			done: false,
			stage: state.stage,
			stageName: def.name,
			needArtifact: true,
			designPrompt: def.designPrompt,
			feedbackChecklist: [...def.feedbackChecklist],
			gateResult: null,
			message: `Stage ${state.stage}(${def.name}) 산출물을 ${artifactKind}(으)로 작성하라. 작성이 끝나면 factorynote_plan 의 artifactMd 에 담아 다시 호출해 게이트(사용자 검토)를 열어라. 코드는 쓰지 않는다.`,
		};
	}

	return await runOpenGate(input, state, def, false);
}

/**
 * 게이트 오픈 → 결정 → 결정 적용·저장 → 다음 안내 반환.
 * resume=true 이면 인터럽트 복구로 게이트 재오픈임을 message 에 표시한다.
 * 게이트 결정 이후 흐름(graphSections 채택, applyVerdict, 저장)은 기존과 동일.
 */
async function runOpenGate(
	input: DrivePlanInput,
	stateIn: PipelineState,
	def: ReturnType<typeof stageById>,
	resume: boolean,
): Promise<DrivePlanOutput> {
	const { root, viewerDistDir, feature, signal } = input;
	let state = stateIn;

	// 산출물 저장(산출물 단계 + 신규 제출시만 — resume 은 이미 디스크에 있으므로 건너뜀).
	if (!resume && input.artifactMd !== undefined && def.artifactFile) {
		await writeArtifact(root, feature, def.artifactFile, input.artifactMd);
	}

	// 게이트 오픈 → 웹에서 결정 대기(블로킹).
	state = markArtifactReady(state);
	await saveState(root, state);
	const decision = await runGate({
		root,
		feature,
		viewerDistDir,
		...(signal ? { signal } : {}),
		...(input.open !== undefined ? { open: input.open } : {}),
		...(input.onReady ? { onReady: input.onReady } : {}),
	});

	// 그래프 단계(Stage 3/4)에서 사용자가 직접 편집한 그래프를 산출물로 채택(저장).
	// 직접 편집 → 에이전트 채택: 사용자의 편집 결과가 곧 산출물(5대 원칙 — 게이트 거쳐 채택).
	if (decision.graphSections && def.artifactFile?.endsWith(".json")) {
		await writeArtifact(
			root,
			feature,
			def.artifactFile,
			JSON.stringify({ sections: decision.graphSections }),
		);
	}

	// 결정 적용·저장.
	state = applyVerdict(state, decision);
	await saveState(root, state);

	if (isComplete(state)) {
		return complete(state.stage);
	}

	// 다음에 에이전트가 해야 할 일 안내.
	const nextDef = stageById(state.stage);
	const needNext = requiresArtifact(state.stage);
	const nextGraph = nextDef.format === "nodes-edges";
	const commentsBlock = `\n코멘트:\n${formatComments(decision.comments)}`;
	const base =
		decision.verdict === "modify"
			? nextGraph
				? `사용자가 Stage ${state.stage}(${nextDef.name}) 그래프를 직접 편집했다(채택 저장됨). 코멘트를 반영해 그래프 JSON을 수정하거나, 코멘트가 없으면 현재 그래프를 그대로 artifactMd 에 담아 재제출해 게이트를 다시 열어라.${commentsBlock}`
				: `사용자가 Stage ${state.stage}(${nextDef.name}) 산출물의 수정을 요청했다. 코멘트를 반영해 산출물을 재작성 후 artifactMd 와 함께 다시 제출하라.${commentsBlock}`
			: `Stage ${state.stage}(${nextDef.name}) 승인. 다음 단계 ${state.stage}(${nextDef.name})로 진행. ` +
				(needNext
					? nextGraph
						? "그래프 JSON 산출물을 작성해 artifactMd 와 함께 제출하라."
						: "산출물을 작성해 artifactMd 와 함께 제출하라."
					: "이 단계는 산출물 없음 — factorynote_plan 을 다시 호출해 최종 검증 게이트를 열어라.");
	const message =
		(resume ? "[게이트 재오픈(인터럽트 복구)] " : "") +
		base +
		(state.loopCount >= 3
			? `\n※ 이 단계가 ${state.loopCount}회 수정됨 — 근본적 설계 갈등이 있는지 확인을 권장.`
			: "");

	return {
		done: false,
		stage: state.stage,
		stageName: nextDef.name,
		needArtifact: needNext,
		designPrompt: nextDef.designPrompt,
		feedbackChecklist: [...nextDef.feedbackChecklist],
		gateResult: decision,
		message,
	};
}

function complete(stage: number): DrivePlanOutput {
	return {
		done: true,
		stage,
		stageName: STAGES[5]!.name,
		needArtifact: false,
		designPrompt: "",
		feedbackChecklist: [],
		gateResult: null,
		message:
			"파이프라인 완료 — 6단계 모두 사용자 승인됨. 계획 산출물은 .factorynote/<feature>/ 에 저장되었다. plan 모드는 자동으로 해제되었다(이제 구현 가능).",
	};
}

function formatComments(comments: GateDecision["comments"]): string {
	if (comments.length === 0) return "(코멘트 없음)";
	return comments
		.map((c, i) => {
			const quote = c.quote ? ` (인용: "${c.quote}")` : "";
			const block = c.blockId ? ` [${c.blockId}]` : "";
			return `${i + 1}.${block}${quote} ${c.text}`;
		})
		.join("\n");
}
