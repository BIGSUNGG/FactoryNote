// Design↔Feedback 내부 루프 순수 단계 전이 함수 — 동적 feedback 에이전트 모델(ADR-014).
// 판정·실행(전이·상한) = 결정론적; 산출물 내용 판단·에이전트 선택 = LLM(파라미터로 주입).
import type {
	ArtifactPaths,
	DesignFeedbackDirective,
	DesignFeedbackPhase,
	DesignLevel,
	FeedbackLevel,
} from "./types/index.ts";
import type { StageDefinition } from "./stages.ts";
import {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_DESIGN_LEVEL,
	DEFAULT_FEEDBACK_LEVEL,
	DEFAULT_MAX_LOOPS,
} from "./df-policy.ts";
import { aggregateFeedback, type DesignFeedbackReport } from "./df-parse.ts";
import { designRevisionTask, designTask } from "./df-task.ts";

/** nextDesignFeedbackStep 반환 — 다음 지시문 + 갱신된 내부 사이클 상태. */
export interface DesignFeedbackTransition {
	directive: DesignFeedbackDirective;
	dfPhase: DesignFeedbackPhase;
	dfLoop: number;
}

/** 지시문 생성자(전이 공통 형태) — 게이트. */
function gate(
	artifact: string,
	dfLoop: number,
	escalated: boolean,
	issues: string[],
): DesignFeedbackTransition {
	return {
		directive: { action: "gate", artifact, escalated, loops: dfLoop, issues },
		dfPhase: "design",
		dfLoop: 0,
	};
}

/** 지시문 생성자 — Feedback 스폰(메뉴/드래프트 경로만 전달, Director 가 선택 스폰). */
function spawnFeedback(
	menuPath: string,
	draftPath: string,
	feedbackPath: string,
	feedbackLevel: FeedbackLevel,
	dfLoop: number,
): DesignFeedbackTransition {
	return {
		directive: {
			action: "spawn-feedback",
			menuPath,
			draftPath,
			feedbackPath,
			feedbackLevel,
			spawnOptions: CHILD_SPAWN_OPTIONS.feedback,
		},
		dfPhase: "feedback",
		dfLoop,
	};
}

/** 지시문 생성자 — Design (재)스폰(주 문서 + 위성 — 메뉴·레벨은 paths·designLevel 로 전달). */
function spawnDesign(
	task: string,
	loop: number,
	paths?: ArtifactPaths,
	designLevel: DesignLevel = DEFAULT_DESIGN_LEVEL,
): DesignFeedbackTransition {
	return {
		directive: {
			action: "spawn-design",
			task,
			loop,
			...(paths?.designMenu !== undefined
				? { menuPath: paths.designMenu }
				: {}),
			designLevel,
			spawnOptions: CHILD_SPAWN_OPTIONS.design,
		},
		dfPhase: "design",
		dfLoop: loop,
	};
}

/** 케이스(2): design 보고 — none 스킵/Feedback 검토/게이트(상한). */
function designReportStep(
	dfLoop: number,
	maxLoops: number,
	feedbackLevel: FeedbackLevel,
	paths: ArtifactPaths | undefined,
	report: DesignFeedbackReport & { role: "design" },
): DesignFeedbackTransition {
	// 수준 none 이면 Feedback 루프 스킵·게이트 직행(ADR-017).
	if (feedbackLevel === "none") {
		return gate(paths ? paths.draft : report.draft, dfLoop, false, []);
	}
	if (dfLoop === 0 || dfLoop < maxLoops) {
		return spawnFeedback(
			paths?.menu ?? "",
			paths?.draft ?? report.draft,
			paths?.feedback ?? "",
			feedbackLevel,
			dfLoop,
		);
	}
	return gate(paths ? paths.draft : report.draft, dfLoop, false, []);
}

