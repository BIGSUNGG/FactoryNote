// drivePlan 종단 간 스모크(Tier 1) — factorynote_plan 의 오케스트레이션 흐름:
// spawn-design → Design 보고 → spawn-feedback → Feedback 보고 → 게이트(웹) → 결정 → 전이.
// Director 에이전트를 흉내내어 내부 루프를 게이트까지 구동해 계약(#2/#7) 을 검증.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import { drivePlan, type DrivePlanOutput } from "./plan-tool.ts";
import {
	initialState,
	loadState,
	readArtifact,
	saveState,
	writeArtifact,
	type Comment,
	type GateVerdict,
} from "@factorynote/core";

const VIEWER_DIST = join(import.meta.dir, "../../../apps/plan-viewer/dist");
let root: string;

const postDecision =
	(verdict: GateVerdict, comments: Comment[] = []) =>
	async (url: string) => {
		await fetch(`${url}/api/decision`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ verdict, comments }),
		});
	};

/** Director 에이전트 흉내: 오케스트레이션을 게이트(또는 done)까지 구동. */
async function driveUntilGate(opts: {
	feature: string;
	/** 매 내부 루프 라운드의 Design 초안·Feedback 결과. null 이면 종료. */
	rounds: () => { draft: string; feedback: string } | null;
	decision?: (url: string) => void | Promise<void>;
}): Promise<DrivePlanOutput> {
	const common = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: opts.feature,
		open: false,
	} as const;
	// 진입 → spawn-design.
	let out = await drivePlan(common);
	for (;;) {
		if (out.done || out.gateResult !== null) return out;
		if (out.nextAction !== "spawn-design") return out;
		const r = opts.rounds();
		if (!r) throw new Error("driveUntilGate: rounds 소진(게이트 미도달)");
		// design 보고 → spawn-feedback.
		out = await drivePlan({ ...common, designArtifact: r.draft });
		if (out.nextAction !== "spawn-feedback") return out;
		// feedback 보고 → 게이트 오픈(클린/상한) 또는 루프.
		out = await drivePlan({
			...common,
			designArtifact: r.draft,
			feedbackResult: r.feedback,
			...(opts.decision ? { onReady: opts.decision } : {}),
		});
	}
}

test("setup", async () => {
	root = await mkdtemp(join(tmpdir(), "factorynote-driver-"));
});

test("Tier 1: 진입 → spawn-design 지시문(designPrompt 과제)", async () => {
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "firstcall",
		open: false,
	});
	expect(out.stage).toBe(1);
	expect(out.nextAction).toBe("spawn-design");
	expect(out.spawnRole).toBe("design");
	expect(out.spawnTask).toBeTruthy(); // designPrompt
});

test("Tier 1: clean 루프 → confirm → stage 2 진행 + 산출물 저장", async () => {
	const md = "# 요구사항 명세\n\n데모 기능의 요구사항.";
	const out = await driveUntilGate({
		feature: "smoke",
		rounds: () => ({ draft: md, feedback: "CLEAN" }),
		decision: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(2);
	// 산출물 디스크 저장(Design 초안 = 클린 판정본).
	expect(
		await readArtifact(root, "smoke", "01-understanding-and-scenarios.md"),
	).toBe(md);
	expect((await loadState(root, "smoke"))?.stage).toBe(2);
});

test("Tier 1: 게이트 modify → stage 유지 + loopCount 증가(내부 루프는 리셋)", async () => {
	const out = await driveUntilGate({
		feature: "modfeat",
		rounds: () => ({ draft: "# 시나리오\n\nhappy path.", feedback: "CLEAN" }),
		decision: postDecision("modify", [{ text: "더 구체적으로" }]),
	});
	expect(out.gateResult?.verdict).toBe("modify");
	expect(out.stage).toBe(1);
	const st = await loadState(root, "modfeat");
	expect(st?.loopCount).toBe(1);
	expect(st?.dfLoop).toBe(0); // modify 가 내부 루프 재시작 → 0
});

test("Tier 1: 내부 루프 — Feedback 이슈 1회 후 클린 → design·feedback 2회씩", async () => {
	let round = 0;
	const drafts = ["# v1", "# v2-개선"];
	const out = await driveUntilGate({
		feature: "loopfeat",
		rounds: () => {
			const i = round++;
			if (i >= 2) return null;
			return {
				draft: drafts[i]!,
				feedback: i === 0 ? "ISSUES\n- 빠진 요구사항" : "CLEAN",
			};
		},
		decision: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	// 두 번째 초안(개선판)이 클린 판정본으로 저장.
	expect(
		await readArtifact(root, "loopfeat", "01-understanding-and-scenarios.md"),
	).toBe(drafts[1]);
});

test("Tier 1: 내부 루프 상한 → 에스컬레이션 게이트(잔존 이슈 노출)", async () => {
	let round = 0;
	const out = await driveUntilGate({
		feature: "ceilfeat",
		rounds: () => {
			const i = round++;
			if (i >= 4) return null;
			return { draft: `# v${i + 1}`, feedback: `ISSUES\n- 잔존이슈${i + 1}` };
		},
		decision: postDecision("modify"),
	});
	expect(out.gateResult).not.toBeNull();
	// 상한 도달 → 내부 에스컬레이션 프레이밍.
	expect(out.message).toMatch(/내부 Design↔Feedback 루프 상한|⚠/);
	expect(out.message).toContain("잔존이슈"); // 마지막 잔존 이슈 노출
});

test("Tier 1 graph: Design JSON → Feedback clean → 사용자 편집 그래프 채택 + stage 3", async () => {
	await saveState(root, { ...initialState("graphfeat"), stage: 2 });
	const initialGraph = {
		sections: [
			{
				id: "fe",
				title: "프론트",
				nodes: [{ id: "UI", data: { label: "UI" } }],
				edges: [],
			},
		],
	};
	const edited = {
		sections: [
			{
				id: "fe",
				title: "프론트",
				nodes: [{ id: "UI" }, { id: "API" }],
				edges: [{ id: "UI->API", source: "UI", target: "API" }],
			},
		],
	};
	const out = await driveUntilGate({
		feature: "graphfeat",
		rounds: () => ({ draft: JSON.stringify(initialGraph), feedback: "CLEAN" }),
		decision: async (url) => {
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					verdict: "confirm",
					comments: [],
					graphSections: edited.sections,
				}),
			});
		},
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(3);
	const saved = await readArtifact(root, "graphfeat", "02-design.json");
	expect(saved).toBeTruthy();
	const parsed = JSON.parse(saved ?? "{}") as {
		sections: Array<{ nodes: unknown[]; edges: Array<{ id: string }> }>;
	};
	expect(parsed.sections[0]?.nodes).toHaveLength(2);
	expect(parsed.sections[0]?.edges[0]?.id).toBe("UI->API");
});

test("#3 gateOpen resume: 게이트 열린 채 재시작 → 산출물 보존 + 재오픈", async () => {
	const feat = "resumefeat";
	const md = "# 요구사항(이미 저장됨)\n\n데모.";
	await writeArtifact(root, feat, "01-understanding-and-scenarios.md", md);
	await saveState(root, { ...initialState(feat), stage: 1, gateOpen: true });
	let posted = false;
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
		onReady: async (url) => {
			posted = true;
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});
	expect(posted).toBe(true);
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.message).toContain("게이트 재오픈(인터럽트 복구)");
	expect(out.stage).toBe(2);
	// 원본 산출물 보존.
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe(md);
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
