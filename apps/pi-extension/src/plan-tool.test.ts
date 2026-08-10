// drivePlan 종단 간 스모크(Tier 1 병렬 팬아웃) — factorynote_plan 의 오케스트레이션 흐름:
// spawn-design → Design 보고 → spawn-feedback(축별 병렬) → Feedback 보고 → 게이트(웹) → 결정/검토요청 → 전이.
// Director 에이전트를 흉내내어 내부 사이클을 게이트까지 구동해 계약(#2/#7, ADR-013) 을 검증.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
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

/**
 * Director 에이전트 흉내: 오케스트레이션을 게이트(또는 done)까지 구동.
 * 병렬 팬아웃(ADR-013): spawn-design 마다 nextDraft 를, spawn-feedback 마다 nextFeedback 을 소비.
 * 파일 프로토콜 시뮬: Design 산출물을 draftPath 에 쓰고(자식 시뮬), 보고는 경로/판정만.
 * 게이트가 어느 호출에서 열리든 decision 이 POST 되도록 모든 호출에 onReady 부착.
 */
async function driveUntilGate(opts: {
	feature: string;
	nextDraft: () => string | null;
	nextFeedback: () => string;
	decision?: (url: string) => void | Promise<void>;
}): Promise<DrivePlanOutput> {
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: opts.feature,
		open: false,
	} as const;
	const call = (extra: Record<string, unknown>) =>
		drivePlan({
			...base,
			...(opts.decision ? { onReady: opts.decision } : {}),
			...extra,
		});
	let out = await call({});
	for (;;) {
		if (out.done || out.gateResult !== null) return out;
		if (out.nextAction === "spawn-design") {
			const d = opts.nextDraft();
			if (d === null)
				throw new Error("driveUntilGate: nextDraft 소진(게이트 미도달)");
			const draftPath = out.draftPath!;
			await writeFile(draftPath, d, "utf8");
			out = await call({ designArtifact: draftPath });
			continue;
		}
		if (out.nextAction === "spawn-feedback") {
			const draftPath = out.draftPath!;
			out = await call({
				designArtifact: draftPath,
				feedbackResult: opts.nextFeedback(),
			});
			continue;
		}
		return out;
	}
}

test("setup", async () => {
	root = await mkdtemp(join(tmpdir(), "factorynote-driver-"));
});

test("Tier 1: 진입 → spawn-design(파일 프로토콜: spawnOptions + draftPath, 본문 無)", async () => {
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "firstcall",
		open: false,
	});
	expect(out.stage).toBe(1);
	expect(out.nextAction).toBe("spawn-design");
	expect(out.spawnRole).toBe("design");
	expect(out.spawnOptions?.skill).toBe(false);
	expect(out.spawnOptions?.context).toBe("fresh");
	expect(out.spawnOptions?.agentName).toBe("factorynote-design");
	expect(out.spawnOptions?.toolBudget.hard).toBeGreaterThanOrEqual(1);
	expect(out.spawnOptions?.turnBudget.maxTurns).toBeGreaterThanOrEqual(1);
	expect(out.draftPath).toBeTruthy();
	expect(out.feedbackPath).toBeTruthy();
	expect(out.spawnTask).toContain(out.draftPath!);
	expect(out.spawnTask).not.toContain("사용자의 자연어");
});

test("방향1+3a: spawn 지시문이 agent=<명명에이전트> 지시 + spawnTask 경로 참조 + 에이전트 파일 allowlist 단언", async () => {
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "agentcheck",
		open: false,
	});
	expect(out.message).toContain('agent="factorynote-design"');
	expect(out.message).not.toContain("toolBudget.block");
	expect(out.message).toContain("turnBudget");
	expect(out.spawnTask).toContain(out.draftPath!);
	expect(out.spawnTask).not.toContain("사용자의 자연어");
	// 계약 #1: 명명 에이전트 파일의 tools allowlist 가 heavy 도구를 배제한다.
	const dir = import.meta.dir;
	for (const f of [
		"factorynote-design.md",
		"factorynote-feedback-clarity.md",
	]) {
		const md = readFileSync(join(dir, "..", "agents", f), "utf8");
		const toolsLine = md.split("\n").find((l) => l.startsWith("tools:"));
		expect(toolsLine).toBeTruthy();
		for (const banned of [
			"web_search",
			"fetch_content",
			"subagent",
			"factorynote_plan",
			"mcp",
			"ctx_index",
		]) {
			expect(toolsLine).not.toContain(banned);
		}
		expect(toolsLine).toContain("read");
		expect(toolsLine).toContain("write");
	}
});

