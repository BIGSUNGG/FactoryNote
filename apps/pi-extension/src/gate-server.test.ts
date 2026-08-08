// gate-server 셀프체크(계약 #5) — 뷰어 서빙 + /api/state + POST /api/decision 를
// 실제 HTTP 로 검증. LLM/pi 불필요. 실행: bun test apps/pi-extension
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import { runGate, closeGate } from "./gate-server.ts";
import {
	initialState,
	markArtifactReady,
	saveState,
	writeArtifact,
} from "@factorynote/core";

const VIEWER_DIST = join(import.meta.dir, "../../../apps/plan-viewer/dist");

let root: string;

test("setup", async () => {
	root = await mkdtemp(join(tmpdir(), "factorynote-gate-"));
	// Stage 1 산출물 + 게이트 대기 상태 준비.
	await writeArtifact(
		root,
		"demo",
		"01-understanding-and-scenarios.md",
		"# 요구사항·시나리오\n\n데모.",
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

	const event = await runGate({
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
	expect(event.kind).toBe("decision");
	if (event.kind === "decision") expect(event.decision.verdict).toBe("confirm");
});

test("gate /api/state returns Stage 2 design as markdown", async () => {
	// Stage 2 산물(02-design.md) + stage 2 시드.
	const designMd =
		"# 설계\n\n## 구조\n\n```factorynote-graph\n" +
		JSON.stringify({
			sections: [
				{ id: "fe", title: "프론트", nodes: [{ id: "UI" }], edges: [] },
			],
		}) +
		"\n```\n\n## 아키텍처 설명\n\n프론트 계층.";
	await writeArtifact(root, "graphdemo", "02-design.md", designMd);
	await saveState(root, { ...initialState("graphdemo"), stage: 2 });

	type StateResp = {
		artifacts: Array<{ file: string; format: string; md?: string }>;
	};
	const captured: { md: string | undefined; format: string | undefined } = {
		md: undefined,
		format: undefined,
	};

	await runGate({
		root,
		feature: "graphdemo",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			const res = await fetch(`${url}/api/state`);
			const st = (await res.json()) as StateResp;
			const art = st.artifacts.find((a) => a.file === "02-design.md");
			if (art) {
				captured.md = art.md;
				captured.format = art.format;
			}
			await fetch(`${url}/api/decision`, {
				method: "POST",
			headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});

	expect(captured.format).toBe("markdown");
	expect(captured.md).toBeTruthy();
	expect(captured.md).toContain("factorynote-graph");
});

test("gate /api/state hides artifacts past current stage on revert", async () => {
	// 회귀 시뮬레이션: state.stage=2 이지만 3단계 산출물이 디스크에 남아 있음.
	await writeArtifact(
		root,
		"regress",
		"01-understanding-and-scenarios.md",
		"# Req+Scen",
	);
	await writeArtifact(root, "regress", "02-design.md", "# 설계");
	await writeArtifact(root, "regress", "03-implementation-plan.md", "# Plan");
	await saveState(root, { ...initialState("regress"), stage: 2 });

	const captured: { stages?: number[] } = {};
	await runGate({
		root,
		feature: "regress",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			const res = await fetch(`${url}/api/state`);
			const st = (await res.json()) as { artifacts: Array<{ stage: number }> };
			captured.stages = st.artifacts.map((a) => a.stage);
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});

	expect(captured.stages).toEqual([1, 2]);
	expect(captured.stages).not.toContain(3);
});

test("gate auto-returns modify on timeoutMs without a decision POST", async () => {
	const event = await runGate({
		root,
		feature: "demo",
		viewerDistDir: VIEWER_DIST,
		open: false,
		timeoutMs: 50,
		onReady: () => {
			// 결정 POST 없음 — timeoutMs 만료가 자동 복귀해야 함(#4).
		},
	});
	expect(event.kind).toBe("decision");
	if (event.kind === "decision") {
		expect(event.decision.verdict).toBe("modify");
		expect(event.decision.comments[0]?.text).toContain("시간 초과");
	}
});

test("gate /api/decision forwards revertTo to the engine (FR-7)", async () => {
	// 회귀 대상 선택이 뷰어→서버→엔진으로 누락 없이 전달되는지(P0 회귀 가드).
	await writeArtifact(
		root,
		"revtgt",
		"01-understanding-and-scenarios.md",
		"# Req",
	);
	await writeArtifact(root, "revtgt", "02-design.md", "# 설계");
	await saveState(root, { ...initialState("revtgt"), stage: 3 });
	const event = await runGate({
		root,
		feature: "revtgt",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "revert", comments: [], revertTo: 1 }),
			});
		},
	});
	expect(event.kind).toBe("decision");
	if (event.kind === "decision") {
		expect(event.decision.verdict).toBe("revert");
		expect(event.decision.revertTo).toBe(1);
	}
});

