// drivePlan 종단 간 스모크(Tier 1 병렬 팬아웃) — factorynote_plan 의 오케스트레이션 흐름:
// spawn-design → Design 보고 → spawn-feedback(축별 병렬) → Feedback 보고 → 게이트(웹) → 결정/검토요청 → 전이.
// Director 에이전트를 흉내내어 내부 사이클을 게이트까지 구동해 계약(#2/#7, ADR-013) 을 검증.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("ADR-018·020: 그래프 트리 승격 — 에이전트 이름 그대로 다중 승격 + 고아 제외 + confirm → stage 3", async () => {
	const feat = "graphfeat";
	await saveState(root, { ...initialState(feat), stage: 2 });
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
	} as const;
	// 에이전트가 지은 자유 이름 2개(ADR-020) — 본문 각 위치에 인라인 참조.
	const draftMd =
		"# 설계\n\n<!-- graph: module-deps.json -->\n\n아키텍처 설명.\n\n<!-- graph: data-flow.json -->\n\n데이터 흐름.\n";
	const rootJson = JSON.stringify({
		version: 2,
		childLevel: "modules",
		nodes: [
			{
				id: "ui",
				label: "UI",
				layer: "API",
				children: "modules/ui.json",
			},
		],
	});
	const uiJson = JSON.stringify({
		version: 2,
		id: "ui",
		childLevel: "classes",
		nodes: [{ id: "View", type: "class", name: "View" }],
	});
	const flowJson = JSON.stringify({
		version: 2,
		childLevel: "steps",
		nodes: [{ id: "ingest", label: "수집" }],
	});
	const onReady = postDecision("confirm");

	let out = await drivePlan({ ...base, onReady });
	expect(out.nextAction).toBe("spawn-design");
	await writeFile(out.draftPath!, draftMd, "utf8");
	await writeFile(join(root, feat, "module-deps.json"), rootJson, "utf8");
	await mkdir(join(root, feat, "module-deps", "modules"), {
		recursive: true,
	});
	await writeFile(
		join(root, feat, "module-deps", "modules", "ui.json"),
		uiJson,
		"utf8",
	);
	// 고아 파일: 이전 사이클 잔여 — 어떤 children 에도 참조되지 않아 승격에서 제외돼야 함.
	await writeFile(
		join(root, feat, "module-deps", "modules", "orphan.json"),
		"{}",
		"utf8",
	);
	await writeFile(join(root, feat, "data-flow.json"), flowJson, "utf8");

	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.nextAction).toBe("spawn-feedback");
	out = await drivePlan({
		...base,
		designArtifact: out.draftPath!,
		feedbackResult: "CLEAN",
		onReady,
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(3);

	// md 는 에이전트 이름을 그대로 유지(rewrite 없음)하고, 두 트리가 stage2/ 에 승격.
	const promoted = await readArtifact(root, feat, "02-design.md");
	expect(promoted).toContain("<!-- graph: module-deps.json -->");
	expect(promoted).toContain("<!-- graph: data-flow.json -->");
	expect(await readArtifact(root, feat, "stage2/module-deps.json")).toBe(
		rootJson,
	);
	expect(
		await readArtifact(root, feat, "stage2/module-deps/modules/ui.json"),
	).toBe(uiJson);
	expect(await readArtifact(root, feat, "stage2/data-flow.json")).toBe(
		flowJson,
	);
	// 고아 파일은 승격되지 않는다.
	expect(
		await readArtifact(root, feat, "stage2/module-deps/modules/orphan.json"),
	).toBeUndefined();
});

test("단계별 스폰 명령 분기: Stage 1 그래프 언급 없음 · Stage 2 필수 · Stage 3 선택", async () => {
	const b = { root, viewerDistDir: VIEWER_DIST, open: false } as const;
	const out1 = await drivePlan({ ...b, feature: "graphcmd1" });
	expect(out1.spawnTask).not.toContain("그래프");
	await saveState(root, { ...initialState("graphcmd2"), stage: 2 });
	const out2 = await drivePlan({ ...b, feature: "graphcmd2" });
	expect(out2.spawnTask).toContain("필수");
	expect(out2.spawnTask).toContain("module-deps.json");
	await saveState(root, { ...initialState("graphcmd3"), stage: 3 });
	const out3 = await drivePlan({ ...b, feature: "graphcmd3" });
	expect(out3.spawnTask).toContain("선택");
	expect(out3.spawnTask).not.toContain("필수");
});

test("Stage 2 그래프 강제: 그래프 없는 draft → 자동 반려(재작성 지시) → 그래프 완성 → 게이트 진행", async () => {
	const feat = "graphreq";
	await saveState(root, { ...initialState(feat), stage: 2 });
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
	} as const;
	const onReady = postDecision("confirm");

	let out = await drivePlan({ ...base, onReady });
	expect(out.nextAction).toBe("spawn-design");

	// v1: 그래프 없음 → Feedback 가지 않고 재작성 반려(spawn-design)
	await writeFile(out.draftPath!, "# 설계\n\n그래프 없음.\n", "utf8");
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.nextAction).toBe("spawn-design");
	expect(out.spawnTask).toContain("그래프");
	expect(out.spawnTask).toContain("필수");

	// v2: 참조 코멘트 + 유효 루트 json → 진행(dfLoop 소진으로 게이트 직행 → confirm)
	await writeFile(
		out.draftPath!,
		"<!-- graph: draft-graph.json -->\n# 설계\n",
		"utf8",
	);
	await writeFile(
		join(root, feat, "draft-graph.json"),
		JSON.stringify({ version: 2, childLevel: "modules", nodes: [] }),
		"utf8",
	);
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(3);
});

