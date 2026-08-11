// factorynote_plan 도구 드라이버 — 3단계 게이트 파이프라인의 단일 진입.
// Tier 1(ADR-014 동적 feedback 에이전트): Director 가 현 단계 메뉴에서 상황에 맞는 N개를
// 추려 병렬 스폰(runs.all) → 집합 보고 → 조건부 수정 → 게이트. 기본 사이클=DEFAULT_MAX_LOOPS(1).
// '검토 요청' 버튼이 게이트 열린 동안 +1 사이클을 런타임 강제.
// pi 확장 코드는 서브에이전트를 동기 스폰할 수 없으므로, 스폰은 Director 가 subagent 도구로 수행.
import {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_FEEDBACK_LEVEL,
	DEFAULT_MAX_LOOPS,
	GRAPH_REF_RE,
	STAGES,
	applyVerdict,
	atLoopCeiling,
	clampReportInput,
	designTask,
	feedbackLevelCountSpec,
	feedbackMenuForStage,
	graphJsonNameFor,
	graphRefFile,
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
	type FeedbackAgent,
	type FeedbackLevel,
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

/** #4 게이트 자동 만료(ms). 30분. */
const GATE_TIMEOUT_MS = 30 * 60 * 1000;

/** ADR-017: 라우터 호출 수 제한 실패 시 3-4개 순차 배치 분할 프로토콜 문구. */
const FEEDBACK_BATCH_SPLIT_RULE =
	"스폰이 에이전트 호출 수/레이트 리밋 에러로 실패하면 선택 에이전트를 3-4개씩 순차 배치로 나눠 재시도하고, 전 배치 판정을 하나의 집합 보고로 합친다.";

export interface DrivePlanInput {
	root: string;
	viewerDistDir: string;
	feature: string;
	designArtifact?: string;
	feedbackResult?: string;
	chatResponse?: string;
	/** Feedback 수준(ADR-017). 미지정 시 DEFAULT_FEEDBACK_LEVEL(medium). */
	feedbackLevel?: FeedbackLevel;
	autoAdvance?: boolean;
	signal?: AbortSignal;
	open?: boolean;
	onReady?: (url: string) => void | Promise<void>;
}

export type NextAction = "spawn-design" | "spawn-feedback" | "done";

export interface DrivePlanOutput {
	done: boolean;
	stage: number;
	stageName: string;
	nextAction: NextAction;
	spawnRole?: "design" | "feedback";
	spawnTask?: string;
	spawnOptions?: SpawnOptions;
	draftPath?: string;
	feedbackPath?: string;
	/** 현 단계 feedback 메뉴 파일 경로(Director 동적 선택용). */
	menuPath?: string;
	/** 현 Feedback 수준(ADR-017) — spawn-feedback 일 때 에이전트 수 결정 기준. */
	feedbackLevel?: FeedbackLevel;
	dfLoop: number;
	designPrompt: string;
	gateResult: GateDecision | null;
	message: string;
	gateUrl?: string;
	chatPending?: ChatMessage[];
}

/** 현 stage 산출물 교환 파일 경로 + feedback 메뉴 파일. */
function resolvePaths(
	root: string,
	feature: string,
	_def: ReturnType<typeof stageById>,
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
function buildMenuMarkdown(
	def: ReturnType<typeof stageById>,
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

/**
 * Director 의 에이전트별 집합 보고(raw) → outcomes.
 * 규약: 각 에이전트를 "[name]" 헤더 + 판정. 헤더/이름 누락 시 안전 기본 ISSUES.
 */
function parseFeedbackBatch(
	raw: string,
	menu: FeedbackAgent[],
): { axis: string; outcome: ReturnType<typeof parseFeedback> }[] {
	const lines = raw.split("\n");
	const sections = new Map<string, string[]>();
	let cur: string | null = null;
	for (const line of lines) {
		const m = line.match(/^\[([^\]]+)\]\s*$/);
		if (m) {
			cur = m[1]!.trim();
			if (!sections.has(cur)) sections.set(cur, []);
			continue;
		}
		if (cur) sections.get(cur)!.push(line);
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
function deriveReport(
	input: DrivePlanInput,
	state: PipelineState,
	def: ReturnType<typeof stageById>,
): DesignFeedbackReport | undefined {
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

/** 파이프라인 1스텝 구동. Tier 1 동적 feedback 에이전트 오케스트레이션(ADR-014). */
export async function drivePlan(
	input: DrivePlanInput,
): Promise<DrivePlanOutput> {
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

	if (requiresArtifact(state.stage) && !state.gateOpen) {
		const feedbackLevel = input.feedbackLevel ?? DEFAULT_FEEDBACK_LEVEL;
		const report = deriveReport(input, state, def);
		const draft = input.designArtifact;
		const { paths, draftFile } = resolvePaths(root, feature, def);
		// designPrompt(불변) + feedback 메뉴(현 단계) 파일 기록 — 자식/Director 가 읽도록.
		await writeArtifact(root, feature, "design-prompt.md", def.designPrompt);
		await writeArtifact(
			root,
			feature,
			"feedback-menu.md",
			buildMenuMarkdown(def, feedbackLevel),
		);
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

/** spawn 지시문 반환 — 에이전트에게 자식 스폰을 지시(파일 프로토콜 + 스폰 옵션). */
function spawnDirective(
	state: PipelineState,
	def: ReturnType<typeof stageById>,
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

/** 게이트 오픈 → 결정/채팅/검토요청 → 처리 → 다음 안내 반환. */
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

	if (input.chatResponse !== undefined) {
		appendAgentChat(root, feature, input.chatResponse);
	}
	if (!resume && def.artifactFile) {
		await writeArtifact(
			root,
			feature,
			def.artifactFile,
			await promoteGraphArtifact(
				root,
				feature,
				def.artifactFile,
				artifactToWrite,
			),
		);
	}

	state = markArtifactReady(state);
	await saveState(root, state);

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
	const message = (resume ? "[게이트 재오픈(인터럽트 복구)] " : "") + base;

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

/** 게이트 오픈 시 draft 의 그래프 json 을 산출물과 같은 stageN/ 폴더로 승격(ADR-016).
 * md 의 참조 코멘트를 최종 json 파일명으로 다시 쓰고, 원본 json 을 동반 저장한다.
 * 참조 없거나 원본 json 없으면 md 만 반환(그래프 없는 산출물·참조 불량 둘 다 안전). */
async function promoteGraphArtifact(
	root: string,
	feature: string,
	artifactFile: string,
	md: string,
): Promise<string> {
	const ref = graphRefFile(md);
	if (!ref) return md;
	const finalJson = graphJsonNameFor(artifactFile);
	const rewritten = md.replace(GRAPH_REF_RE, `<!-- graph: ${finalJson} -->`);
	if (ref !== finalJson) {
		const raw = await readArtifact(root, feature, ref);
		if (raw !== undefined) {
			await writeArtifact(root, feature, finalJson, raw);
		}
	}
	return rewritten;
}

function complete(stage: number): DrivePlanOutput {
	return {
		done: true,
		stage,
		stageName: STAGES[2]!.name,
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
