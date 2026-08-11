// 동기 스폰 harness용 루프 드라이버 — 메뉴(또는 selector 결과)를 순차 스폰해 집합 후 전이.
// pi 어댑터는 동기 스폰 불가 → nextDesignFeedbackStep 을 매 호출마다 쓴다(Director 가 병렬 선택 스폰).
import type {
	AgentSpawn,
	FeedbackAxisOutcome,
	FeedbackLevel,
} from "./types/index.ts";
import type { StageDefinition } from "./stages.ts";
import type { FeedbackAgent } from "./feedback-agents.ts";
import { feedbackMenuForStage } from "./feedback-agents.ts";
import { DEFAULT_FEEDBACK_LEVEL, DEFAULT_MAX_LOOPS } from "./df-policy.ts";
import { parseFeedback, type DesignFeedbackReport } from "./df-parse.ts";
import { feedbackAgentTask } from "./df-task.ts";
import { nextDesignFeedbackStep } from "./df-transition.ts";
import type { DesignFeedbackPhase } from "./types/index.ts";

/**
 * 동기 스폰 harness용 루프 드라이버. 현 단계 메뉴(또는 select 결과)를 순차 스폰해 집합 후 전이.
 * select 미지정 시 현 단계 메뉴 전체 스폰(동기 harness의 결정론적 기본).
 */
export async function runDesignFeedbackLoop(
	spawn: AgentSpawn,
	def: StageDefinition,
	maxLoops: number = DEFAULT_MAX_LOOPS,
	select?: (menu: FeedbackAgent[]) => FeedbackAgent[],
	feedbackLevel: FeedbackLevel = DEFAULT_FEEDBACK_LEVEL,
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
			feedbackLevel,
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