test("Stage 2 그래프 강제: 재작성 상한 소진 → 게이트 에스컬레이션", async () => {
	const feat = "graphesc";
	await saveState(root, { ...initialState(feat), stage: 2 });
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
	} as const;
	const onReady = postDecision("confirm");

	let out = await drivePlan({ ...base, onReady });
	await writeFile(out.draftPath!, "# v1 그래프 없음", "utf8");
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.nextAction).toBe("spawn-design"); // 반려 1회(수정 지시)
	await writeFile(out.draftPath!, "# v2 여전히 그래프 없음", "utf8");
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	// 상한 소진 → 게이트 에스컬레이션 안내(잔존 이슈에 그래프 필수 명시)
	expect(out.message).toContain("필수");
	expect(out.message).toContain("그래프");
});

test("게이트 전이 시 design-prompt.md 갱신: Stage 1 confirm → Stage 2 지시(그래프 프로토콜 포함)", async () => {
	const feat = "promptcarry";
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
	} as const;
	const onReady = postDecision("confirm");

	let out = await drivePlan({ ...base, onReady });
	expect(out.nextAction).toBe("spawn-design");
	await writeFile(out.draftPath!, "# 요구사항 v1\n", "utf8");
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.nextAction).toBe("spawn-feedback");
	out = await drivePlan({
		...base,
		designArtifact: out.draftPath!,
		feedbackResult: "CLEAN",
		onReady,
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(2);
	// 전이 직후 자식 스폰 전에 작성 지시가 Stage 2 것으로 갱신돼야 한다.
	const prompt = await readArtifact(root, feat, "design-prompt.md");
	expect(prompt).toContain("계층 그래프");
});

test("Stage 2 그래프 강제: 참조 코멘트에 경로 포함(규약 위반) → 파일명 전용 안내로 반려 + 반려 라운드에도 지시 파일 갱신", async () => {
	const feat = "graphpath";
	await saveState(root, { ...initialState(feat), stage: 2 });
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
	} as const;
	const onReady = postDecision("confirm");

	let out = await drivePlan({ ...base, onReady });
	expect(out.nextAction).toBe("spawn-design");
	// 이전 단계 잔여 지시 시뮬레이션 — 반려 라운드에도 현 단계 지시로 갱신돼야 한다.
	await writeArtifact(root, feat, "design-prompt.md", "STALE stage1 prompt");
	await writeFile(
		out.draftPath!,
		"<!-- graph: graph/chat.graph.json -->\n# 설계\n",
		"utf8",
	);
	out = await drivePlan({ ...base, designArtifact: out.draftPath!, onReady });
	expect(out.nextAction).toBe("spawn-design"); // 반려(재작성 지시)
	expect(out.spawnTask).toContain("파일명만");
	expect(await readArtifact(root, feat, "design-prompt.md")).toContain(
		"계층 그래프",
	);
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

test("ADR-017: feedbackLevel none → design 보고가 Feedback 스폰 없이 게이트 직행(opt-in Tier 0)", async () => {
	const feat = "fblevel-none";
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
		feedbackLevel: "none" as const,
	};
	let out = await drivePlan({ ...base });
	expect(out.nextAction).toBe("spawn-design");
	await writeFile(out.draftPath!, "# none 수준 산출물\n", "utf8");

	// 두 번째 호출에서 곧장 게이트 → confirm — spawn-feedback 는 결코 오지 않는다.
	out = await drivePlan({
		...base,
		designArtifact: out.draftPath!,
		onReady: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(2);
	expect(out.nextAction).toBe("spawn-design");
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe("# none 수준 산출물\n");
});

test("ADR-017: feedbackLevel high → spawn-feedback 지시문에 4~6개 수 지시 + 배치 분할 규칙", async () => {
	const feat = "fblevel-high";
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
		feedbackLevel: "high" as const,
	};
	let out = await drivePlan({ ...base });
	await writeFile(out.draftPath!, "# v1\n", "utf8");
	out = await drivePlan({ ...base, designArtifact: out.draftPath! });
	expect(out.nextAction).toBe("spawn-feedback");
	expect(out.feedbackLevel).toBe("high");
	expect(out.message).toContain("4~6");
	expect(out.message).toContain("3-4개씩 순차 배치");
	// 메뉴 파일에도 수준이 반영된다.
	const menuMd = readFileSync(join(root, feat, "feedback-menu.md"), "utf8");
	expect(menuMd).toContain("**high**");
});

test("ADR-017: feedbackLevel low → 정확히 1개(1~3 영역 담당) 지시", async () => {
	const feat = "fblevel-low";
	const base = {
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
		feedbackLevel: "low" as const,
	};
	let out = await drivePlan({ ...base });
	await writeFile(out.draftPath!, "# v1\n", "utf8");
	out = await drivePlan({ ...base, designArtifact: out.draftPath! });
	expect(out.nextAction).toBe("spawn-feedback");
	expect(out.feedbackLevel).toBe("low");
	expect(out.message).toContain("정확히 1개");
	expect(out.message).toContain("1~3개 검토 영역");
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
