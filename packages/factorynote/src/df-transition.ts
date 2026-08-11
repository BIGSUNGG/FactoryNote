// Design↔Feedback 내부 루프 순수 단계 전이 함수 — 동적 feedback 에이전트 모델(ADR-014).
// 판정·실행(전이·상한) = 결정론적; 산출물 내용 판단·에이전트 선택 = LLM(파라미터로 주입).
import type {
	DesignFeedbackDirective,
	DesignFeedbackPhase,
	FeedbackLevel,
} from "./types/index.ts";
import type { StageDefinition } from "./stages.ts";
import {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_FEEDBACK_LEVEL,
	DEFAULT_MAX_LOOPS,
} from "./df-policy.ts";
import { aggregateFeedback, type DesignFeedbackReport } from "./df-parse.ts";
import { designRevisionTask, designTask } from "./df-task.ts";
import type { ArtifactPaths } from "./types/index.ts";

/** nextDesignFeedbackStep 반환 — 다음 지시문 + 갱신된 내부 사이클 상태. */
export interface DesignFeedbackTransition {
	directive: DesignFeedbackDirective;
	dfPhase: DesignFeedbackPhase;
	dfLoop: number;
}

/**
 * 순수 단계 전이함수 — 동적 feedback 에이전트 모델(ADR-014). dfLoop = 수행된 revision 수.
 * spawn-feedback 는 메뉴/드래프트 경로만 전달 — Director 가 메뉴를 읽어 상황에 맞는 N개를 추려 병렬 스폰한다.
 * 전이:
 *  - design 단계·보고 없음           → spawn-design(v1)
 *  - design 보고·수준 none(ADR-017)  → gate(Feedback 루프 스킵 — opt-in Tier 0)
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
	feedbackLevel: FeedbackLevel = DEFAULT_FEEDBACK_LEVEL,
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

	// (2) design 보고 → 수준 none 이면 Feedback 루프 스킵·게이트 직행(ADR-017).
	if (report !== undefined && report.role === "design") {
		if (feedbackLevel === "none") {
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
		if (dfLoop === 0 || dfLoop < maxLoops) {
			return {
				directive: {
					action: "spawn-feedback",
					menuPath: paths?.menu ?? "",
					draftPath: paths?.draft ?? report.draft,
					feedbackPath: paths?.feedback ?? "",
					feedbackLevel,
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
		// 수준 none 이면 feedback 단계 자체가 비정상 — 게이트 직행으로 복구.
		if (feedbackLevel === "none") {
			return {
				directive: {
					action: "gate",
					artifact: paths?.draft ?? draft ?? "",
					escalated: false,
					loops: dfLoop,
					issues: [],
				},
				dfPhase: "design",
				dfLoop: 0,
			};
		}
		return {
			directive: {
				action: "spawn-feedback",
				menuPath: paths?.menu ?? "",
				draftPath: paths?.draft ?? draft ?? "",
				feedbackPath: paths?.feedback ?? "",
				feedbackLevel,
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
