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

test("gate /api/state returns Stage 2 design md + 그래프 3종 혼합 서빙(ADR-018·020·021)", async () => {
	// Stage 2 산물: md 는 참조 코멘트만, 그래프는 종류별 파일(트리·sequence·flowchart).
	// 에이전트 자유 이름 + 기존 고정 이름(02-design-graph.json, 구 산출물 호환).
	const designMd =
		"# 설계\n\n<!-- graph: module-map.json -->\n\n## 아키텍처 설명\n\n프론트 계층.\n\n<!-- graph: login-seq.json -->\n\n<!-- graph: build-flow.json -->\n\n<!-- graph: 02-design-graph.json -->\n";
	const rootJson = JSON.stringify({
		version: 2,
		title: "모듈 관계도",
		childLevel: "modules",
		nodes: [
			{
				id: "UI",
				label: "UI",
				layer: "API",
				children: "modules/UI.json",
				refs: [{ to: "API", comment: "호출" }],
			},
			{ id: "API", label: "API", layer: "Service" },
		],
	});
	const uiJson = JSON.stringify({
		version: 2,
		id: "UI",
		childLevel: "classes",
		nodes: [{ id: "View", type: "class", name: "View", module: "UI" }],
	});
	await writeArtifact(root, "graphdemo", "02-design.md", designMd);
	await writeArtifact(root, "graphdemo", "stage2/module-map.json", rootJson);
	await writeArtifact(
		root,
		"graphdemo",
		"stage2/module-map/modules/UI.json",
		uiJson,
	);
	// 구 규약 고정 이름 산출물 — stage2/ 에 그대로 남아 있으면 계속 서빙돼야 한다.
	await writeArtifact(
		root,
		"graphdemo",
		"stage2/02-design-graph.json",
		JSON.stringify({
			version: 2,
			nodes: [{ id: "legacy", label: "구 그래프" }],
		}),
	);
	// sequence·flowchart 단일 파일 그래프(ADR-021).
	await writeArtifact(
		root,
		"graphdemo",
		"stage2/login-seq.json",
		JSON.stringify({
			version: 2,
			type: "sequence",
			title: "로그인 흐름",
			participants: [
				{ id: "ui", name: "UI" },
				{ id: "auth", name: "Auth" },
			],
			body: [
				{ from: "ui", to: "auth", label: "로그인 요청" },
				{
					kind: "loop",
					label: "재시도",
					body: [{ from: "auth", to: "ui", label: "응답", kind: "reply" }],
				},
			],
		}),
	);
	await writeArtifact(
		root,
		"graphdemo",
		"stage2/build-flow.json",
		JSON.stringify({
			version: 2,
			type: "flowchart",
			nodes: [
				{ id: "start", label: "시작", shape: "terminal" },
				{ id: "build", label: "빌드" },
				{ id: "check", label: "검사", shape: "decision" },
			],
			edges: [
				{ from: "start", to: "build" },
				{ from: "build", to: "check", label: "완료" },
			],
		}),
	);
	await saveState(root, { ...initialState("graphdemo"), stage: 2 });

	type TreeResp = {
		file: string;
		childLevel?: string;
		nodes: Array<{ id: string; children?: TreeResp }>;
	};
	type GraphResp = {
		file: string;
		type: string;
		data: TreeResp | Record<string, unknown>;
	};
	type StateResp = {
		artifacts: Array<{
			file: string;
			format: string;
			md?: string;
			graphs?: GraphResp[];
		}>;
	};
	const captured: {
		md: string | undefined;
		format: string | undefined;
		graphFiles: string[];
		graphTypes: Record<string, string>;
		rootNodes: number | undefined;
		uiClassCount: number | undefined;
		legacyNodes: number | undefined;
		seqParticipants: number | undefined;
		seqFragmentKind: string | undefined;
		flowNodes: number | undefined;
	} = {
		md: undefined,
		format: undefined,
		graphFiles: [],
		graphTypes: {},
		rootNodes: undefined,
		uiClassCount: undefined,
		legacyNodes: undefined,
		seqParticipants: undefined,
		seqFragmentKind: undefined,
		flowNodes: undefined,
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
				captured.graphFiles = (art.graphs ?? []).map((g) => g.file);
				for (const g of art.graphs ?? []) captured.graphTypes[g.file] = g.type;
				const main = art.graphs?.find((g) => g.file === "module-map.json");
				const mainTree = main?.data as TreeResp | undefined;
				captured.rootNodes = mainTree?.nodes.length;
				captured.uiClassCount = mainTree?.nodes.find(
					(n) => n.id === "UI",
				)?.children?.nodes.length;
				const legacy = art.graphs?.find(
					(g) => g.file === "02-design-graph.json",
				);
				captured.legacyNodes = (
					legacy?.data as TreeResp | undefined
				)?.nodes.length;
				const seq = art.graphs?.find((g) => g.file === "login-seq.json")
					?.data as
					| { participants: unknown[]; body: Array<{ kind?: string }> }
					| undefined;
				captured.seqParticipants = seq?.participants.length;
				captured.seqFragmentKind = seq?.body.find((it) => it.kind)?.kind;
				captured.flowNodes = (
					art.graphs?.find((g) => g.file === "build-flow.json")?.data as
						| { nodes: unknown[] }
						| undefined
				)?.nodes.length;
			}
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});

	expect(captured.format).toBe("markdown");
	expect(captured.md).toContain("<!-- graph: module-map.json -->");
	expect(captured.graphFiles).toEqual([
		"module-map.json",
		"login-seq.json",
		"build-flow.json",
		"02-design-graph.json",
	]);
	expect(captured.graphTypes).toEqual({
		"module-map.json": "tree",
		"login-seq.json": "sequence",
		"build-flow.json": "flowchart",
		"02-design-graph.json": "tree",
	});
	expect(captured.rootNodes).toBe(2);
	expect(captured.uiClassCount).toBe(1);
	expect(captured.legacyNodes).toBe(1);
	expect(captured.seqParticipants).toBe(2);
	expect(captured.seqFragmentKind).toBe("loop");
	expect(captured.flowNodes).toBe(3);
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
