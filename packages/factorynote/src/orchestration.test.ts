// Orchestration(Tier 1 동적 feedback 에이전트) 자체체크 — 검증계약 하드 게이트.
// ADR-014: Director 가 메뉴에서 선택·병렬 스폰. 전이·집합·메뉴 필터를 결정론적 검증.
// 실행: bun test packages/factorynote
import { test, expect } from "bun:test";
import { STAGES } from "./stages.ts";
import { feedbackMenuForStage } from "./feedback-agents.ts";
import {
	CHILD_SPAWN_OPTIONS,
	DEFAULT_FEEDBACK_LEVEL,
	DEFAULT_MAX_LOOPS,
	FEEDBACK_LEVELS,
	aggregateFeedback,
	clampReportInput,
	designTask,
	feedbackAgentTask,
	feedbackLevelCountSpec,
	nextDesignFeedbackStep,
	parseFeedback,
	runDesignFeedbackLoop,
} from "./orchestration.ts";
import type {
	AgentSpawn,
	AgentRole,
	ArtifactPaths,
	FeedbackAxisOutcome,
} from "./types.ts";

/** 역할별 큐잉된 응답을 순서대로 반환하는 목 스폰. */
class MockSpawn implements AgentSpawn {
	private queues: Record<AgentRole, string[]>;
	calls: { role: AgentRole; task: string }[] = [];
	constructor(scripts: Partial<Record<AgentRole, string[]>>) {
		this.queues = {
			design: [...(scripts.design ?? [])],
			feedback: [...(scripts.feedback ?? [])],
		};
	}
	async spawn(role: AgentRole, task: string): Promise<string> {
		this.calls.push({ role, task });
		const q = this.queues[role];
		if (!q || q.length === 0) {
			throw new Error(`MockSpawn: ${role} 응답 스크립트 부족`);
		}
		return q.shift() as string;
	}
}

const stage = STAGES[0]!; // Stage 1
const menu = feedbackMenuForStage(1);
const [a0, a1] = menu;

// --- parseFeedback ---
test("parseFeedback: CLEAN → 클린", () => {
	expect(parseFeedback("CLEAN")).toEqual({ clean: true });
	expect(parseFeedback("VERDICT: CLEAN")).toEqual({ clean: true });
});

test("parseFeedback: ISSUES → 이슈 배열", () => {
	expect(parseFeedback("ISSUES\n- 순환 의존성\n- 과잉 추상화")).toEqual({
		clean: false,
		issues: ["순환 의존성", "과잉 추상화"],
	});
});

test("parseFeedback: 규약 위반 → 안전 기본값 ISSUES", () => {
	const out = parseFeedback("그냥 평문");
	expect(out.clean).toBe(false);
	if (!out.clean) expect(out.issues.length).toBeGreaterThan(0);
});

// --- aggregateFeedback ---
test("aggregateFeedback: 전 에이전트 클린 → allClean", () => {
	const outcomes: FeedbackAxisOutcome[] = menu.map((a) => ({
		axis: a.name,
		outcome: { clean: true as const },
	}));
	expect(aggregateFeedback(outcomes)).toEqual({ allClean: true, issues: [] });
});

test("aggregateFeedback: 일부 이슈 → 축명 접두", () => {
	const outcomes: FeedbackAxisOutcome[] = [
		{ axis: a0!.name, outcome: { clean: false, issues: ["이슈A"] } },
		{ axis: a1!.name, outcome: { clean: true as const } },
	];
	const r = aggregateFeedback(outcomes);
	expect(r.allClean).toBe(false);
	expect(r.issues).toEqual([`[${a0!.name}] 이슈A`]);
});

// --- feedbackMenuForStage ---
test("feedbackMenuForStage: Stage 1 메뉴 ≥1 (completeness 등 포함)", () => {
	expect(menu.length).toBeGreaterThanOrEqual(1);
	expect(menu.some((a) => a.name === "completeness")).toBe(true);
	expect(menu.some((a) => a.name === "feasibility")).toBe(true); // web 에이전트
});

// --- feedbackAgentTask ---
test("feedbackAgentTask: focus·draft·feedback.<name> 포함", () => {
	const t = feedbackAgentTask(stage, a0!, "D1");
	expect(t).toContain(a0!.focus);
	expect(t).toContain("D1");
});

// --- nextDesignFeedbackStep 전이(메뉴 기반) ---
test("nextDesignFeedbackStep: 진입 → spawn-design(v1)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		undefined,
		undefined,
	);
	expect(t.directive.action).toBe("spawn-design");
	if (t.directive.action === "spawn-design") {
		expect(t.directive.task).toBe(stage.designPrompt);
		expect(t.directive.loop).toBe(0);
	}
});

test("nextDesignFeedbackStep: design v1 보고 → spawn-feedback(메뉴/드래프트 경로)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		{ role: "design", draft: "초안" },
		"초안",
	);
	expect(t.directive.action).toBe("spawn-feedback");
	expect(t.dfPhase).toBe("feedback");
	if (t.directive.action === "spawn-feedback") {
		expect(t.directive.draftPath).toBe("초안");
		expect(t.directive.menuPath).toBe(""); // paths 미제공
	}
});

