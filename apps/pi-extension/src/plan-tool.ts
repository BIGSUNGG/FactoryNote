// factorynote_plan 도구 드라이버 — 동적 구성 게이트 파이프라인의 단일 진입.
// 디렉터(Tier 1)가 첫 호출에서 스테이지 구성(종류·개수·순서)을 stages 파라미터로 결정하면
// core 가 영속화하고, 이후 단계는 구성 순서대로 진행. 구성 승인 게이트 없음(디렉터 전권).
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
	STAGE_CATALOG,
	STAGE_KINDS,
	checkRequiredGraph,
	designRevisionTask,
	designTask,
	initialState,
	isStageKind,
	loadState,
	nextDesignFeedbackStep,
	readArtifact,
	saveState,
	stageDefAt,
	writeArtifact,
} from "@factorynote/core";
import type {
	ArtifactPaths,
	FeedbackLevel,
	PipelineState,
	StageDefinition,
	StageKind,
} from "@factorynote/core";
import type { DrivePlanInput, DrivePlanOutput } from "./plan-types.ts";
import { buildMenuMarkdown, deriveReport, resolvePaths } from "./plan-paths.ts";
import { spawnDirective } from "./plan-directive.ts";
import { runOpenGate } from "./plan-gate.ts";
import { closeGate } from "./gate-server.ts";

export type {
	DrivePlanInput,
	DrivePlanOutput,
	NextAction,
} from "./plan-types.ts";

/** Stage 2 그래프 강제(ADR-019): design 보고에 필수 그래프 트리가 없으면
 *  Feedback 전 재작성 반려(루프 상한 내) 또는 게이트 에스컬레이션(상한 소진).
 *  이슈 없음(또는 비대상)이면 null — 이후 nextDesignFeedbackStep 으로 정상 진행. */
async function enforceRequiredGraph(opts: {
	input: DrivePlanInput;
	state: PipelineState;
	def: StageDefinition;
	paths: ArtifactPaths;
	draftFile: string;
	feedbackLevel: FeedbackLevel;
	report: ReturnType<typeof deriveReport>;
}): Promise<DrivePlanOutput | null> {
	const { input, state, def, paths, draftFile, feedbackLevel, report } = opts;
	if (report?.role !== "design" || def.graph !== "required") return null;
	const graphIssue = await checkRequiredGraph(
		input.root,
		input.feature,
		draftFile,
	);
	if (!graphIssue) return null;
	if (state.dfLoop < DEFAULT_MAX_LOOPS) {
		const next = { ...state, dfLoop: state.dfLoop + 1 };
		await saveState(input.root, next);
		return spawnDirective(
			next,
			def,
			{
				action: "spawn-design",
				task: designRevisionTask(def, [graphIssue], paths),
				loop: next.dfLoop,
				spawnOptions: CHILD_SPAWN_OPTIONS.design,
			},
			paths,
			feedbackLevel,
		);
	}
	// 상한 소진: 게이트로 에스컬레이션해 사용자 판단에 맡긴다(Feedback 미수렴과 동일 기제).
	const escalated = { ...state, dfPhase: "design" as const, dfLoop: 0 };
	const gateArtifact =
		(await readArtifact(input.root, input.feature, draftFile)) ?? "";
	return runOpenGate(input, escalated, def, gateArtifact, false, {
		issues: [graphIssue],
		loops: DEFAULT_MAX_LOOPS,
	});
}

/** 구성 메뉴(종류 카탈로그) 마크다운 — compose 지시문에 담아 Director 에게 전달. */
function catalogMenu(): string {
	const lines = [
		"| kind | 단계 | 산출물 | 그래프 |",
		"| --- | --- | --- | --- |",
	];
	for (const kind of STAGE_KINDS) {
		const d = STAGE_CATALOG[kind];
		lines.push(`| ${kind} | ${d.name} | ${d.artifact} | ${d.graph} |`);
	}
	return lines.join("\n");
}

/** 첫 호출(상태 없음)인데 구성 미제출 → 구성 요청(compose) 지시문. */
function composeRequest(maxStages: number | undefined): DrivePlanOutput {
	const capLine =
		maxStages !== undefined
			? `최대 스테이지 개수 상한: **${maxStages}개** — 이 개수를 초과해 구성할 수 없다(사용자 지정).`
			: "스테이지 개수 상한 없음 — 요청 복잡도에 맞게 필요한 만큼 구성하라.";
	return {
		done: false,
		stage: 0,
		stageName: "스테이지 구성",
		nextAction: "compose",
		dfLoop: 0,
		designPrompt: "",
		gateResult: null,
		message:
			`새 파이프라인 — 스테이지 구성(종류·개수·순서)을 결정해 factorynote_plan 을 다시 호출하라. ` +
			`stages 파라미터에 카탈로그 kind 를 순서대로 담는다(같은 종류 반복 허용). ${capLine}\n` +
			`구성 승인 게이트는 없다(디렉터 전권) — 각 스테이지 산출물 게이트가 사용자 통제점이다.\n\n${catalogMenu()}\n\n` +
			`판단 기준: 요청이 단순하면 축소(예: understanding 단독·2단계), 구조 설계가 필요하면 design 포함, ` +
			`구현 로드맵이 필요하면 implementation 을 마지막에 배치. 리스크·테스트·비기능 검증은 요청의 복잡도·중요도에 따라 추가한다. ` +
			`예(표준): ["understanding","design","implementation"]`,
	};
}

