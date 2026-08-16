// 게이트 오픈/결정/채팅/검토요청 처리 — drivePlan 의 게이트 구간.
// runOpenGate: 산출물 확정 → 게이트 서버 대기 → 결정/채팅/검토요청 분기 → 전이·회귀 무효화.
import {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_FEEDBACK_LEVEL,
	applyVerdict,
	atLoopCeiling,
	graphRefFiles,
	invalidateArtifactsAfter,
	isComplete,
	markArtifactReady,
	promoteGraphTree,
	saveState,
	stageById,
	writeArtifact,
	type ChatMessage,
	type GateDecision,
	type PipelineState,
} from "@factorynote/core";
import type { DrivePlanInput, DrivePlanOutput } from "./plan-types.ts";
import { buildMenuMarkdown, resolvePaths } from "./plan-paths.ts";
import { spawnDirective } from "./plan-directive.ts";
import {
	appendAgentChat,
	closeGate,
	notifyViewerState,
	observeGate,
	runGate,
} from "./gate-server.ts";

/** #4 게이트 자동 만료(ms). 30분. */
export const GATE_TIMEOUT_MS = 30 * 60 * 1000;

/** 게이트 결정 후 다음 스텝 안내 메시지 조립(순수) — 에스컬레이션/수정 요청/승인 분기. */
function gateOutcomeMessage(
	decision: GateDecision,
	state: PipelineState,
	nextDef: ReturnType<typeof stageById>,
	internalEscalation: { issues: string[]; loops: number } | undefined,
	resume: boolean,
): string {
	const commentsBlock = `\n코멘트:\n${formatComments(decision.comments)}`;
	let base: string;
	if (internalEscalation) {
		base = `⚠ 내부 Design→Feedback 사이클 상한(${internalEscalation.loops}회) 도달 — Feedback 이 수렴하지 못하고 아래 이슈가 잔존한다. 게이트에서 결정: (a) 코멘트로 근본적 재작성 지시 (b) '검토 요청' 버튼으로 +1 사이클 (c) 이전 단계로 회귀. 잔존 이슈:\n${internalEscalation.issues.map((i) => `- ${i}`).join("\n")}`;
	} else if (decision.verdict === "modify" && atLoopCeiling(state)) {
		base = `⚠ FR-2 에스컬레이션: Stage ${state.stage}(${nextDef.name}) 가 ${state.loopCount}회 수정되었으나 아래 이슈가 잔존한다. 선택: (a) 코멘트를 근본적으로 반영해 재작성 (b) 이전 단계로 회귀 (c) 범위·제약 조건 재협의. 잔존 이슈:${commentsBlock}`;
	} else if (decision.verdict === "modify") {
		base = `사용자가 Stage ${state.stage}(${nextDef.name}) 산출물의 수정을 요청했다. 코멘트를 반영해 Design 자식에게 재작성시킬 것.${commentsBlock}`;
	} else {
		base = `Stage ${state.stage}(${nextDef.name}) 승인. 다음 단계로 진행 — Design 자식 스폰부터 새 내부 사이클을 시작한다.`;
	}
	return (resume ? "[게이트 재오픈(인터럽트 복구)] " : "") + base;
}

