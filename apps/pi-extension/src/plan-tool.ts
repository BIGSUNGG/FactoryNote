// factorynote_plan 도구 드라이버 — 3단계 게이트 파이프라인의 단일 진입.
// 에이전트가 호출: 산출물 작성→제출(artifactMd) → 게이트(웹) → 결과 반환(수정/승인/완료).
// 코어(@factorynote/core) 상태기계 + gate-server(웹 게이트) 를 연결.
import {
	STAGES,
	applyVerdict,
	atLoopCeiling,
	initialState,
	invalidateArtifactsAfter,
	isComplete,
	loadState,
	markArtifactReady,
	readArtifact,
	requiresArtifact,
	saveState,
	stageById,
	writeArtifact,
	type ChatMessage,
	type GateDecision,
	type PipelineState,
} from "@factorynote/core";
import { appendAgentChat, closeGate, runGate } from "./gate-server.ts";

/** #4 게이트 자동 만료(ms) — 사용자 이탈 시 좀비 게이트 방지. 30분. */
const GATE_TIMEOUT_MS = 30 * 60 * 1000;

export interface DrivePlanInput {
	root: string;
	/** 뷰어 빌드 산출물(dist) 디렉토리. */
	viewerDistDir: string;
	feature: string;
	/** 현 단계 산출물(마크다운 또는 그래프 JSON). 없으면 산출물 작성 지시를 반환한다. */
	artifactMd?: string;
	/** 이전 게이트에서 받은 채팅에 대한 에이전트 답변(게이트 유지 채팅 루프). 미사용 시 무시. */
	chatResponse?: string;
	signal?: AbortSignal;
	/** false 면 브라우저 자동 오픈 생략(테스트용). */
	open?: boolean;
	/** 게이트 서버 준비 시 URL 통보(테스트/디버그용). async 면 완료를 기다린다. */
	onReady?: (url: string) => void | Promise<void>;
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
	/** 게이트 열린 동안 사용자가 보낸 실시간 채팅(에이전트가 답변/수정 대상). 결정 이벤트일 때는 undefined. */
	chatPending?: ChatMessage[];
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
		await closeGate(root, feature); // 영속 게이트 정리(멱등 — 이미 닫혀 있으면 no-op).
		return complete(state.stage);
	}

	const def = stageById(state.stage);

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
			message: `Stage ${state.stage}(${def.name}) 산출물을 마크다운으로 작성하라. 작성이 끝나면 factorynote_plan 의 artifactMd 에 담아 다시 호출해 게이트(사용자 검토)를 열어라. 코드는 쓰지 않는다.`,
		};
	}

	return await runOpenGate(input, state, def, false);
}

/**
 * 게이트 오픈 → 결정 → 결정 적용·저장 → 다음 안내 반환.
 * resume=true 이면 인터럽트 복구로 게이트 재오픈임을 message 에 표시한다.
 * 게이트 결정 이후 흐름(artifactMd 채택, applyVerdict, 저장)은 기존과 동일.
 */