/** stages 파라미터 검증 → 구성. 미제출·빈 배열은 null(요청 필요), 미등록 종류면 에러. */
function parseComposition(
	raw: readonly string[] | undefined,
): StageKind[] | null {
	if (raw === undefined || raw.length === 0) return null;
	for (const k of raw) {
		if (!isStageKind(k)) {
			throw new Error(
				`알 수 없는 스테이지 종류: "${k}" — 카탈로그: ${STAGE_KINDS.join(", ")}`,
			);
		}
	}
	return raw as StageKind[];
}

/** 파이프라인 1스텝 구동. Tier 1 동적 feedback 에이전트 오케스트레이션(ADR-014). */
export async function drivePlan(
	input: import("./plan-types.ts").DrivePlanInput,
): Promise<import("./plan-types.ts").DrivePlanOutput> {
	const { root, feature } = input;

	let state = await loadState(root, feature);
	if (!state) {
		// 첫 진입: 구성(미제출 시 요청) → 초기 상태 영속화 후 1단계 진행.
		let kinds: StageKind[];
		try {
			const parsed = parseComposition(input.stages);
			if (!parsed) return composeRequest(input.maxStages);
			kinds = parsed;
		} catch (err) {
			return {
				...composeRequest(input.maxStages),
				message: `${(err as Error).message}\n\n${composeRequest(input.maxStages).message}`,
			};
		}
		// 상한 초과 구성은 앞에서부터 잘라서 적용(truncate) — 적용 결과를 state 에 영속화.
		if (input.maxStages !== undefined && kinds.length > input.maxStages) {
			kinds = kinds.slice(0, input.maxStages);
		}
		state = initialState(feature, kinds);
		if (input.maxStages !== undefined) {
			state = { ...state, maxStages: input.maxStages };
		}
		await saveState(root, state);
	}
	// 사용자 상한 갱신(명령 재실행) — state 에 영속화해 재시작 후에도 유지.
	if (input.maxStages !== undefined && state.maxStages !== input.maxStages) {
		state = { ...state, maxStages: input.maxStages };
		await saveState(root, state);
	}
	if (state.done) {
		await closeGate(root, feature);
		return complete(state);
	}

	const def = stageDefAt(state.stages, state.stage);

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
			return runOpenGate(input, state, def, onDisk, true);
		}
	}

	// 채팅 수정 요청 등으로 게이트 열린 상태에서 재작성(designArtifact)이 들어옴:
	// 산출물(draft.md)을 반영해 갱신된 내용으로 게이트를 다시 연다(게이트 유지 — ADR-009).
	// resume=false 로 재작성 반영. chatResponse 도 함께 오면 runOpenGate 가 답변을 chatLog 에 push.
	// (이전엔 이 경로가 빠져 폴백으로 빠졌다 → 산물 미반영·게이트 끊김·뷰어 멈춤.)
	if (state.gateOpen && input.designArtifact !== undefined) {
		const { draftFile } = resolvePaths(root, feature, def);
		const gateArtifact = (await readArtifact(root, feature, draftFile)) ?? "";
		return runOpenGate(input, state, def, gateArtifact, false);
	}

	if (def.producesArtifact && !state.gateOpen) {
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
		// 그래프 강제(design 종류 required): design 보고의 필수 그래프 트리가 없으면 Feedback 전 재작성 반려.
		const graphOut = await enforceRequiredGraph({
			input,
			state,
			def,
			paths,
			draftFile,
			feedbackLevel,
			report,
		});
		if (graphOut) return graphOut;
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
		return runOpenGate(
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

function complete(
	state: PipelineState,
): import("./plan-types.ts").DrivePlanOutput {
	return {
		done: true,
		stage: state.stage,
		stageName: stageDefAt(state.stages, state.stage).name,
		nextAction: "done",
		dfLoop: 0,
		designPrompt: "",
		gateResult: null,
		message: `파이프라인 완료 — ${state.stages.length}단계 모두 사용자 승인됨. 계획 산출물은 .factorynote/<feature>/ 에 저장되었다.`,
	};
}
