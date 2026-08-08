// drivePlan 종단 간 스모크(Tier 1) — factorynote_plan 의 오케스트레이션 흐름:
// spawn-design → Design 보고 → spawn-feedback → Feedback 보고 → 게이트(웹) → 결정 → 전이.
// Director 에이전트를 흉내내어 내부 루프를 게이트까지 구동해 계약(#2/#7) 을 검증.
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

/** Director 에이전트 흉내: 오케스트레이션을 게이트(또는 done)까지 구동.
 *  파일 프로토콜 시뮬: spawn-design 출력의 draftPath 에 Design 산출물을 쓰고(자식 시뮬),
 *  designArtifact/feedbackResult 보고는 그 경로/판정만(본문 無) — 실제 Director 동작. */
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
		const draftPath = out.draftPath!;
		// Design 자식 시뮬: 산출물을 지정된 파일에 쓰고 반환은 경로만.
		await writeFile(draftPath, r.draft, "utf8");
		// design 보고(경로) → spawn-feedback.
		out = await drivePlan({ ...common, designArtifact: draftPath });
		if (out.nextAction !== "spawn-feedback") return out;
		// feedback 보고(판정 + draft 경로) → 게이트 오픈(클린/상한) 또는 루프.
		out = await drivePlan({
			...common,
			designArtifact: draftPath,
			feedbackResult: r.feedback,
			...(opts.decision ? { onReady: opts.decision } : {}),
		});
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
	// 스폰 옵션(core 정책) 노출: 명명 에이전트 + hard toolBudget + turnBudget.
	expect(out.spawnOptions?.skill).toBe(false);
	expect(out.spawnOptions?.context).toBe("fresh");
	expect(out.spawnOptions?.agentName).toBe("factorynote-design");
	expect(out.spawnOptions?.toolBudget.hard).toBeGreaterThanOrEqual(1);
	expect(out.spawnOptions?.turnBudget.maxTurns).toBeGreaterThanOrEqual(1);
	// 파일 프로토콜: draft/designPrompt 경로 노출, 과제는 경로 참조(본문 無).
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
	// 방향1: message 가 agent="factorynote-design" 스폰을 지시(toolBudget.block 폐지).
	expect(out.message).toContain('agent="factorynote-design"');
	expect(out.message).not.toContain("toolBudget.block");
	expect(out.message).toContain("turnBudget");
	// 방향3a: spawnTask 가 designPrompt 파일 경로를 참조하고 본문을 인라인하지 않는다.
	expect(out.spawnTask).toContain(out.draftPath!);
	expect(out.spawnTask).not.toContain("사용자의 자연어");
	// 계약 #1: 명명 에이전트 파일의 tools allowlist 가 heavy 도구를 배제한다.
	const dir = import.meta.dir;
	for (const f of ["factorynote-design.md", "factorynote-feedback.md"]) {
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
	const out = await driveUntilGate({
		feature: "fileproto",
		rounds: () => ({ draft: md, feedback: "CLEAN" }),
		decision: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	// design 보고가 경로(draftPath) 였고, 게이트가 draft 파일에서 내용을 resolve 해 저장.
	expect(
		await readArtifact(root, "fileproto", "01-understanding-and-scenarios.md"),
	).toBe(md);
	// designPrompt(불변) 파일도 어댑터가 기록했는가.
	expect(
		await readArtifact(root, "fileproto", "design-prompt.md"),
	).toBeTruthy();
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

test("Tier 1: 게이트 사용자 편집(artifactMd) 채택 → 02-design.md 저장 + stage 3", async () => {
	await saveState(root, { ...initialState("graphfeat"), stage: 2 });
	const draftMd = "# 설계\n\n초안 본문.\n";
	const editedMd = "# 설계\n\n사용자가 게이트에서 고친 본문.\n";
	const out = await driveUntilGate({
		feature: "graphfeat",
		rounds: () => ({ draft: draftMd, feedback: "CLEAN" }),
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
	// 사용자가 게이트에서 편집한 md 가 산물로 채택 저장(직접 편집 → 채택).
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
	// 원본 산출물 보존.
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe(md);
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
