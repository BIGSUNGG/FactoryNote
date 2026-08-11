// M2/M4 Tier 1 — Design → Feedback(동적 다중 에이전트 병렬) → 조건부 수정 오케스트레이션(순수 로직).
// ADR-014 동적 feedback 에이전트: Director 가 현 단계 메뉴에서 상황에 맞는 N개를 추려 병렬 스폰.
// 기본 사이클 수 = DEFAULT_MAX_LOOPS(1, 파라미터화). '검토 요청' 버튼이 런타임 +1 사이클.
//
// 하이브리드 원칙: 판정·실행(전이·상한) = 이 코드(결정론적);
// 산출물 '내용' 판단 + 에이전트 '선택' = LLM(Director 가 메뉴에서 추려 스폰).
//
// 두 진입점:
//  - nextDesignFeedbackStep: 순수 단계 전이함수. drivePlan(pi 어댑터)이 호출해 지시문 반환.
//  - runDesignFeedbackLoop: 동기 스폰 harness(CLI 하네스·테스트)용 — 메뉴 전체(또는 selector) 스폰.
import type {
	AgentRole,
	AgentSpawn,
	ArtifactPaths,
	FeedbackAxisOutcome,
	FeedbackOutcome,
	DesignFeedbackDirective,
	DesignFeedbackPhase,
	SpawnOptions,
} from "./types.ts";
import type { StageDefinition } from "./stages.ts";
import type { FeedbackAgent } from "./feedback-agents.ts";
import { feedbackMenuForStage } from "./feedback-agents.ts";

/**
 * FR-2(내부 사이클): Design→병렬 Feedback→조건부 수정 시도 상한(기본값).
 * 파라미터화 — drivePlan/루프 드라이버가 maxLoops 로 주입. '검토 요청' 버튼은 상한과 무관하게 +1.
 */
export const DEFAULT_MAX_LOOPS = 1;

/**
 * 자식 스폰 고정 옵션 — 컨텍스트 한도 관리 정책(core 소유).
 * 도구 제거는 명명 에이전트 정의의 tools: allowlist 가 담당(ADR-012). 역량별 도구는 에이전트 파일이 결정.
 */
export const CHILD_SPAWN_OPTIONS: Readonly<Record<AgentRole, SpawnOptions>> =
	Object.freeze({
		design: {
			skill: false,
			context: "fresh",
			agentName: "factorynote-design",
			toolBudget: { hard: 20, soft: 14 },
			turnBudget: { maxTurns: 15, graceTurns: 2 },
		},
		feedback: {
			skill: false,
			context: "fresh",
			// 동적 선택: Director 가 메뉴에서 고른 factorynote-feedback-<name> 스폰. 기본 예산.
			agentName: "factorynote-feedback",
			toolBudget: { hard: 15, soft: 10 },
			turnBudget: { maxTurns: 10, graceTurns: 2 },
		},
	});

/**
 * 방향 3b: 자식 보고 입력이 과도히 길면 절단해 Director 컨텍스트 누적(1261) 차단.
 */
export const MAX_REPORT_INPUT_CHARS = 4000;
export function clampReportInput(
	raw: string,
	maxLen: number = MAX_REPORT_INPUT_CHARS,
): string {
	if (raw.length <= maxLen) return raw;
	const nl = raw.indexOf("\n");
	const head = nl === -1 ? raw : raw.slice(0, nl);
	return (
		head.slice(0, Math.min(head.length, maxLen)) +
		`\n[입력이 ${raw.length}자로 과대 — ${maxLen}자 한도로 절단(방향 3b). 상세는 산출물 파일 참조.]`
	);
}

