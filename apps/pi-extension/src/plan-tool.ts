// factorynote_plan 도구 드라이버 — 3단계 게이트 파이프라인의 단일 진입.
// Tier 1: Director 에이전트가 Design·Feedback 자식을 스폰해 내부 루프를 돌리고,
// 클린 판정(또는 상한 에스컬레이션) 시에만 사용자 게이트를 연다.
// 본 드라이버는 core 의 nextDesignFeedbackStep(순수 전이) 로 단계 지시문을 만들어
// 에이전트에게 반환한다. pi 확장 코드는 서브에이전트를 동기 스폰할 수 없으므로,
// 실제 스폰은 Director 에이전트가 자신의 subagent 도구로 수행한다(에이전트 매개).
// 코어(@factorynote/core) 상태기계 + gate-server(웹 게이트) 를 연결.
import {
	CHILD_SPAWN_OPTIONS,
	STAGES,
	applyVerdict,
	atLoopCeiling,
	designTask,
	initialState,
	invalidateArtifactsAfter,
	isComplete,
	loadState,
	markArtifactReady,
	nextDesignFeedbackStep,
	parseFeedback,
	readArtifact,
	requiresArtifact,
	saveState,
	stageById,
	writeArtifact,
	type ArtifactPaths,
	type ChatMessage,
	type GateDecision,
	type PipelineState,
	type SpawnOptions,
} from "@factorynote/core";
import type {
	DesignFeedbackDirective,
	DesignFeedbackReport,
} from "@factorynote/core";
import { join } from "node:path";
import {
	appendAgentChat,
	closeGate,
	observeGate,
	runGate,
} from "./gate-server.ts";

/** #4 게이트 자동 만료(ms) — 사용자 이탈 시 좀비 게이트 방지. 30분. */
const GATE_TIMEOUT_MS = 30 * 60 * 1000;

export interface DrivePlanInput {
	root: string;
	/** 뷰어 빌드 산출물(dist) 디렉토리. */
	viewerDistDir: string;
	feature: string;
	/** Design 스폰 결과(산출물 초안). Feedback 보고 시에도 현 초안을 함께 전달. */
	designArtifact?: string;
	/** Feedback 스폰 결과(raw 판정 텍스트 — CLEAN/ISSUES 규약). 보고 시에만. */
	feedbackResult?: string;
	/** 이전 게이트에서 받은 채팅에 대한 에이전트 답변(게이트 유지 채팅 루프). 미사용 시 무시. */
	chatResponse?: string;
	/** true 면 게이트 결정을 기다리지 않고 즉시 confirm(auto-advance). 관찰용 브라우저는 옴. */
	autoAdvance?: boolean;
	signal?: AbortSignal;
	/** false 면 브라우저 자동 오픈 생략(테스트용). */
	open?: boolean;
	/** 게이트 서버 준비 시 URL 통보(테스트/디버그용). async 면 완료를 기다린다. */
	onReady?: (url: string) => void | Promise<void>;
}

/** 에이전트가 factorynote_plan 반환 후 할 다음 행동. */
export type NextAction = "spawn-design" | "spawn-feedback" | "done";

export interface DrivePlanOutput {
	done: boolean;
	stage: number;
	stageName: string;
	/** 다음 행동. spawn-* 시 spawnRole/spawnTask 로 자식 스폰. done 시 종료. */
	nextAction: NextAction;
	/** 자식 스폰 역할(nextAction 이 spawn-* 일 때). */
	spawnRole?: "design" | "feedback";
	/** 자식 스폰 과제(subagent 도구의 task). */
	spawnTask?: string;
	/** 자식 스폰 컨텍스트 제약(core 정책) — Director 가 subagent skill/context/toolBudget 로 적용. */
	spawnOptions?: SpawnOptions;
	/** Design 자식이 산출물을 쓸 파일 경로(파일 프로토콜). designArtifact 보고는 이 경로로. */
	draftPath?: string;
	/** Feedback 자식이 상세 리뷰를 쓸 파일 경로. */
	feedbackPath?: string;
	/** 내부 Design↔Feedback 루프 카운트(안내용). */
	dfLoop: number;
	designPrompt: string;
	feedbackChecklist: string[];
	gateResult: GateDecision | null;
	message: string;
	/** 사용자에게 열린 게이트 URL(디버그/안내용). */
	gateUrl?: string;
	/** 게이트 열린 동안 사용자가 보낸 실시간 채팅(에이전트가 chatResponse 로 답변). */
	chatPending?: ChatMessage[];
}