async function runOpenGate(
	input: DrivePlanInput,
	stateIn: PipelineState,
	def: ReturnType<typeof stageById>,
	resume: boolean,
): Promise<DrivePlanOutput> {
	const { root, viewerDistDir, feature, signal } = input;
	let state = stateIn;

	// 채팅 재진입: 에이전트 답변(chatResponse)을 채팅 로그에 push(뷰어가 GET /api/chat 로 표시).
	if (input.chatResponse !== undefined) {
		appendAgentChat(root, feature, input.chatResponse);
	}
	// 산출물 저장(산출물 단계 + 신규/수정 제출시만 — resume 은 이미 디스크에 있으므로 건너뜀).
	if (!resume && input.artifactMd !== undefined && def.artifactFile) {
		await writeArtifact(root, feature, def.artifactFile, input.artifactMd);
	}

	// 게이트 오픈 → 웹에서 결정 또는 실시간 채팅 대기(블로킹).
	state = markArtifactReady(state);
	await saveState(root, state);
	const event = await runGate({
		root,
		feature,
		viewerDistDir,
		timeoutMs: GATE_TIMEOUT_MS,
		...(signal ? { signal } : {}),
		...(input.open !== undefined ? { open: input.open } : {}),
		...(input.onReady ? { onReady: input.onReady } : {}),
	});

	// 채팅 이벤트: 게이트를 유지한 채 에이전트에게 chatPending 반환.
	// 루프카운트 불변(applyVerdict 를 타지 않음 = 사전 다듬기). 에이전트는 chatResponse(±수정 artifactMd)로 재호출.
	if (event.kind === "chat") {
		const hasBlock = event.messages.some((m) => m.blockId);
		return {
			done: false,
			stage: state.stage,
			stageName: def.name,
			needArtifact: false,
			designPrompt: def.designPrompt,
			feedbackChecklist: [...def.feedbackChecklist],
			gateResult: null,
			chatPending: event.messages,
			message:
				`사용자가 채팅으로 질문/수정을 요청했다${hasBlock ? "(블록 지정 포함 — 부분 코멘트)" : ""}. ` +
				`질문이면 답변을 chatResponse 로, 산출물 수정이면 고쳐 artifactMd(와 답변 chatResponse)로 factorynote_plan 을 다시 호출해 게이트를 유지한 채 반영하라. ` +
				`최종 확정/수정/정정은 사용자가 게이트 바로 한다(채팅 수정은 루프카운트에 포함되지 않는다).\n` +
				event.messages.map(formatChat).join("\n"),
		};
	}

	const decision = event.decision;

	// Stage 2(설계)에서 사용자가 직접 편집한 마크다운을 산출물로 채택(저장).
	// 직접 편집 → 에이전트 채택: 사용자의 편집 결과가 곧 산출물(5대 원칙 — 게이트 거쳐 채택).
	// Stage 1/3 은 에이전트 전용(뷰어가 artifactMd 를 보내지 않음)이라 여기엔 도달하지 않는다.
	if (decision.artifactMd !== undefined && def.artifactFile) {
		await writeArtifact(root, feature, def.artifactFile, decision.artifactMd);
	}

	// 결정 적용·저장.
	state = applyVerdict(state, decision);
	// FR-7: 회귀(revert) 시 대상 단계(state.stage) 이후 산출물 자동 무효화(삭제).
	if (decision.verdict === "revert") {
		await invalidateArtifactsAfter(root, feature, state.stage);
	}
	await saveState(root, state);

	if (isComplete(state)) {
		await closeGate(root, feature); // 플랜 완료 → 영속 게이트 종료(탭 마감).
		return complete(state.stage);
	}

	// 다음에 에이전트가 해야 할 일 안내.
	const nextDef = stageById(state.stage);
	const needNext = requiresArtifact(state.stage);
	const commentsBlock = `\n코멘트:\n${formatComments(decision.comments)}`;
	// FR-2: modify 가 반복 상한에 도달한 경우 단순 재작성 안내 대신 명시적 에스컬레이션
	// (잔존 이슈 노출 + 근본 갈등 신호 + 회귀/재협의 옵션) 로 전환.
	const escalated = decision.verdict === "modify" && atLoopCeiling(state);
	const base = escalated
		? `⚠ FR-2 에스컬레이션: Stage ${state.stage}(${nextDef.name}) 가 ${state.loopCount}회 수정되었으나 아래 이슈가 잔존한다. 이는 근본적 설계 갈등의 신호일 수 있으니 같은 방식의 단순 재작성 반복은 피하라. 선택: (a) 코멘트를 근본적으로 반영해 재작성 (b) 이전 단계로 회귀해 설계 전제 재검토 (c) 범위·제약 조건을 사용자와 재협의. 잔존 이슈:${commentsBlock}`
		: decision.verdict === "modify"
			? `사용자가 Stage ${state.stage}(${nextDef.name}) 산출물의 수정을 요청했다(Stage 2 면 직접 편집 분량이 채택 저장됨). 코멘트를 반영해 산출물을 재작성 후 artifactMd 와 함께 다시 제출하라.${commentsBlock}`
			: `Stage ${state.stage}(${nextDef.name}) 승인. 다음 단계로 진행. 산출물을 작성해 artifactMd 와 함께 제출하라.`;
	const message = (resume ? "[게이트 재오픈(인터럽트 복구)] " : "") + base;

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
		stageName: STAGES[2]!.name,
		needArtifact: false,
		designPrompt: "",
		feedbackChecklist: [],
		gateResult: null,
		message:
			"파이프라인 완료 — 3단계 모두 사용자 승인됨. 계획 산출물은 .factorynote/<feature>/ 에 저장되었다. plan 모드는 자동으로 해제되었다(이제 구현 가능).",
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

/** 채팅 메시지를 에이전트 안내용 텍스트로 포맷(블록 지정 시 표시). */
function formatChat(m: ChatMessage): string {
	const block = m.blockId ? ` [블록 ${m.blockId}]` : "";
	const quote = m.quote ? ` (인용: "${m.quote}")` : "";
	return `- ${block}${quote} ${m.text}`;
}
