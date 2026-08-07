// Orchestration(Tier 1 Design↔Feedback 루프) 자체체크 — 검증계약 하드 게이트.
// 목 AgentSpawn 으로 스폰→루프→상한→에스컬레이션→게이트 전이를 결정론적 검증.
// 실행: bun test packages/factorynote
import { test, expect } from "bun:test";
import { STAGES } from "./stages.ts";
import {
	MAX_DESIGN_FEEDBACK_LOOPS,
	nextDesignFeedbackStep,
	parseFeedback,
	runDesignFeedbackLoop,
} from "./orchestration.ts";
import type { AgentSpawn, AgentRole } from "./types.ts";

/** 역할별로 큐잉된 응답을 순서대로 반환하는 목 스폰. */
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

const stage = STAGES[0]!; // Stage 1 (markdown)

test("parseFeedback: CLEAN → 클린", () => {
	expect(parseFeedback("CLEAN")).toEqual({ clean: true });
	expect(parseFeedback("VERDICT: CLEAN")).toEqual({ clean: true });
});

test("parseFeedback: ISSUES 헤더 + 줄 → 이슈 배열", () => {
	expect(parseFeedback("ISSUES\n- 순환 의존성\n- 과잉 추상화")).toEqual({
		clean: false,
		issues: ["순환 의존성", "과잉 추상화"],
	});
});

test("parseFeedback: 규약 위반 → 안전 기본값 ISSUES(자동 통과 금지)", () => {
	const out = parseFeedback("그냥 평문");
	expect(out.clean).toBe(false);
	if (!out.clean) expect(out.issues.length).toBeGreaterThan(0);
});

test("nextDesignFeedbackStep: 진입 → spawn-design(designPrompt)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		undefined,
		undefined,
	);
	expect(t.directive.action).toBe("spawn-design");
	expect(t.dfPhase).toBe("design");
	if (t.directive.action === "spawn-design") {
		expect(t.directive.task).toBe(stage.designPrompt);
		expect(t.directive.loop).toBe(0);
	}
});

test("nextDesignFeedbackStep: design 보고 → spawn-feedback", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		{ role: "design", draft: "초안" },
		"초안",
	);
	expect(t.directive.action).toBe("spawn-feedback");
	expect(t.dfPhase).toBe("feedback");
	if (t.directive.action === "spawn-feedback") {
		expect(t.directive.task).toContain("초안");
		expect(t.directive.task).toContain(stage.feedbackChecklist[0]!);
	}
});

test("nextDesignFeedbackStep: feedback 클린 → gate(에스컬레이션 아님)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 0 },
		{ role: "feedback", outcome: { clean: true } },
		"초안",
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate") {
		expect(t.directive.escalated).toBe(false);
		expect(t.directive.artifact).toBe("초안");
		expect(t.directive.issues).toEqual([]);
	}
});

test("nextDesignFeedbackStep: feedback 이슈·미상한 → spawn-design + dfLoop 증가", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 0 },
		{ role: "feedback", outcome: { clean: false, issues: ["이슈A"] } },
		"초안",
	);
	expect(t.directive.action).toBe("spawn-design");
	expect(t.dfLoop).toBe(1);
	expect(t.dfPhase).toBe("design");
	if (t.directive.action === "spawn-design") {
		expect(t.directive.task).toContain("이슈A");
		expect(t.directive.loop).toBe(1);
	}
});

test("nextDesignFeedbackStep: feedback 이슈·상한 도달 → gate(에스컬레이션)", () => {
	const ceiling = MAX_DESIGN_FEEDBACK_LOOPS - 1;
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: ceiling },
		{ role: "feedback", outcome: { clean: false, issues: ["잔존X"] } },
		"마지막초안",
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate") {
		expect(t.directive.escalated).toBe(true);
		expect(t.directive.artifact).toBe("마지막초안");
		expect(t.directive.issues).toContain("잔존X");
	}
});

test("runDesignFeedbackLoop: 1패스 클린 → clean 결과, design 1회·feedback 1회 스폰", async () => {
	const spawn = new MockSpawn({
		design: ["D1"],
		feedback: ["CLEAN"],
	});
	const res = await runDesignFeedbackLoop(spawn, stage);
	expect(res.kind).toBe("clean");
	if (res.kind === "clean") {
		expect(res.artifact).toBe("D1");
		expect(res.loops).toBe(0);
	}
	expect(spawn.calls.filter((c) => c.role === "design")).toHaveLength(1);
	expect(spawn.calls.filter((c) => c.role === "feedback")).toHaveLength(1);
});

test("runDesignFeedbackLoop: 이슈 1회 후 클린 → clean, design 2회·feedback 2회", async () => {
	const spawn = new MockSpawn({
		design: ["D1", "D2-개선"],
		feedback: ["ISSUES\n- 빠진 요구사항", "CLEAN"],
	});
	const res = await runDesignFeedbackLoop(spawn, stage);
	expect(res.kind).toBe("clean");
	if (res.kind === "clean") {
		expect(res.artifact).toBe("D2-개선");
		expect(res.loops).toBe(1);
	}
	expect(spawn.calls.filter((c) => c.role === "design")).toHaveLength(2);
	expect(spawn.calls.filter((c) => c.role === "feedback")).toHaveLength(2);
});

test("runDesignFeedbackLoop: 상한까지 이슈 → escalate, design·feedback 각 MAX 회", async () => {
	// MAX_DESIGN_FEEDBACK_LOOPS 만큼 design/feedback 시도 후 상한 도달.
	const design = Array.from(
		{ length: MAX_DESIGN_FEEDBACK_LOOPS },
		(_, i) => `D${i + 1}`,
	);
	const feedback = Array.from(
		{ length: MAX_DESIGN_FEEDBACK_LOOPS },
		(_, i) => `ISSUES\n- 이슈${i + 1}`,
	);
	const spawn = new MockSpawn({ design, feedback });
	const res = await runDesignFeedbackLoop(spawn, stage);
	expect(res.kind).toBe("escalate");
	if (res.kind === "escalate") {
		expect(res.issues.length).toBeGreaterThan(0);
		expect(res.artifact).toBe(`D${MAX_DESIGN_FEEDBACK_LOOPS}`);
	}
	expect(spawn.calls.filter((c) => c.role === "design")).toHaveLength(
		MAX_DESIGN_FEEDBACK_LOOPS,
	);
	expect(spawn.calls.filter((c) => c.role === "feedback")).toHaveLength(
		MAX_DESIGN_FEEDBACK_LOOPS,
	);
});

test("runDesignFeedbackLoop: Feedback 과제에 체크리스트·산출물 포함", async () => {
	const spawn = new MockSpawn({ design: ["D1"], feedback: ["CLEAN"] });
	await runDesignFeedbackLoop(spawn, stage);
	const fb = spawn.calls.find((c) => c.role === "feedback");
	expect(fb?.task).toContain("D1");
	expect(fb?.task).toContain(stage.feedbackChecklist[0]);
});