test("nextDesignFeedbackStep: feedback 전 클린 → gate", () => {
	const outcomes: FeedbackAxisOutcome[] = [
		{ axis: a0!.name, outcome: { clean: true as const } },
		{ axis: a1!.name, outcome: { clean: true as const } },
	];
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 0 },
		{ role: "feedback", outcomes },
		"초안",
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate") {
		expect(t.directive.escalated).toBe(false);
		expect(t.directive.artifact).toBe("초안");
		expect(t.directive.issues).toEqual([]);
	}
});

test("nextDesignFeedbackStep: feedback 이슈·미상한 → spawn-design 수정 + dfLoop 증가", () => {
	const outcomes: FeedbackAxisOutcome[] = [
		{ axis: a0!.name, outcome: { clean: false, issues: ["이슈A"] } },
		{ axis: a1!.name, outcome: { clean: true as const } },
	];
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 0 },
		{ role: "feedback", outcomes },
		"초안",
	);
	expect(t.directive.action).toBe("spawn-design");
	expect(t.dfLoop).toBe(1);
	if (t.directive.action === "spawn-design") {
		expect(t.directive.task).toContain("이슈A");
		expect(t.directive.loop).toBe(1);
	}
});

test("nextDesignFeedbackStep: design 수정본 보고·상한 → gate(수정 완료)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 1 },
		{ role: "design", draft: "수정본" },
		"수정본",
		undefined,
		DEFAULT_MAX_LOOPS,
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate") {
		expect(t.directive.escalated).toBe(false);
		expect(t.directive.artifact).toBe("수정본");
	}
});

test("nextDesignFeedbackStep: design 수정본·잔여사이클(maxLoops=2) → spawn-feedback", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 1 },
		{ role: "design", draft: "수정본" },
		"수정본",
		undefined,
		2,
	);
	expect(t.directive.action).toBe("spawn-feedback");
	expect(t.dfPhase).toBe("feedback");
});

test("nextDesignFeedbackStep: feedback 이슈·상한 → gate(에스컬레이션)", () => {
	const outcomes: FeedbackAxisOutcome[] = [
		{ axis: a0!.name, outcome: { clean: false, issues: ["잔존X"] } },
	];
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 1 },
		{ role: "feedback", outcomes },
		"마지막초안",
		undefined,
		1,
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate") {
		expect(t.directive.escalated).toBe(true);
		expect(t.directive.issues.some((i) => i.includes("잔존X"))).toBe(true);
	}
});

// --- runDesignFeedbackLoop(select 로 소수 에이전트만) ---
const pick3 = (m: typeof menu) => m.slice(0, 3);

test("runDesignFeedbackLoop: 1패스 클린 → clean, design 1·feedback 3(select)", async () => {
	const spawn = new MockSpawn({
		design: ["D1"],
		feedback: ["CLEAN", "CLEAN", "CLEAN"],
	});
	const res = await runDesignFeedbackLoop(
		spawn,
		stage,
		DEFAULT_MAX_LOOPS,
		pick3,
	);
	expect(res.kind).toBe("clean");
	if (res.kind === "clean") {
		expect(res.artifact).toBe("D1");
		expect(res.loops).toBe(0);
	}
	expect(spawn.calls.filter((c) => c.role === "design")).toHaveLength(1);
	expect(spawn.calls.filter((c) => c.role === "feedback")).toHaveLength(3);
});

test("runDesignFeedbackLoop: 이슈 1회 → 수정 → gate(clean), design 2·feedback 3(1라운드)", async () => {
	const spawn = new MockSpawn({
		design: ["D1", "D2-개선"],
		feedback: ["ISSUES\n- 빠진 요구사항", "CLEAN", "CLEAN"],
	});
	const res = await runDesignFeedbackLoop(
		spawn,
		stage,
		DEFAULT_MAX_LOOPS,
		pick3,
	);
	expect(res.kind).toBe("clean");
	if (res.kind === "clean") {
		expect(res.artifact).toBe("D2-개선");
		expect(res.loops).toBe(1);
	}
	expect(spawn.calls.filter((c) => c.role === "design")).toHaveLength(2);
	expect(spawn.calls.filter((c) => c.role === "feedback")).toHaveLength(3);
});

// --- 컨텍스트 한도/정책 ---
test("CHILD_SPAWN_OPTIONS: 역할별 명명 에이전트 + hard≥1 + turnBudget", () => {
	for (const role of ["design", "feedback"] as const) {
		const opts = CHILD_SPAWN_OPTIONS[role];
		expect(opts.skill).toBe(false);
		expect(opts.context).toBe("fresh");
		expect(opts.agentName.startsWith("factorynote-")).toBe(true);
		expect(opts.toolBudget.hard).toBeGreaterThanOrEqual(1);
		expect(opts.turnBudget.maxTurns).toBeGreaterThanOrEqual(1);
	}
});

test("DEFAULT_MAX_LOOPS: 기본 사이클 상한 = 1", () => {
	expect(DEFAULT_MAX_LOOPS).toBe(1);
});

