// factorynote_plan 도구 드라이버 — 3단계 게이트 파이프라인의 단일 진입.
// Tier 1: Director 에이전트가 Design·Feedback 자식을 스폰해 내부 루프를 돌리고,
// 클린 판정(또는 상한 에스컬레이션) 시에만 사용자 게이트를 연다.
// 본 드라이버는 core 의 nextDesignFeedbackStep(순수 전이) 로 단계 지시문을 만들어
// 에이전트에게 반환한다. pi 확장 코드는 서브에이전트를 동기 스폰할 수 없으므로,
// 실제 스폰은 Director 에이전트가 자신의 subagent 도구로 수행한다(에이전트 매개).
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
	nextDesignFeedbackStep,
	parseFeedback,
	readArtifact,
	requiresArtifact,
	saveState,
	stageById,
	writeArtifact,
	type GateDecision,
	type PipelineState,
} from "@factorynote/core";
import type {
	DesignFeedbackDirective,
	DesignFeedbackReport,
} from "@factorynote/core";
import { runGate, closeGate } from "./gate-server.ts";

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
	/** 자식에게 줄 과제(subagent 도구의 task). */
	spawnTask?: string;
	/** 내부 Design↔Feedback 루프 카운트(안내용). */
	dfLoop: number;
	designPrompt: string;
	feedbackChecklist: string[];
	gateResult: GateDecision | null;
	message: string;
	/** 사용자에게 열린 게이트 URL(디버그/안내용). */
	gateUrl?: string;
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
		const t = nextDesignFeedbackStep(
			def,
			{ dfPhase: state.dfPhase, dfLoop: state.dfLoop },
			report,
			draft,
		);
		state = { ...state, dfPhase: t.dfPhase, dfLoop: t.dfLoop };
		const d = t.directive;

		if (d.action === "spawn-design" || d.action === "spawn-feedback") {
			await saveState(root, state);
			return spawnDirective(state, def, d);
		}
		// gate 지시문: 산출물 저장 + 게이트 오픈(에스컬레이션 프레이밍 반영).
		return await runOpenGate(
			input,
			state,
			def,
			d.artifact,
			false,
			d.escalated ? { issues: d.issues, loops: d.loops } : undefined,
		);
	}

	// 도달 불가(모든 단계가 산출물 단계) — 안전 추락.
	await saveState(root, state);
	return spawnDirective(state, def, {
		action: "spawn-design",
		task: def.designPrompt,
		loop: state.dfLoop,
	});
}

/** spawn 지시문 반환 — 에이전트에게 자식 스폰을 지시. */
function spawnDirective(
	state: PipelineState,
	def: ReturnType<typeof stageById>,
	d: Extract<
		DesignFeedbackDirective,
		{ action: "spawn-design" | "spawn-feedback" }
	>,
): DrivePlanOutput {
	const role = d.action === "spawn-design" ? "design" : "feedback";
	const verb =
		role === "design"
			? `Design 자식 에이전트를 스폰해 ${def.artifact} 산출물을 작성하게 하라`
			: "Feedback 자식 에이전트를 스폰해 산출물을 비판 검토하게 하라";
	const report =
		role === "design"
			? "Design 스폰 결과(산출물 초안)를 designArtifact 에 담아 factorynote_plan 을 다시 호출하라."
			: "Feedback 스폰 결과(첫 줄 CLEAN 또는 ISSUES)를 feedbackResult 에, 현 산출물 초안을 designArtifact 에 담아 factorynote_plan 을 다시 호출하라.";
	const loopNote =
		d.action === "spawn-design"
			? ` (내부 Design↔Feedback 루프 ${d.loop + 1}회차)`
			: "";
	const message = [
		`Stage ${state.stage}(${def.name}). subagent 도구로 ${verb}.${loopNote}`,
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

	// 산출물 저장(resume 은 이미 디스크에 있으므로 생략).
	if (!resume && def.artifactFile) {
		await writeArtifact(root, feature, def.artifactFile, artifactToWrite);
	}

	// 게이트 오픈 → 웹에서 결정 대기(블로킹).
	state = markArtifactReady(state);
	await saveState(root, state);
	const decision = await runGate({
		root,
		feature,
		viewerDistDir,
		timeoutMs: GATE_TIMEOUT_MS,
		...(signal ? { signal } : {}),
		...(input.open !== undefined ? { open: input.open } : {}),
		...(input.onReady ? { onReady: input.onReady } : {}),
	});

	// 그래프 단계(Stage 2)에서 사용자가 직접 편집한 그래프를 산출물로 채택.
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

	return {
		done: false,
		stage: state.stage,
		stageName: nextDef.name,
		nextAction: "spawn-design",
		spawnRole: "design",
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