test("영속 게이트: 연속된 게이트가 같은 서버/포트를 재사용한다", async () => {
	// 단계마다 새 포트가 아니라 기능별 하나의 서버/포트가 재사용되는지(사용자 불만: 단계마다 포트·탭 변경).
	const urls: string[] = [];
	const postConfirm = (u: string) =>
		fetch(`${u}/api/decision`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ verdict: "confirm", comments: [] }),
		});
	await runGate({
		root,
		feature: "persist",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (u) => {
			urls.push(u);
			await postConfirm(u);
		},
	});
	await runGate({
		root,
		feature: "persist",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (u) => {
			urls.push(u);
			await postConfirm(u);
		},
	});
	expect(urls).toHaveLength(2);
	expect(urls[0]).toBe(urls[1]); // 같은 포트 재사용
	await closeGate(root, "persist");
});

test("영속 게이트: 탭이 살아있으면 브라우저를 재오픈하지 않는다", async () => {
	// 뷰어 탭이 살아있는(최근 /api/state 요청) 동안은 새 단계 게이트에서 브라우저를 다시 열지 않는다(다중 탭 방지).
	let opens = 0;
	const opener = () => {
		opens++;
	};
	const heartbeat = (u: string) => fetch(`${u}/api/state`); // 뷰어 하트비트 시뮬레이션
	const postConfirm = (u: string) =>
		fetch(`${u}/api/decision`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ verdict: "confirm", comments: [] }),
		});
	await runGate({
		root,
		feature: "openonce",
		viewerDistDir: VIEWER_DIST,
		open: true,
		browserOpener: opener,
		onReady: async (u) => {
			await heartbeat(u);
			await postConfirm(u);
		},
	});
	await runGate({
		root,
		feature: "openonce",
		viewerDistDir: VIEWER_DIST,
		open: true,
		browserOpener: opener,
		onReady: async (u) => {
			await heartbeat(u);
			await postConfirm(u);
		},
	});
	expect(opens).toBe(1); // 하트비트 살아있어 2회 runGate 에도 오픈 1회
	await closeGate(root, "openonce");
});

test("영속 게이트: 탭이 닫혀(하트비트 경과) 다음 게이트 시 브라우저 재오픈", async () => {
	// 뷰어 탭이 닫혀 하트비트가 끊기면, 다음 게이트 시작 시 브라우저를 다시 연다(사용자 불만: 첫 단계에서 안 열림의 근인 — 고착 플래그 — 해결).
	let opens = 0;
	const opener = () => {
		opens++;
	};
	const postConfirm = (u: string) =>
		fetch(`${u}/api/decision`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ verdict: "confirm", comments: [] }),
		});
	await runGate({
		root,
		feature: "reopen",
		viewerDistDir: VIEWER_DIST,
		open: true,
		browserOpener: opener,
		reopenAfterMs: 30,
		onReady: async (u) => {
			await postConfirm(u);
		},
	});
	expect(opens).toBe(1); // 최초 1회 오픈
	// 탭이 닫혔다고 가정 — 하트비트 없이 reopenAfterMs 이상 대기.
	await new Promise((r) => setTimeout(r, 50));
	await runGate({
		root,
		feature: "reopen",
		viewerDistDir: VIEWER_DIST,
		open: true,
		browserOpener: opener,
		reopenAfterMs: 30,
		onReady: async (u) => {
			await postConfirm(u);
		},
	});
	expect(opens).toBe(2); // 하트비트 경과 → 재오픈
	await closeGate(root, "reopen");
});

test("gate /api/chat accepts and returns chat messages", async () => {
	const captured: { msgs?: unknown[] } = {};
	await runGate({
		root,
		feature: "chatdemo",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			await fetch(`${url}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: "이 블록 수정해줘",
					blockId: "b3",
					quote: "선택된 범위 텍스트",
				}),
			});
			const res = await fetch(`${url}/api/chat`);
			captured.msgs = ((await res.json()) as { messages: unknown[] }).messages;
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});
	const msgs = captured.msgs as Array<{
		text: string;
		blockId?: string;
		quote?: string;
		role: string;
	}>;
	expect(msgs).toHaveLength(1);
	expect(msgs[0]?.text).toBe("이 블록 수정해줘");
	expect(msgs[0]?.blockId).toBe("b3");
	expect(msgs[0]?.quote).toBe("선택된 범위 텍스트");
	expect(msgs[0]?.role).toBe("user");
	await closeGate(root, "chatdemo");
});

test("runGate resolves chat event while waiting, then decision on re-entry", async () => {
	// 게이트 대기 중 채팅 도착 → chat 이벤트; 재진입 시 결정 이벤트(게이트 유지 루프).
	const first = await runGate({
		root,
		feature: "chatrace",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			await fetch(`${url}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "질문" }),
			});
		},
	});
	expect(first.kind).toBe("chat");
	if (first.kind === "chat") expect(first.messages[0]?.text).toBe("질문");

	const second = await runGate({
		root,
		feature: "chatrace",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});
	expect(second.kind).toBe("decision");
	if (second.kind === "decision")
		expect(second.decision.verdict).toBe("confirm");
	await closeGate(root, "chatrace");
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
