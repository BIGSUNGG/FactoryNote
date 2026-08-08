// M2/M4 Tier 1 — Design↔Feedback 내부 루프 오케스트레이션(순수 로직).
// vault/01-architecture/multi-agent-pipeline · module-architecture M4 근거.
//
// 하이브리드 원칙: 판정·실행(루프 전이·상한·에스컬레이션) = 이 코드(결정론적);
// 산출물 '내용' 판단 = LLM(Design/Feedback 역할, AgentSpawn 으로 주입).
//
// 두 진입점:
//  - nextDesignFeedbackStep: 순수 단계 전이함수. drivePlan(pi 어댑터)이
//    factorynote_plan 호출마다 1회 호출해 단계 지시문을 에이전트에게 반환.
//    pi는 확장 코드가 서브에이전트를 동기 스폰할 수 없으므로 에이전트 매개.
//  - runDesignFeedbackLoop: 동기 스폰 가능 harness(CLI 하네스·테스트·Codex/Claude
//    구현체 등)가 직접 호출하는 루프 드라이버. nextDesignFeedbackStep 을 합성.
import type {
	AgentSpawn,
	ArtifactPaths,
	DesignFeedbackDirective,
	DesignFeedbackPhase,
	FeedbackOutcome,
	SpawnOptions,
} from "./types.ts";
import type { StageDefinition } from "./stages.ts";

/** FR-2(내부 루프): 단계별 Design↔Feedback 시도 상한. 도달 시 게이트 에스컬레이션. */
export const MAX_DESIGN_FEEDBACK_LOOPS = 3;

/**
 * 자식(Design/Feedback) 스폰 고정 옵션 — 컨텍스트 한도 관리 정책(core 소유).
 * pi 어댑터가 subagent 호출의 skill/context/toolBudget 로 매핑해 Director 에 전달.
 * 자식은 read/write/edit(+ 산출물 파일) 정도면 족하다; heavy 비필수 도구 차단으로
 * 시스템 프롬프트 고정 세금(도구 스키마)을 줄인다.
 */
export const CHILD_SPAWN_OPTIONS: SpawnOptions = Object.freeze({
	skill: false,
	context: "fresh",
	toolBudgetBlock: [
		"web_search",
		"fetch_content",
		"get_search_content",
		"source_check",
		"subagent",
		"factorynote_plan",
		"mcp",
		"mcpScript",
		"ctx_fetch_and_index",
		"ctx_index",
		"ctx_batch_execute",
		"lsp_diagnostics",
		"lens_diagnostics",
		"symbol_search",
		"read_symbol",
		"project_report",
		"module_report",
		"commitme",
		"todo",
	],
});

/** Feedback 에이전트가 보고하는 구조화 결과(코어는 raw 텍스트를 이렇게 파싱). */
export type DesignFeedbackReport =
	| { role: "design"; draft: string }
	| { role: "feedback"; outcome: FeedbackOutcome };

/** nextDesignFeedbackStep 반환 — 다음 지시문 + 갱신된 내부 루프 상태. */
export interface DesignFeedbackTransition {
	directive: DesignFeedbackDirective;
	dfPhase: DesignFeedbackPhase;
	dfLoop: number;
}

/**
 * Feedback 에이전트의 raw 출력을 판정으로 파싱.
 * 규약: 첫 의미있는 줄이 "CLEAN" 이면 클린, "ISSUES" 이면 나머지 줄이 이슈.
 * 판별 불가(규약 위반) → 안전 기본값 ISSUES(자동 통과 금지).
 */
export function parseFeedback(raw: string): FeedbackOutcome {
	const lines = raw
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const head = (lines[0] ?? "").toUpperCase();
	if (head === "CLEAN" || head.startsWith("VERDICT: CLEAN")) {
		return { clean: true };
	}
	// ISSUES 헤더 이후 줄들을 이슈로; 헤더가 없으면 전체를 이슈로.
	const body =
		head.startsWith("ISSUES") || head.startsWith("VERDICT: ISSUES")
			? lines.slice(1)
			: lines;
	const issues = body
		.map((l) => l.replace(/^[-*]\s*/, ""))
		.filter((l) => l.length > 0);
	return {
		clean: false,
		issues: issues.length > 0 ? issues : ["(구체적 이슈 없음)"],
	};
}