test("clampReportInput: 과대 입력 절단 — 첫 줄 보존", () => {
	expect(clampReportInput("CLEAN")).toBe("CLEAN");
	const huge = `ISSUES\n${"a".repeat(5000)}`;
	const clamped = clampReportInput(huge);
	expect(clamped.length).toBeLessThan(huge.length);
	expect(clamped.startsWith("ISSUES")).toBe(true);
	expect(clamped).toContain("절단");
});

// --- paths 모드(메뉴 경로 포함) ---
const paths: ArtifactPaths = {
	designPrompt: ".factorynote/feat/design-prompt.md",
	draft: ".factorynote/feat/draft.md",
	feedback: ".factorynote/feat/feedback.md",
	menu: ".factorynote/feat/feedback-menu.md",
};

test("paths 모드: 진입 spawn-design 이 designPrompt 경로 참조(본문 無)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		undefined,
		undefined,
		paths,
	);
	expect(t.directive.action).toBe("spawn-design");
	if (t.directive.action === "spawn-design") {
		expect(t.directive.spawnOptions.agentName).toBe("factorynote-design");
		expect(t.directive.task).toContain(paths.designPrompt);
		expect(t.directive.task).toContain(paths.draft);
		expect(t.directive.task).not.toContain("사용자의 자연어");
	}
});

test("paths 모드: design 보고 → spawn-feedback 가 menu/draft/feedback 경로", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		{ role: "design", draft: "DRAFT-BODY" },
		undefined,
		paths,
	);
	expect(t.directive.action).toBe("spawn-feedback");
	if (t.directive.action === "spawn-feedback") {
		expect(t.directive.menuPath).toBe(paths.menu);
		expect(t.directive.draftPath).toBe(paths.draft);
		expect(t.directive.feedbackPath).toBe(paths.feedback);
	}
});

test("paths 모드: feedback 클린 → gate artifact = draft 경로", () => {
	const outcomes: FeedbackAxisOutcome[] = [
		{ axis: a0!.name, outcome: { clean: true as const } },
	];
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 0 },
		{ role: "feedback", outcomes },
		undefined,
		paths,
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate")
		expect(t.directive.artifact).toBe(paths.draft);
});

test("designTask: paths 미제공 시 designPrompt 본문(inline)", () => {
	expect(designTask(stage)).toBe(stage.designPrompt);
});

// --- Feedback 수준(ADR-017) ---
test("FEEDBACK_LEVELS: 수준별 에이전트 수 스펙(none 0 · low 1 · medium 2-3 · high 4-6 · ultra 9)", () => {
	expect(FEEDBACK_LEVELS.none.maxAgents).toBe(0);
	expect(FEEDBACK_LEVELS.low.minAgents).toBe(1);
	expect(FEEDBACK_LEVELS.low.maxAgents).toBe(1);
	expect(FEEDBACK_LEVELS.medium.minAgents).toBe(2);
	expect(FEEDBACK_LEVELS.medium.maxAgents).toBe(3);
	expect(FEEDBACK_LEVELS.high.minAgents).toBe(4);
	expect(FEEDBACK_LEVELS.high.maxAgents).toBe(6);
	expect(FEEDBACK_LEVELS.ultra.minAgents).toBe(9);
	expect(FEEDBACK_LEVELS.ultra.maxAgents).toBe(9);
	expect(DEFAULT_FEEDBACK_LEVEL).toBe("medium");
	expect(feedbackLevelCountSpec("high")).toBe("4~6개");
	expect(feedbackLevelCountSpec("ultra")).toBe("정확히 9개");
	expect(feedbackLevelCountSpec("low")).toContain("정확히 1개");
});

test("수준 none: design 보고 → gate(Feedback 루프 스킵 — opt-in Tier 0)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		{ role: "design", draft: "v1" },
		"v1",
		undefined,
		DEFAULT_MAX_LOOPS,
		"none",
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate") {
		expect(t.directive.escalated).toBe(false);
		expect(t.directive.artifact).toBe("v1");
	}
	expect(t.dfLoop).toBe(0);
});

test("수준 전달: spawn-feedback 지시문이 feedbackLevel 을 운반", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		{ role: "design", draft: "v1" },
		"v1",
		undefined,
		DEFAULT_MAX_LOOPS,
		"high",
	);
	expect(t.directive.action).toBe("spawn-feedback");
	if (t.directive.action === "spawn-feedback") {
		expect(t.directive.feedbackLevel).toBe("high");
	}
});

test("runDesignFeedbackLoop: 수준 none → design 1회 스폰 후 clean 직행(feedback 스폰 0)", async () => {
	const spawn = new MockSpawn({ design: ["D1"], feedback: [] });
	const res = await runDesignFeedbackLoop(
		spawn,
		stage,
		DEFAULT_MAX_LOOPS,
		undefined,
		"none",
	);
	expect(res.kind).toBe("clean");
	expect(spawn.calls.length).toBe(1);
	expect(spawn.calls[0]!.role).toBe("design");
});
