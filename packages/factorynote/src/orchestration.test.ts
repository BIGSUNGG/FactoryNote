// Orchestration(Tier 1 Design↔Feedback 루프) 자체체크 — 검증계약 하드 게이트.
// 목 AgentSpawn 으로 스폰→루프→상한→에스컬레이션→게이트 전이를 결정론적 검증.
// 실행: bun test packages/factorynote
import { test, expect } from "bun:test";
import { STAGES } from "./stages.ts";
import {
	CHILD_SPAWN_OPTIONS,
	MAX_DESIGN_FEEDBACK_LOOPS,
	clampReportInput,
	nextDesignFeedbackStep,
	parseFeedback,
	runDesignFeedbackLoop,
} from "./orchestration.ts";
import type { AgentSpawn, AgentRole, ArtifactPaths } from "./types.ts";

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

// --- 컨텍스트 한도 관리: paths(파일 경로) 모드 + spawnOptions ---
// GLM-5.2(기본 202K) 한도 초과(1261) 방지 — 큰 페이로드는 파일로, Director 컨텍스트 누적 차단.
const paths: ArtifactPaths = {
	designPrompt: ".factorynote/feat/design-prompt.md",
	draft: ".factorynote/feat/draft.md",
	feedback: ".factorynote/feat/feedback.md",
};

test("CHILD_SPAWN_OPTIONS(방향1+2): 역할별 명명 에이전트 + hard≥1 toolBudget + turnBudget", () => {
	for (const role of ["design", "feedback"] as const) {
		const opts = CHILD_SPAWN_OPTIONS[role];
		expect(opts.skill).toBe(false);
		expect(opts.context).toBe("fresh");
		expect(opts.agentName).toBe(`factorynote-${role}`);
		expect(opts.toolBudget.hard).toBeGreaterThanOrEqual(1);
		expect(opts.turnBudget.maxTurns).toBeGreaterThanOrEqual(1);
	}
});

test("clampReportInput(방향3b): 과대 보고 입력 절단 — 첫 줄(판정/경로) 보존", () => {
	expect(clampReportInput("CLEAN")).toBe("CLEAN");
	expect(clampReportInput(".factorynote/x/draft.md")).toBe(
		".factorynote/x/draft.md",
	);
	const huge = `ISSUES\n${"a".repeat(5000)}`;
	const clamped = clampReportInput(huge);
	expect(clamped.length).toBeLessThan(huge.length);
	expect(clamped.startsWith("ISSUES")).toBe(true); // 판정 줄 보존
	expect(clamped).toContain("절단");
});

test("paths 모드: 진입 spawn-design 가 spawnOptions + designPrompt 파일 경로 참조(본문 無)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		undefined,
		undefined,
		paths,
	);
	expect(t.directive.action).toBe("spawn-design");
	if (t.directive.action === "spawn-design") {
		expect(t.directive.spawnOptions.skill).toBe(false);
		expect(t.directive.spawnOptions.context).toBe("fresh");
		expect(t.directive.spawnOptions.agentName).toBe("factorynote-design");
		expect(t.directive.spawnOptions.toolBudget.hard).toBeGreaterThanOrEqual(1);
		expect(t.directive.spawnOptions.turnBudget.maxTurns).toBeGreaterThanOrEqual(
			1,
		);
		expect(t.directive.task).toContain(paths.designPrompt);
		expect(t.directive.task).toContain(paths.draft);
		expect(t.directive.task).not.toContain("사용자의 자연어"); // designPrompt 본문 미주입
	}
});

test("paths 모드: design 보고 → spawn-feedback 가 draft 파일 경로 참조 + spawnOptions", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "design", dfLoop: 0 },
		{ role: "design", draft: "DRAFT-BODY" },
		undefined,
		paths,
	);
	expect(t.directive.action).toBe("spawn-feedback");
	if (t.directive.action === "spawn-feedback") {
		expect(t.directive.spawnOptions.context).toBe("fresh");
		expect(t.directive.task).toContain(paths.draft);
		expect(t.directive.task).toContain(paths.feedback);
		expect(t.directive.task).toContain(stage.feedbackChecklist[0]!);
		expect(t.directive.task).not.toContain("DRAFT-BODY"); // 보고 draft 본문 미주입(⑥)
	}
});

test("paths 모드: feedback 이슈 → designRevisionTask 가 designPrompt·feedback 파일 경로 참조(본문 재주입 無)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 0 },
		{ role: "feedback", outcome: { clean: false, issues: ["이슈A"] } },
		undefined,
		paths,
	);
	expect(t.directive.action).toBe("spawn-design");
	expect(t.dfLoop).toBe(1);
	if (t.directive.action === "spawn-design") {
		expect(t.directive.task).toContain(paths.feedback);
		expect(t.directive.task).toContain(paths.designPrompt);
		expect(t.directive.task).toContain("이슈A"); // 이슈 요약은 포함
		expect(t.directive.task).not.toContain("사용자의 자연어"); // designPrompt 본문 미재주입(⑤)
	}
});

test("paths 모드: feedback 클린 → gate artifact 가 draft 파일 경로(어댑터가 readArtifact resolve)", () => {
	const t = nextDesignFeedbackStep(
		stage,
		{ dfPhase: "feedback", dfLoop: 0 },
		{ role: "feedback", outcome: { clean: true } },
		undefined,
		paths,
	);
	expect(t.directive.action).toBe("gate");
	if (t.directive.action === "gate") {
		expect(t.directive.artifact).toBe(paths.draft);
	}
});