/** Design 첫 산출물 과제. paths 제공 시 designPrompt 파일 참조 + draft 파일 쓰기 지시(inline 본문 금지). */
export function designTask(
	def: StageDefinition,
	paths?: ArtifactPaths,
): string {
	if (paths) {
		return [
			`${def.artifact} 산출물을 작성하라. 작성 지시는 파일 ${paths.designPrompt} 에 있다(불변) — 읽어 따른다.`,
			`작성한 산출물은 파일 ${paths.draft} 에 저장한다. 반환은 그 파일 경로만(본문 절대 금지) — 본문을 반환하면 Director 컨텍스트가 부풋어 한도 초과(1261) 한다.`,
			"코드는 쓰지 않는다(계획 산출물).",
		].join("\n");
	}
	return def.designPrompt;
}

/** Feedback 과제(체크리스트 + 산출물). paths 제공 시 draft/feedback 파일 참조 + 상세리뷰 파일화. */
export function feedbackTask(
	def: StageDefinition,
	draft: string,
	paths?: ArtifactPaths,
): string {
	const checklist = def.feedbackChecklist.map((c) => `- ${c}`).join("\n");
	if (paths) {
		return [
			`검토 대상 ${def.artifact} 산출물은 파일 ${paths.draft} 에 있다 — 읽어 비판적 검토하라 (보안·병목·구조).`,
			`판정은 첫 줄에 "CLEAN"(이슈 없음) 또는 "ISSUES"(이후 줄에 각 이슈를 - 로 나열, 최대 5개·각 1줄·프로즈 금지) 로만 출력한다.`,
			`상세 리뷰 전문은 파일 ${paths.feedback} 에 저장하라. 반환은 판정 + 이슈 요약만(본문 금지).`,
			"",
			"## 검토 체크리스트",
			checklist,
		].join("\n");
	}
	return [
		`아래 ${def.artifact} 산출물을 비판적으로 검토하라 (보안·병목·구조).`,
		`판정은 첫 줄에 "CLEAN"(이슈 없음) 또는 "ISSUES"(이후 줄에 각 이슈를 - 로 나열) 로만 출력한다.`,
		"",
		"## 검토 체크리스트",
		checklist,
		"",
		"## 검토 대상 산출물",
		draft,
	].join("\n");
}

/**
 * 순수 단계 전이함수 — 오케스트레이션의 두뇌. drivePlan(pi)과 runDesignFeedbackLoop(동기 harness)
 * 양쪽이 공유. 입력: 단계 정의·현재 내부 루프 상태·에이전트 보고·현재 초안.
 * 출력: 다음 지시문 + 갱신된 (dfPhase, dfLoop).
 *
 * 전이:
 *  - 보고 없음(dfPhase=design)         → spawn-design(designPrompt)
 *  - design 보고(draft)                → spawn-feedback(draft+체크리스트)
 *  - feedback 보고·클린                → gate(산출물, 에스컬레이션 아님)
 *  - feedback 보고·이슈 & 미상한       → spawn-design(designPrompt+이슈), dfLoop++
 *  - feedback 보고·이슈 & 상한 도달    → gate(마지막 초안, 에스컬레이션)
 */
export function nextDesignFeedbackStep(
	def: StageDefinition,
	state: { dfPhase: DesignFeedbackPhase; dfLoop: number },
	report: DesignFeedbackReport | undefined,
	draft: string | undefined,
	paths?: ArtifactPaths,
): DesignFeedbackTransition {
	const { dfPhase, dfLoop } = state;

	// (1) design 단계: 보고가 없으면 Design 스폰 지시.
	if (dfPhase === "design" && report === undefined) {
		return {
			directive: {
				action: "spawn-design",
				task: designTask(def, paths),
				loop: dfLoop,
				spawnOptions: CHILD_SPAWN_OPTIONS,
			},
			dfPhase: "design",
			dfLoop,
		};
	}

	// (2) design 보고 → Feedback 스폰 지시. dfPhase 를 feedback 로.
	if (report !== undefined && report.role === "design") {
		return {
			directive: {
				action: "spawn-feedback",
				task: feedbackTask(def, report.draft, paths),
				spawnOptions: CHILD_SPAWN_OPTIONS,
			},
			dfPhase: "feedback",
			dfLoop,
		};
	}

	// (3) feedback 보고 → 클린/이슈 분기.
	if (report !== undefined && report.role === "feedback") {
		// paths 모드: 게이트 산출물은 draft 파일 경로(어댑터가 readArtifact 로 resolve).
		const artifact = paths ? paths.draft : (draft ?? "");
		if (report.outcome.clean) {
			return {
				directive: {
					action: "gate",
					artifact,
					escalated: false,
					loops: dfLoop,
					issues: [],
				},
				dfPhase: "design", // 게이트 직전 단계 종료 — 다음 단계 진입 시 design 으로 리셋
				dfLoop: 0,
			};
		}
		// 이슈 존재: 상한 미도달 시 루프, 도달 시 에스컬레이션 게이트.
		if (dfLoop + 1 < MAX_DESIGN_FEEDBACK_LOOPS) {
			return {
				directive: {
					action: "spawn-design",
					task: designRevisionTask(def, report.outcome.issues, paths),
					loop: dfLoop + 1,
					spawnOptions: CHILD_SPAWN_OPTIONS,
				},
				dfPhase: "design",
				dfLoop: dfLoop + 1,
			};
		}
		return {
			directive: {
				action: "gate",
				artifact,
				escalated: true,
				loops: dfLoop + 1,
				issues: report.outcome.issues,
			},
			dfPhase: "design",
			dfLoop: 0, // 에스컬레이션 후 게이트 판정(modify/revert)이 dfLoop 리셋과 정합
		};
	}

	// (4) dfPhase=feedback 인데 보고 없음(비정상 재진입) — Feedback 재스폰 유도.
	if (dfPhase === "feedback" && draft !== undefined) {
		return {
			directive: {
				action: "spawn-feedback",
				task: feedbackTask(def, draft, paths),
				spawnOptions: CHILD_SPAWN_OPTIONS,
			},
			dfPhase: "feedback",
			dfLoop,
		};
	}

	// 안전 추락 — 설계상 도달 불가.
	return {
		directive: {
			action: "spawn-design",
			task: designTask(def, paths),
			loop: dfLoop,
			spawnOptions: CHILD_SPAWN_OPTIONS,
		},
		dfPhase: "design",
		dfLoop,
	};
}