/** Feedback 에이전트의 raw 출력을 판정으로 파싱. 안전 기본값 ISSUES. */
export function parseFeedback(raw: string): FeedbackOutcome {
	const lines = raw
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const head = (lines[0] ?? "").toUpperCase();
	if (head === "CLEAN" || head.startsWith("VERDICT: CLEAN")) {
		return { clean: true };
	}
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

/** Feedback 자식 보고. outcomes 는 Director 가 선택·스폰한 에이전트별 결과 집합. */
export type DesignFeedbackReport =
	| { role: "design"; draft: string }
	| { role: "feedback"; outcomes: FeedbackAxisOutcome[] };

/** nextDesignFeedbackStep 반환 — 다음 지시문 + 갱신된 내부 사이클 상태. */
export interface DesignFeedbackTransition {
	directive: DesignFeedbackDirective;
	dfPhase: DesignFeedbackPhase;
	dfLoop: number;
}

/** 에이전트별 결과 집합 → 전체 클린 여부 + 취합된 이슈(에이전트명 접두). */
export function aggregateFeedback(outcomes: FeedbackAxisOutcome[]): {
	allClean: boolean;
	issues: string[];
} {
	const issues: string[] = [];
	let allClean = true;
	for (const o of outcomes) {
		if (!o.outcome.clean) {
			allClean = false;
			for (const i of o.outcome.issues) issues.push(`[${o.axis}] ${i}`);
		}
	}
	return { allClean, issues };
}

/** Design 첫 산출물 과제. paths 제공 시 designPrompt 파일 참조 + draft 파일 쓰기 지시. */
export function designTask(
	def: StageDefinition,
	paths?: ArtifactPaths,
): string {
	if (paths) {
		return [
			`${def.artifact} 산출물을 작성하라. 작성 지시는 파일 ${paths.designPrompt} 에 있다(불변) — 읽어 따른다.`,
			`작성한 산출물은 파일 ${paths.draft} 에 저장한다. 지시에 별도 그래프 JSON 파일 작성이 포함되면 draft 와 같은 폴더의 지정된 파일명(예: draft-graph.json)으로 함께 저장한다. 반환은 draft 파일 경로만(본문 절대 금지) — 본문을 반환하면 Director 컨텍스트가 부풋어 한도 초과(1261) 한다.`,
			"코드는 쓰지 않는다(계획 산출물).",
		].join("\n");
	}
	return def.designPrompt;
}

/** 한 에이전트의 Feedback 과제(동기 harness용 — pi Director 는 메뉴를 보고 직접 과제 구성). */
export function feedbackAgentTask(
	def: StageDefinition,
	agent: FeedbackAgent,
	draft: string,
	paths?: ArtifactPaths,
): string {
	if (paths) {
		return [
			`검토 대상 ${def.artifact} 산출물은 파일 ${paths.draft} 에 있다 — 읽고 **${agent.focus} 관점**에서 비판 검토하라. md 에 \`<!-- graph: <파일명> -->\` 참조가 있으면 같은 폴더의 해당 그래프 JSON 파일도 읽어 구조를 함께 검토한다.`,
			`판정은 첫 줄에 "CLEAN"(이슈 없음) 또는 "ISSUES"(이후 줄에 각 이슈를 - 로 나열, 최대 5개·각 1줄)로만 출력한다.`,
			`상세 리뷰 전문은 파일 ${paths.feedback}.${agent.name} 에 저장하라. 반환은 판정 + 이슈 요약만(본문 금지).`,
		].join("\n");
	}
	return [
		`아래 ${def.artifact} 산출물을 **${agent.focus} 관점**에서 비판적으로 검토하라.`,
		`판정은 첫 줄에 "CLEAN" 또는 "ISSUES"(이후 줄에 각 이슈를 - 로 나열)로만 출력한다.`,
		"",
		"## 검토 대상 산출물",
		draft,
	].join("\n");
}

/** Design 재수정 과제(전 에이전트 이슈 취합 주입). */
function designRevisionTask(
	def: StageDefinition,
	issues: string[],
	paths?: ArtifactPaths,
): string {
	const block = issues.map((i) => `- ${i}`).join("\n");
	if (paths) {
		return [
			`이전 산출물이 병렬 Feedback 검토에서 반려되었다. 아래 전 에이전트 이슈를 근본적으로 반영해 ${def.artifact} 산출물을 재작성하라(에이전트별로 따로 고치지 말고 하나의 일관된 산출물로 통합).`,
			`상세 리뷰는 반려 이슈의 [에이전트명] 에 해당하는 파일(${paths.feedback}.<name>)들 — 모두 읽어라. 작성 지시는 ${paths.designPrompt}(불변).`,
			"",
			"## 반려 이슈(전 에이전트 취합)",
			block,
			"",
			`재작성 결과는 파일 ${paths.draft} 에 저장하고 반환은 경로만. 그래프 구조를 변경했으면 동반 그래프 JSON 파일도 일관되게 갱신한다.`,
		].join("\n");
	}
	return [
		`이전 산출물이 병렬 Feedback 검토에서 아래 이슈로 반려되었다. 이슈를 근본적으로 반영해 ${def.artifact} 산출물을 재작성하라.`,
		"",
		"## 반려 이슈",
		block,
		"",
		"## 원래 작성 지시",
		def.designPrompt,
	].join("\n");
}

/**
 * 순수 단계 전이함수 — 동적 feedback 에이전트 모델(ADR-014). dfLoop = 수행된 revision 수.
 * spawn-feedback 는 메뉴/드래프트 경로만 전달 — Director 가 메뉴를 읽어 상황에 맞는 N개를 추려 병렬 스폰한다.
 * 전이:
 *  - design 단계·보고 없음           → spawn-design(v1)
 *  - design 보고·dfLoop==0(v1)       → spawn-feedback(메뉴 참조)
 *  - design 보고·dfLoop>0(수정본)    → dfLoop<maxLoops 면 spawn-feedback(재검토), 아니면 gate
 *  - feedback 보고·전 에이전트 CLEAN → gate
 *  - feedback 보고·이슈·dfLoop<max   → spawn-design(수정), dfLoop++
 *  - feedback 보고·이슈·dfLoop>=max  → gate(에스컬레이션)
 */
export function nextDesignFeedbackStep(
	def: StageDefinition,
	state: { dfPhase: DesignFeedbackPhase; dfLoop: number },
	report: DesignFeedbackReport | undefined,
	draft: string | undefined,
	paths?: ArtifactPaths,
	maxLoops: number = DEFAULT_MAX_LOOPS,
): DesignFeedbackTransition {
	const { dfPhase, dfLoop } = state;

	// (1) design 단계·보고 없음 → Design v1 스폰.
	if (dfPhase === "design" && report === undefined) {
		return {
			directive: {
				action: "spawn-design",
				task: designTask(def, paths),
				loop: dfLoop,
				spawnOptions: CHILD_SPAWN_OPTIONS.design,
			},
			dfPhase: "design",
			dfLoop,
		};
	}

	// (2) design 보고 → v1(dfLoop==0)은 feedback; 수정본(dfLoop>0)은 남은 사이클 여부로 분기.
	if (report !== undefined && report.role === "design") {
		if (dfLoop === 0 || dfLoop < maxLoops) {
			return {
				directive: {
					action: "spawn-feedback",
					menuPath: paths?.menu ?? "",
					draftPath: paths?.draft ?? report.draft,
					feedbackPath: paths?.feedback ?? "",
					spawnOptions: CHILD_SPAWN_OPTIONS.feedback,
				},
				dfPhase: "feedback",
				dfLoop,
			};
		}
		return {
			directive: {
				action: "gate",
				artifact: paths ? paths.draft : report.draft,
				escalated: false,
				loops: dfLoop,
				issues: [],
			},
			dfPhase: "design",
			dfLoop: 0,
		};
	}

	// (3) feedback 보고 → 클린/이슈 분기.
	if (report !== undefined && report.role === "feedback") {
		const { allClean, issues } = aggregateFeedback(report.outcomes);
		const artifact = paths ? paths.draft : (draft ?? "");
		if (allClean) {
			return {
				directive: {
					action: "gate",
					artifact,
					escalated: false,
					loops: dfLoop,
					issues: [],
				},
				dfPhase: "design",
				dfLoop: 0,
			};
		}
		if (dfLoop < maxLoops) {
			return {
				directive: {
					action: "spawn-design",
					task: designRevisionTask(def, issues, paths),
					loop: dfLoop + 1,
					spawnOptions: CHILD_SPAWN_OPTIONS.design,
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
				loops: dfLoop,
				issues,
			},
			dfPhase: "design",
			dfLoop: 0,
		};
	}

	// (4) feedback 단계·보고 없음(비정상 재진입) — Feedback 재스폰 유도.
	if (dfPhase === "feedback") {
		return {
			directive: {
				action: "spawn-feedback",
				menuPath: paths?.menu ?? "",
				draftPath: paths?.draft ?? draft ?? "",
				feedbackPath: paths?.feedback ?? "",
				spawnOptions: CHILD_SPAWN_OPTIONS.feedback,
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
			spawnOptions: CHILD_SPAWN_OPTIONS.design,
		},
		dfPhase: "design",
		dfLoop,
	};
}

/**
 * 동기 스폰 harness용 루프 드라이버. 현 단계 메뜨(또는 select 결과)를 순차 스폰해 집합 후 전이.
 * pi 어댑터는 동기 스폰 불가 → nextDesignFeedbackStep 을 매 호출마다 쓴다(Director 가 병렬 선택 스폰).
 * select 미지정 시 현 단계 메뉴 전체 스폰(동기 harness의 결정론적 기본).
 */
export async function runDesignFeedbackLoop(
	spawn: AgentSpawn,
	def: StageDefinition,
	maxLoops: number = DEFAULT_MAX_LOOPS,
	select?: (menu: FeedbackAgent[]) => FeedbackAgent[],
): Promise<
	| { kind: "clean"; artifact: string; loops: number }
	| { kind: "escalate"; artifact: string; issues: string[]; loops: number }
> {
	let dfPhase: DesignFeedbackPhase = "design";
	let dfLoop = 0;
	let draft: string | undefined;
	let report: DesignFeedbackReport | undefined;
	const menu = (select ?? ((m) => m))(feedbackMenuForStage(def.id));

	for (;;) {
		const t = nextDesignFeedbackStep(
			def,
			{ dfPhase, dfLoop },
			report,
			draft,
			undefined,
			maxLoops,
		);
		dfPhase = t.dfPhase;
		dfLoop = t.dfLoop;
		const d = t.directive;

		if (d.action === "spawn-design") {
			draft = await spawn.spawn("design", d.task);
			report = { role: "design", draft };
			continue;
		}
		if (d.action === "spawn-feedback") {
			// 메뉴 에이전트 순차 스폰(동기 harness). pi 어댑터는 Director 가 선택해 병렬(runs.all) 스폰.
			const outcomes: FeedbackAxisOutcome[] = [];
			for (const agent of menu) {
				const raw = await spawn.spawn(
					"feedback",
					feedbackAgentTask(def, agent, draft ?? ""),
				);
				outcomes.push({ axis: agent.name, outcome: parseFeedback(raw) });
			}
			report = { role: "feedback", outcomes };
			continue;
		}
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