/** 게이트 오픈 → 결정/채팅/검토요청 → 처리 → 다음 안내 반환. */
export async function runOpenGate(
	input: DrivePlanInput,
	stateIn: PipelineState,
	def: ReturnType<typeof stageById>,
	artifactToWrite: string,
	resume: boolean,
	internalEscalation?: { issues: string[]; loops: number },
): Promise<DrivePlanOutput> {
	const { root, viewerDistDir, feature, signal } = input;
	let state = stateIn;

	if (input.chatResponse !== undefined) {
		appendAgentChat(root, feature, input.chatResponse);
	}
	if (!resume && def.artifactFile) {
		await writeArtifact(
			root,
			feature,
			def.artifactFile,
			await promoteGraphArtifact(root, feature, def.id, artifactToWrite),
		);
	}

	state = markArtifactReady(state);
	await saveState(root, state);

	// 산물을 디스크에 기록하고 게이트를 열기 직전 — 뷰어에게 상태 변경 push.
	// 에이전트가 쓴 타이밍에만 갱신(폴링 대체). resume 여부 무관: 재오픈도 뷰어가 따라가야 한다.
	notifyViewerState(root, feature);

	let decision: GateDecision;
	if (input.autoAdvance) {
		await observeGate({
			root,
			feature,
			viewerDistDir,
			...(input.open !== undefined ? { open: input.open } : {}),
			...(input.onReady ? { onReady: input.onReady } : {}),
		});
		decision = { verdict: "confirm", comments: [] };
	} else {
		const event = await runGate({
			root,
			feature,
			viewerDistDir,
			timeoutMs: GATE_TIMEOUT_MS,
			...(signal ? { signal } : {}),
			...(input.open !== undefined ? { open: input.open } : {}),
			...(input.onReady ? { onReady: input.onReady } : {}),
		});

		if (event.kind === "chat") {
			const hasBlock = event.messages.some((m) => m.blockId);
			return {
				done: false,
				stage: state.stage,
				stageName: def.name,
				nextAction: "spawn-design",
				dfLoop: state.dfLoop,
				designPrompt: def.designPrompt,
				gateResult: null,
				chatPending: event.messages,
				message:
					`사용자가 채팅으로 질문/수정을 요청했다${hasBlock ? "(블록 지정 포함)" : ""}. ` +
					`질문이면 답변을 chatResponse 로, 산물 수정이 필요하면 Design 자식 스폰으로 재작성해 designArtifact(초안 경로)와 답변 chatResponse 를 담아 factorynote_plan 을 다시 호출하라(게이트 유지).\n` +
					event.messages.map(formatChat).join("\n"),
			};
		}

		if (event.kind === "review-request") {
			const revLevel = input.feedbackLevel ?? DEFAULT_FEEDBACK_LEVEL;
			const revState: PipelineState = {
				...state,
				gateOpen: false,
				dfPhase: "feedback",
				dfLoop: 0,
			};
			await saveState(root, revState);
			const revPaths = resolvePaths(root, feature, def).paths;
			return spawnDirective(
				revState,
				def,
				{
					action: "spawn-feedback",
					menuPath: revPaths.menu,
					draftPath: revPaths.draft,
					feedbackPath: revPaths.feedback,
					feedbackLevel: revLevel,
					spawnOptions: CHILD_SPAWN_OPTIONS.feedback,
				},
				revPaths,
				revLevel,
			);
		}

		decision = event.decision;
	}

	state = applyVerdict(state, decision);
	if (decision.verdict === "revert") {
		await invalidateArtifactsAfter(root, feature, state.stage);
	}
	await saveState(root, state);

	if (isComplete(state)) {
		await closeGate(root, feature);
		return complete(state.stage);
	}

	const nextDef = stageById(state.stage);
	const message = gateOutcomeMessage(
		decision,
		state,
		nextDef,
		internalEscalation,
		resume,
	);

	// 전이 직후 자식이 읽을 작성 지시·메뉴를 다음 단계 것으로 갱신 — 낡은 이전 단계
	// 파일을 읽은 자식이 규격 이탈(예: 그래프 프로토콜 누락)하는 것을 차단한다.
	await writeArtifact(root, feature, "design-prompt.md", nextDef.designPrompt);
	await writeArtifact(
		root,
		feature,
		"feedback-menu.md",
		buildMenuMarkdown(nextDef, input.feedbackLevel ?? DEFAULT_FEEDBACK_LEVEL),
	);

	const nextPaths = resolvePaths(root, feature, nextDef).paths;
	return {
		done: false,
		stage: state.stage,
		stageName: nextDef.name,
		nextAction: "spawn-design",
		spawnRole: "design",
		spawnOptions: CHILD_SPAWN_OPTIONS.design,
		draftPath: nextPaths.draft,
		feedbackPath: nextPaths.feedback,
		menuPath: nextPaths.menu,
		dfLoop: state.dfLoop,
		designPrompt: nextDef.designPrompt,
		gateResult: decision,
		message,
	};
}

/** 게이트 오픈 시 draft 그래프 트리들을 산출물과 같은 stageN/ 폴더로 승격(ADR-018).
 * 그래프 이름은 에이전트가 지은 그대로 승격 — rewrite 없음(ADR-020). 참조마다
 * 도달 가능한 트리 파일을 동반 승격한다. 참조 없으면 md 만 반환(그래프 없는 산출물 안전). */
async function promoteGraphArtifact(
	root: string,
	feature: string,
	stageId: number,
	md: string,
): Promise<string> {
	for (const ref of graphRefFiles(md)) {
		await promoteGraphTree(root, feature, ref, `stage${stageId}/${ref}`);
	}
	return md;
}

function complete(stage: number): DrivePlanOutput {
	return {
		done: true,
		stage,
		stageName: stageById(3).name,
		nextAction: "done",
		dfLoop: 0,
		designPrompt: "",
		gateResult: null,
		message:
			"파이프라인 완료 — 3단계 모두 사용자 승인됨. 계획 산출물은 .factorynote/<feature>/ 에 저장되었다.",
	};
}

function formatChat(m: ChatMessage): string {
	const block = m.blockId ? ` [블록 ${m.blockId}]` : "";
	const quote = m.quote ? ` (인용: "${m.quote}")` : "";
	return `- ${block}${quote} ${m.text}`;
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