/** Design 재수정 과제(이전 이슈 인용). paths 제공 시 designPrompt·feedback 파일 참조(본문 재주입 無). */
function designRevisionTask(
	def: StageDefinition,
	issues: string[],
	paths?: ArtifactPaths,
): string {
	const block = issues.map((i) => `- ${i}`).join("\n");
	if (paths) {
		return [
			`이전 산출물이 Feedback 검토에서 반려되었다. 이슈를 근본적으로 반영해 ${def.artifact} 산출물을 재작성하라.`,
			`상세 리뷰는 파일 ${paths.feedback}, 작성 지시는 파일 ${paths.designPrompt}(불변) — 둘 다 읽어라.`,
			"",
			"## 반려 이슈(요약)",
			block,
			"",
			`재작성 결과는 파일 ${paths.draft} 에 저장하고 반환은 경로만.`,
		].join("\n");
	}
	return [
		`이전 산출물이 Feedback 검토에서 아래 이슈로 반려되었다. 이슈를 근본적으로 반영해 ${def.artifact} 산출물을 재작성하라.`,
		"",
		"## 반려 이슈",
		block,
		"",
		"## 원래 작성 지시",
		def.designPrompt,
	].join("\n");
}

/**
 * 동기 스폰 harness용 루프 드라이버. nextDesignFeedbackStep 을 합성해
 * Design↔Feedback 루프를 끝까지 돌린다. pi 어댑터는 이것을 직접 부르지 못한다
 * (확장 코드 = 동기 스폰 불가) → 대신 nextDesignFeedbackStep 을 매 호출마다 쓴다.
 * 테스트는 목 AgentSpawn 으로 이 함수를 구동해 전이를 검증한다.
 */
export async function runDesignFeedbackLoop(
	spawn: AgentSpawn,
	def: StageDefinition,
): Promise<
	| { kind: "clean"; artifact: string; loops: number }
	| { kind: "escalate"; artifact: string; issues: string[]; loops: number }
> {
	let dfPhase: DesignFeedbackPhase = "design";
	let dfLoop = 0;
	let draft: string | undefined;
	let report: DesignFeedbackReport | undefined;

	for (;;) {
		const t = nextDesignFeedbackStep(def, { dfPhase, dfLoop }, report, draft);
		dfPhase = t.dfPhase;
		dfLoop = t.dfLoop;
		const d = t.directive;

		if (d.action === "spawn-design") {
			draft = await spawn.spawn("design", d.task);
			report = { role: "design", draft };
			continue;
		}
		if (d.action === "spawn-feedback") {
			const raw = await spawn.spawn("feedback", d.task);
			report = { role: "feedback", outcome: parseFeedback(raw) };
			continue;
		}
		// gate — 루프 종료.
		return d.escalated
			? {
					kind: "escalate",
					artifact: d.artifact,
					issues: d.issues,
					loops: d.loops,
				}
			: { kind: "clean", artifact: d.artifact, loops: d.loops };
	}
}