/**
 * 현 stage 산출물 교환 파일 경로(파일 프로토콜) — designPrompt(불변)·draft·feedback.
 * Director 는 이 경로들로 자식에게 쓰게 하고 보고도 경로로 받는다(Director 컨텍스트 누적 차단).
 */
function resolvePaths(
	root: string,
	feature: string,
	def: ReturnType<typeof stageById>,
): { paths: ArtifactPaths; draftFile: string } {
	const dir = join(root, feature);
	const ext = "md"; // Tier 1 도 마크다운 단일진실(develop 통일) — 그래프는 md 내장.
	const draftFile = `draft.${ext}`;
	return {
		paths: {
			designPrompt: join(dir, "design-prompt.md"),
			draft: join(dir, draftFile),
			feedback: join(dir, "feedback.md"),
		},
		draftFile,
	};
}

/** 입력(에이전트 보고) → 코어 보고 객체. dfPhase 로 design/feedback 보고 구분. */
function deriveReport(
	input: DrivePlanInput,
	state: PipelineState,
): DesignFeedbackReport | undefined {
	if (input.feedbackResult !== undefined) {
		return { role: "feedback", outcome: parseFeedback(input.feedbackResult) };
	}
	if (input.designArtifact !== undefined && state.dfPhase === "design") {
		return { role: "design", draft: input.designArtifact };
	}
	return undefined;
}

/**
 * 파이프라인 1스텝 구동. Tier 1 오케스트레이션:
 *  - 산출물 단계 & 게이트 닫힘 → nextDesignFeedbackStep 로 내부 루프를 1스텝 전이.
 *    spawn-design/spawn-feedback 지시문 → 에이전트가 자식 스폰 후 보고.
 *    gate 지시문(클린/상한) → 산출물 저장 + 사용자 게이트 오픈(블로킹 결정).
 *  - 게이트 결정 후 → 다음/재시작 단계의 spawn-design 으로 안내(또는 done).
 */