test("Tier 1 파일 프로토콜: design 보고는 경로, 게이트는 readArtifact resolve + design-prompt.md 기록", async () => {
	const md = "# 파일 프로토콜 명세\n\n컨텍스트 누적 차단 검증.";
	let dc = 0;
	const out = await driveUntilGate({
		feature: "fileproto",
		nextDraft: () => (dc++ === 0 ? md : null),
		nextFeedback: () => "CLEAN",
		decision: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(
		await readArtifact(root, "fileproto", "01-understanding-and-scenarios.md"),
	).toBe(md);
	expect(
		await readArtifact(root, "fileproto", "design-prompt.md"),
	).toBeTruthy();
});

test("Tier 1: clean 1사이클 → confirm → stage 2 진행 + 산출물 저장", async () => {
	const md = "# 요구사항 명세\n\n데모 기능의 요구사항.";
	let dc = 0;
	const out = await driveUntilGate({
		feature: "smoke",
		nextDraft: () => (dc++ === 0 ? md : null),
		nextFeedback: () => "CLEAN",
		decision: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(2);
	expect(
		await readArtifact(root, "smoke", "01-understanding-and-scenarios.md"),
	).toBe(md);
	expect((await loadState(root, "smoke"))?.stage).toBe(2);
});

test("Tier 1: 게이트 modify → stage 유지 + loopCount 증가(내부 사이클은 리셋)", async () => {
	let dc = 0;
	const out = await driveUntilGate({
		feature: "modfeat",
		nextDraft: () => (dc++ === 0 ? "# 시나리오\n\nhappy path." : null),
		nextFeedback: () => "CLEAN",
		decision: postDecision("modify", [{ text: "더 구체적으로" }]),
	});
	expect(out.gateResult?.verdict).toBe("modify");
	expect(out.stage).toBe(1);
	const st = await loadState(root, "modfeat");
	expect(st?.loopCount).toBe(1);
	expect(st?.dfLoop).toBe(0); // modify 가 내부 사이클 재시작 → 0
});

test("Tier 1: feedback 이슈 → Design 수정 1회 → gate(개선판 저장, 재검토 없음)", async () => {
	const drafts = ["# v1", "# v2-개선"];
	let dc = 0;
	const out = await driveUntilGate({
		feature: "loopfeat",
		nextDraft: () => {
			const i = dc++;
			return i < drafts.length ? drafts[i]! : null;
		},
		nextFeedback: () => "ISSUES\n- 빠진 요구사항",
		decision: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	// 수정본(v2)이 게이트 산물로 저장(default maxLoops=1 → 수정 후 곧장 게이트).
	expect(
		await readArtifact(root, "loopfeat", "01-understanding-and-scenarios.md"),
	).toBe(drafts[1]);
});

test("Tier 1: 게이트 사용자 편집(artifactMd) 채택 → 02-design.md 저장 + stage 3", async () => {
	await saveState(root, { ...initialState("graphfeat"), stage: 2 });
	const draftMd = "# 설계\n\n초안 본문.\n";
	const editedMd = "# 설계\n\n사용자가 게이트에서 고친 본문.\n";
	let dc = 0;
	const out = await driveUntilGate({
		feature: "graphfeat",
		nextDraft: () => (dc++ === 0 ? draftMd : null),
		nextFeedback: () => "CLEAN",
		decision: async (url) => {
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					verdict: "confirm",
					comments: [],
					artifactMd: editedMd,
				}),
			});
		},
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(3);
	expect(await readArtifact(root, "graphfeat", "02-design.md")).toBe(editedMd);
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
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe(md);
});

test("검토 요청(ADF-013): 게이트 열린 동안 +1 사이클 → feedback→수정→갱신 산물", async () => {
	const feat = "reviewfeat";
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
	} as const;
	// 첫 게이트: review-request POST → 두번째 게이트: confirm POST.
	let gate = 0;
	const onReady = async (url: string) => {
		if (gate === 0) {
			gate = 1;
			await fetch(`${url}/api/review-request`, { method: "POST" });
		} else {
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		}
	};

	// 진입 → spawn-design → v1 작성.
	let out = await drivePlan({ ...base, onReady });
	expect(out.nextAction).toBe("spawn-design");
	await writeFile(out.draftPath!, "# v1 요구사항\n", "utf8");

	// design 보고 → spawn-feedback.
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.nextAction).toBe("spawn-feedback");

	// feedback 보고(CLEAN) → 게이트 오픈 → onReady 가 review-request POST → runGate 가 review-request 로 resolve → spawn-feedback(재검토) 반환.
	out = await drivePlan({
		...base,
		designArtifact: out.draftPath!,
		feedbackResult: "CLEAN",
		onReady,
	});
	expect(out.nextAction).toBe("spawn-feedback");
	expect(out.gateResult).toBeNull(); // 게이트 유지(결정 아님)

	// 검토 요청 사이클: feedback 이슈 보고 → spawn-design 수정.
	out = await drivePlan({
		...base,
		designArtifact: out.draftPath!,
		feedbackResult: "ISSUES\n- 보완 필요",
		onReady,
	});
	expect(out.nextAction).toBe("spawn-design");
	await writeFile(out.draftPath!, "# v2 수정본\n", "utf8");

	// 수정본 design 보고 → dfLoop=1 >= maxLoops(1) → 게이트 → onReady(confirm) → stage 2.
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(2);
	// 검토 요청 사이클이 반영된 수정본이 산물로 저장.
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe("# v2 수정본\n");
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