/** 케이스(3): feedback 보고 — 클린 gate/수정 스폰/에스컬레이션 gate. */
function feedbackReportStep(
	def: StageDefinition,
	dfLoop: number,
	maxLoops: number,
	paths: ArtifactPaths | undefined,
	draft: string | undefined,
	report: DesignFeedbackReport & { role: "feedback" },
	designLevel: DesignLevel,
): DesignFeedbackTransition {
	const { allClean, issues } = aggregateFeedback(report.outcomes);
	const artifact = paths ? paths.draft : (draft ?? "");
	if (allClean) return gate(artifact, dfLoop, false, []);
	if (dfLoop < maxLoops) {
		return spawnDesign(
			designRevisionTask(def, issues, paths),
			dfLoop + 1,
			paths,
			designLevel,
		);
	}
	return gate(artifact, dfLoop, true, issues);
}

/** 케이스(4): feedback 단계·보고 없음(비정상 재진입) — Feedback 재스폰 유도. */
function feedbackReentryStep(
	dfLoop: number,
	feedbackLevel: FeedbackLevel,
	paths: ArtifactPaths | undefined,
	draft: string | undefined,
): DesignFeedbackTransition {
	// 수준 none 이면 feedback 단계 자체가 비정상 — 게이트 직행으로 복구.
	if (feedbackLevel === "none") {
		return gate(paths?.draft ?? draft ?? "", dfLoop, false, []);
	}
	return spawnFeedback(
		paths?.menu ?? "",
		paths?.draft ?? draft ?? "",
		paths?.feedback ?? "",
		feedbackLevel,
		dfLoop,
	);
}

/**
 * 순수 단계 전이함수 — 동적 feedback 에이전트 모델(ADR-014) + 위성 design(ADR-031).
 * dfLoop = 수행된 revision 수. spawn-design/feedback 은 메뉴/드래프트 경로만 전달 —
 * Director 가 메뉴를 읽어 designLevel/feedbackLevel 에 맞춰 N개를 추려 병렬 스폰한다.
 * 전이:
 *  - design 단계·보고 없음           → spawn-design(v1, 주 문서 + designLevel 위성)
 *  - design 보고·수준 none(ADR-017)  → gate(Feedback 루프 스킵 — opt-in Tier 0)
 *  - design 보고·dfLoop==0(v1)       → spawn-feedback(메뉴 참조)
 *  - design 보고·dfLoop>0(수정본)    → dfLoop<maxLoops 면 spawn-feedback(재검토), 아니면 gate
 *  - feedback 보고·전 에이전트 CLEAN → gate
 *  - feedback 보고·이슈·dfLoop<max   → spawn-design(수정 — 주+위성 재작성), dfLoop++
 *  - feedback 보고·이슈·dfLoop>=max  → gate(에스컬레이션)
 */
export function nextDesignFeedbackStep(
	def: StageDefinition,
	state: { dfPhase: DesignFeedbackPhase; dfLoop: number },
	report: DesignFeedbackReport | undefined,
	draft: string | undefined,
	paths?: ArtifactPaths,
	maxLoops: number = DEFAULT_MAX_LOOPS,
	feedbackLevel: FeedbackLevel = DEFAULT_FEEDBACK_LEVEL,
	designLevel: DesignLevel = DEFAULT_DESIGN_LEVEL,
): DesignFeedbackTransition {
	const { dfPhase, dfLoop } = state;

	// (1) design 단계·보고 없음 → Design v1 스폰.
	if (dfPhase === "design" && report === undefined) {
		return spawnDesign(designTask(def, paths), dfLoop, paths, designLevel);
	}

	// (2) design 보고.
	if (report?.role === "design") {
		return designReportStep(dfLoop, maxLoops, feedbackLevel, paths, report);
	}

	// (3) feedback 보고 → 클린/이슈 분기.
	if (report?.role === "feedback") {
		return feedbackReportStep(
			def,
			dfLoop,
			maxLoops,
			paths,
			draft,
			report,
			designLevel,
		);
	}

	// (4) feedback 단계·보고 없음(비정상 재진입) — Feedback 재스폰 유도.
	if (dfPhase === "feedback") {
		return feedbackReentryStep(dfLoop, feedbackLevel, paths, draft);
	}

	// 안전 추락 — 설계상 도달 불가.
	return spawnDesign(designTask(def, paths), dfLoop, paths, designLevel);
}
