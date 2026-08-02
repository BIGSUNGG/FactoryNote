// gate-server 셀프체크(계약 #5) — 뷰어 서빙 + /api/state + POST /api/decision 를
// 실제 HTTP 로 검증. LLM/pi 불필요. 실행: bun test apps/pi-extension
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import { runGate } from "./gate-server.ts";
import {
	initialState,
	markArtifactReady,
	saveState,
	writeArtifact,
} from "@factorynote/core";

const VIEWER_DIST = join(
	import.meta.dir,
	"../../../prototypes/plan-page-mockup/dist",
);

let root: string;

test("setup", async () => {
	root = await mkdtemp(join(tmpdir(), "factorynote-gate-"));
	// Stage 1 산출물 + 게이트 대기 상태 준비.
	await writeArtifact(
		root,
		"demo",
		"01-requirements.md",
		"# 요구사항\n\n데모.",
	);
	let s = initialState("demo");
	s = markArtifactReady(s);
	await saveState(root, s);
});

test("gate server serves viewer, state, and accepts decision", async () => {
	// 뷰어가 빌드되어 있어야 함(계약 #5).
	await access(join(VIEWER_DIST, "index.html"));

	const captured: {
		state?: { feature?: string; stage?: number };
		indexHtml?: string;
		decOk?: boolean;
	} = {};

	const decision = await runGate({
		root,
		feature: "demo",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			const stateRes = await fetch(`${url}/api/state`);
			captured.state = (await stateRes.json()) as {
				feature?: string;
				stage?: number;
			};
			const idxRes = await fetch(`${url}/`);
			captured.indexHtml = await idxRes.text();
			const decRes = await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
			captured.decOk = decRes.ok;
		},
	});

	expect(captured.state?.feature).toBe("demo");
	expect(captured.state?.stage).toBe(1);
	expect(captured.indexHtml ?? "").toMatch(/<html|<div id="root"|FactoryNote/i);
	expect(captured.decOk).toBe(true);
	expect(decision.verdict).toBe("confirm");
});

test("gate /api/state returns graphSections for graph artifact", async () => {
	// 그래프 산물(03-modules.json) + stage 3 시드.
	await writeArtifact(
		root,
		"graphdemo",
		"03-modules.json",
		JSON.stringify({
			sections: [
				{ id: "fe", title: "프론트", nodes: [{ id: "UI" }], edges: [] },
			],
		}),
	);
	await saveState(root, { ...initialState("graphdemo"), stage: 3 });

	type StateResp = {
		artifacts: Array<{
			file: string;
			format: string;
			graphSections?: unknown[];
		}>;
	};
	const captured: { graphSections?: unknown[] } = {};

	await runGate({
		root,
		feature: "graphdemo",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			const res = await fetch(`${url}/api/state`);
			const st = (await res.json()) as StateResp;
			const art = st.artifacts.find((a) => a.file === "03-modules.json");
			if (art?.graphSections) captured.graphSections = art.graphSections;
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});

	expect(captured.graphSections).toBeTruthy();
	expect(captured.graphSections as unknown[]).toHaveLength(1);
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