export async function drivePlan(
	input: DrivePlanInput,
): Promise<DrivePlanOutput> {
	const { root, feature } = input;

	let state = await loadState(root, feature);
	if (!state) state = initialState(feature);
	if (state.done) {
		await closeGate(root, feature); // 영속 게이트 정리(멱등).
		return complete(state.stage);
	}

	const def = stageById(state.stage);

	// #3 인터럽트 복구: 게이트가 열린 채 끊겼고 산출물이 디스크에 있으면 재오픈.
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

	// Tier 1 오케스트레이션: 산출물 단계 & 게이트 닫힘 → 내부 루프 1스텝.
	if (requiresArtifact(state.stage) && !state.gateOpen) {
		const report = deriveReport(input, state);
		const draft = input.designArtifact;
		// 파일 프로토콜: 큰 페이로드(designPrompt/draft/feedback)를 파일로,
		// spawnTask/보고는 경로만 — Director(영구) 컨텍스트 누적 차단(1261 방지).
		const { paths, draftFile } = resolvePaths(root, feature, def);
		// designPrompt(stage 불변) 파일 기록 — 자식이 읽도록. 멱등(정적 내용).
		await writeArtifact(root, feature, "design-prompt.md", def.designPrompt);
		const t = nextDesignFeedbackStep(
			def,
			{ dfPhase: state.dfPhase, dfLoop: state.dfLoop },
			report,
			draft,
			paths,
		);
		state = { ...state, dfPhase: t.dfPhase, dfLoop: t.dfLoop };
		const d = t.directive;

		if (d.action === "spawn-design" || d.action === "spawn-feedback") {
			await saveState(root, state);
			return spawnDirective(state, def, d, paths);
		}
		// gate 지시문: draft 파일 경로 → 내용 resolve 후 게이트 저장·표시.
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

	// 도달 불가(모든 단계가 산출물 단계) — 안전 추락.
	await saveState(root, state);
	const { paths: fallbackPaths } = resolvePaths(root, feature, def);
	return spawnDirective(
		state,
		def,
		{
			action: "spawn-design",
			task: designTask(def, fallbackPaths),
			loop: state.dfLoop,
			spawnOptions: CHILD_SPAWN_OPTIONS,
		},
		fallbackPaths,
	);
}

/** spawn 지시문 반환 — 에이전트에게 자식 스폰을 지시(파일 프로토콜 + 스폰 옵션). */
function spawnDirective(
	state: PipelineState,
	def: ReturnType<typeof stageById>,
	d: Extract<
		DesignFeedbackDirective,
		{ action: "spawn-design" | "spawn-feedback" }
	>,
	paths: ArtifactPaths,
): DrivePlanOutput {
	const role = d.action === "spawn-design" ? "design" : "feedback";
	const verb =
		role === "design"
			? `Design 자식 에이전트를 스폰해 ${def.artifact} 산출물을 작성하게 하라`
			: "Feedback 자식 에이전트를 스폰해 산출물을 비판 검토하게 하라";
	// 파일 프로토콜 보고 지시: 자식은 파일에 쓰고 반환은 경로/판정만. Director 컨텍스트 누적 차단.
	const report =
		role === "design"
			? `Design 자식은 산출물을 파일(${paths.draft})에 쓰고 반환은 그 경로만 한다(본문 금지). designArtifact 에는 경로만 담아 factorynote_plan 을 다시 호출하라.`
			: `Feedback 자식은 상세 리뷰를 파일(${paths.feedback})에 쓰고 반환은 판정(CLEAN/ISSUES)만 한다. feedbackResult 에 판정을, designArtifact 에 ${paths.draft} 경로를 담아 factorynote_plan 을 다시 호출하라.`;
	const opts = d.spawnOptions;
	const optLine = `스폰 옵션(필수 적용): skill=${opts.skill}, context="${opts.context}", toolBudget.block=[${opts.toolBudgetBlock.join(", ")}]`;
	const loopNote =
		d.action === "spawn-design"
			? ` (내부 Design↔Feedback 루프 ${d.loop + 1}회차)`
			: "";
	const message = [
		`Stage ${state.stage}(${def.name}). subagent 도구로 ${verb}.${loopNote}`,
		optLine,
		report,
		"코드는 쓰지 않는다(계획만).",
	].join("\n");

	return {
		done: false,
		stage: state.stage,
		stageName: def.name,
		nextAction: d.action,
		spawnRole: role,
		spawnTask: d.task,
		spawnOptions: d.spawnOptions,
		draftPath: paths.draft,
		feedbackPath: paths.feedback,
		dfLoop: state.dfLoop,
		designPrompt: def.designPrompt,
		feedbackChecklist: [...def.feedbackChecklist],
		gateResult: null,
		message,
	};
}

/**
 * 게이트 오픈 → 결정 → 결정 적용·저장 → 다음 안내 반환.
 * artifactToWrite = 게이트에 저장·표시할 산출물(클린 판정본 또는 에스컬레이션 초안).
 * internalEscalation = 내부 루프 상한 도달 시 에스컬레이션 프레이밍(없으면 일반 오픈).
 * resume = 인터럽트 복구 재오픈(산출물 재저장 생략).
 */
async function runOpenGate(
	input: DrivePlanInput,
	stateIn: PipelineState,
	def: ReturnType<typeof stageById>,
	artifactToWrite: string,
	resume: boolean,
	internalEscalation?: { issues: string[]; loops: number },
): Promise<DrivePlanOutput> {
	const { root, viewerDistDir, feature, signal } = input;
	let state = stateIn;

	// 채팅 재진입: 에이전트 답변(chatResponse)을 채팅 로그에 push(뷰어가 GET /api/chat 로 표시).
	if (input.chatResponse !== undefined) {
		appendAgentChat(root, feature, input.chatResponse);
	}
	// 산물 저장(resume 은 이미 디스크에 있으므로 생략).
	if (!resume && def.artifactFile) {
		await writeArtifact(root, feature, def.artifactFile, artifactToWrite);
	}

	// 게이트 오픈 → 웹에서 결정 또는 실시간 채팅 대기(블로킹).
	state = markArtifactReady(state);
	await saveState(root, state);

	let decision: GateDecision;
	if (input.autoAdvance) {
		// auto-advance: 게이트 서버 오픈(관찰용) 후 결정 대기 없이 즉시 confirm.
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

		// 채팅 이벤트: 게이트를 유지한 채 에이전트에게 chatPending 반환.
		// 에이전트는 chatResponse(± Design 자식 재작성 designArtifact)로 재호출.
		if (event.kind === "chat") {
			const hasBlock = event.messages.some((m) => m.blockId);
			return {
				done: false,
				stage: state.stage,
				stageName: def.name,
				nextAction: "spawn-design",
				dfLoop: state.dfLoop,
				designPrompt: def.designPrompt,
				feedbackChecklist: [...def.feedbackChecklist],
				gateResult: null,
				chatPending: event.messages,
				message:
					`사용자가 채팅으로 질문/수정을 요청했다${hasBlock ? "(블록 지정 포함 — 부분 코멘트)" : ""}. ` +
					`질문이면 답변을 chatResponse 로, 산물 수정이 필요하면 Design 자식 스폰으로 재작성해 designArtifact(초안 경로)와 답변 chatResponse 를 담아 factorynote_plan 을 다시 호출하라(게이트 유지).\n` +
					event.messages.map(formatChat).join("\n"),
			};
		}

		decision = event.decision;

		// Stage 2(설계)에서 사용자가 직접 편집한 마크다운을 산물로 채택(저장).
		if (decision.artifactMd !== undefined && def.artifactFile) {
			await writeArtifact(root, feature, def.artifactFile, decision.artifactMd);
		}
	}

	// 결정 적용·저장.
	state = applyVerdict(state, decision);
	if (decision.verdict === "revert") {
		await invalidateArtifactsAfter(root, feature, state.stage);
	}
	await saveState(root, state);

	if (isComplete(state)) {
		await closeGate(root, feature);
		return complete(state.stage);
	}

	// 다음 안내. 세 가지 에스컬레이션/일반 분기:
	//  (i)  게이트 오픈 원인이 내부 루프 상한이었던 경우 → 내부 에스컬레이션 프레이밍.
	//  (ii) 사용자 modify 가 반복 상한(loopCount) → FR-2 modify 에스컬레이션(기존).
	//  (iii)그 외 일반 next/modify 안내.
	const nextDef = stageById(state.stage);
	const commentsBlock = `\n코멘트:\n${formatComments(decision.comments)}`;
	let base: string;
	if (internalEscalation) {
		base = `⚠ 내부 Design↔Feedback 루프 상한(${internalEscalation.loops}회) 도달 — Design↔Feedback 이 수렴하지 못하고 아래 이슈가 잔존한다. 근본적 설계 갈등의 신호일 수 있으니 같은 방식의 단순 재작성 반복은 피하라. 게이트에서 결정: (a) 코멘트로 근본적 재작성 지시 (b) 이전 단계로 회귀 (c) 범위·제약 조건 재협의. 잔존 이슈:\n${internalEscalation.issues.map((i) => `- ${i}`).join("\n")}`;
	} else if (decision.verdict === "modify" && atLoopCeiling(state)) {
		base = `⚠ FR-2 에스컬레이션: Stage ${state.stage}(${nextDef.name}) 가 ${state.loopCount}회 수정되었으나 아래 이슈가 잔존한다. 이는 근본적 설계 갈등의 신호일 수 있으니 같은 방식의 단순 재작성 반복은 피하라. 선택: (a) 코멘트를 근본적으로 반영해 재작성 (b) 이전 단계로 회귀해 설계 전제 재검토 (c) 범위·제약 조건을 사용자와 재협의. 잔존 이슈:${commentsBlock}`;
	} else if (decision.verdict === "modify") {
		base = `사용자가 Stage ${state.stage}(${nextDef.name}) 산출물의 수정을 요청했다. 코멘트를 반영해 Design 자식에게 재작성시킬 것.${commentsBlock}`;
	} else {
		base = `Stage ${state.stage}(${nextDef.name}) 승인. 다음 단계로 진행 — Design 자식 스폰부터 새 내부 루프를 시작한다.`;
	}
	const message = (resume ? "[게이트 재오픈(인터럽트 복구)] " : "") + base;

	const nextPaths = resolvePaths(root, feature, nextDef).paths;
	return {
		done: false,
		stage: state.stage,
		stageName: nextDef.name,
		nextAction: "spawn-design",
		spawnRole: "design",
		spawnOptions: CHILD_SPAWN_OPTIONS,
		draftPath: nextPaths.draft,
		feedbackPath: nextPaths.feedback,
		dfLoop: state.dfLoop,
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
		nextAction: "done",
		dfLoop: 0,
		designPrompt: "",
		feedbackChecklist: [],
		gateResult: null,
		message:
			"파이프라인 완료 — 3단계 모두 사용자 승인됨. 계획 산출물은 .factorynote/<feature>/ 에 저장되었다. plan 모드는 자동으로 해제되었다(이제 구현 가능).",
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
