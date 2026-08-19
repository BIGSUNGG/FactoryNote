// gate-server 셀프체크(계약 #5) — 뷰어 서빙 + /api/state + POST /api/decision 를
// 실제 HTTP 로 검증. LLM/pi 불필요. 실행: bun test apps/pi-extension
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import {
	runGate,
	closeGate,
	appendAgentChat,
	notifyViewerState,
} from "./gate-server.ts";
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

test("gate /api/state exposes prevMd for rewritten artifact (ADR-027)", async () => {
	// 단계 산출물 재작성 → .prev 스냅샷 → /api/state 페이로드에 prevMd 포함.
	await writeArtifact(
		root,
		"prevdemo",
		"01-understanding-and-scenarios.md",
		"v1 draft",
	);
	await writeArtifact(
		root,
		"prevdemo",
		"01-understanding-and-scenarios.md",
		"v2 revised",
	);
	await saveState(root, markArtifactReady(initialState("prevdemo")));

	const captured: { md?: string | undefined; prevMd?: string | undefined } = {};
	await runGate({
		root,
		feature: "prevdemo",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			const res = await fetch(`${url}/api/state`);
			const st = (await res.json()) as {
				artifacts: Array<{ file: string; md?: string; prevMd?: string }>;
			};
			const art = st.artifacts.find(
				(a) => a.file === "01-understanding-and-scenarios.md",
			);
			captured.md = art?.md;
			captured.prevMd = art?.prevMd;
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});

	expect(captured.md).toBe("v2 revised");
	expect(captured.prevMd).toBe("v1 draft");
});

test("gate /api/state serves parallel satellite design docs per stage (ADR-031)", async () => {
	// 위성 문서(draft.<role>.md)는 산출물 항목의 satellites 필드로 파일 1:1 서빙 —
	// 존재하는 파일만, 단계 메뉴 순서대로. 위성 없는 단계는 필드 생략.
	await writeArtifact(
		root,
		"satdemo",
		"01-understanding-and-scenarios.md",
		"# 주 문서",
	);
	await writeArtifact(
		root,
		"satdemo",
		"draft.requirements-scope.md",
		"# 요구사항 위성",
	);
	await writeArtifact(
		root,
		"satdemo",
		"draft.scenario-acceptance.md",
		"# 시나리오 위성",
	);
	await writeArtifact(root, "satdemo", "02-design.md", "# 설계"); // 위성 없음
	await saveState(root, {
		...markArtifactReady(initialState("satdemo")),
		stage: 2,
	});

	const captured: {
		sat1?: { file: string; md: string }[] | undefined;
		sat2?: { file: string; md: string }[] | undefined;
	} = {};
	await runGate({
		root,
		feature: "satdemo",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (url) => {
			const res = await fetch(`${url}/api/state`);
			const st = (await res.json()) as {
				artifacts: Array<{
					file: string;
					satellites?: { file: string; md: string }[];
				}>;
			};
			captured.sat1 = st.artifacts.find(
				(a) => a.file === "01-understanding-and-scenarios.md",
			)?.satellites;
			captured.sat2 = st.artifacts.find(
				(a) => a.file === "02-design.md",
			)?.satellites;
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});

	expect(captured.sat1?.map((s) => s.file)).toEqual([
		"draft.requirements-scope.md",
		"draft.scenario-acceptance.md",
	]);
	expect(captured.sat1?.[0]?.md).toBe("# 요구사항 위성");
	expect(captured.sat2).toBeUndefined();
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

test("gate /api/events SSE: appendAgentChat·notifyViewerState 가 클라이언트에 push", async () => {
	// 폴링 대체 — 서버가 상태·채팅 변경 시점에만 data 프레임을 보낸다.
	let collected = "";
	const event = await runGate({
		root,
		feature: "ssepush",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (u) => {
			// SSE 클라이언트 연결(스트리밍 응답 유지).
			const res = await fetch(`${u}/api/events`);
			const reader = res.body!.getReader();
			const dec = new TextDecoder();
			await reader.read(); // connected 코멘트 프레임 소비
			// 트리거: 채팅 회신 + 상태(산물) 변경 push.
			appendAgentChat(root, "ssepush", "안녕");
			notifyViewerState(root, "ssepush");
			// 두 이벤트 프레임이 올 때까지 읽기(네트워크 합쳐질 수 있음).
			for (let i = 0; i < 10 && collected.split("event:").length - 1 < 2; i++) {
				const { value, done } = await reader.read();
				if (done) break;
				collected += dec.decode(value, { stream: true });
			}
			await reader.cancel();
			await fetch(`${u}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});
	expect(collected).toContain("event: chat");
	expect(collected).toContain("event: state");
	expect(event.kind).toBe("decision");
	await closeGate(root, "ssepush");
});

test("영속 게이트: SSE 연결이 살아있으면 하트비트 경과해도 재오픈 안 함", async () => {
	// 폴링 제거 후 SSE 연결 자체가 탭 생존 하트비트 — lastSeen 이 오래되도 클라이언트가 있으면 재오픈 생략.
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
	// ponytail: reader 타입 단언(any) — TS 가 클로저 내 대입을 추론 못 해 never 로 좁혀진다. 테스트 코드.
	let sseReader: any = null;
	await runGate({
		root,
		feature: "ssehb",
		viewerDistDir: VIEWER_DIST,
		open: true,
		browserOpener: opener,
		reopenAfterMs: 30,
		onReady: async (u) => {
			// SSE 연결 = 탭 생존. 결정 POST 와 무관하게 reader 를 보유해 연결 유지.
			const res = await fetch(`${u}/api/events`);
			sseReader = res.body!.getReader();
			await sseReader.read(); // connected 소비
			await postConfirm(u);
		},
	});
	expect(opens).toBe(1); // 최초 1회 오픈
	// lastSeen 갱신 없이 reopenAfterMs 초과 대기 — 하지만 SSE 클라이언트가 살아있음.
	await new Promise((r) => setTimeout(r, 50));
	await runGate({
		root,
		feature: "ssehb",
		viewerDistDir: VIEWER_DIST,
		open: true,
		browserOpener: opener,
		reopenAfterMs: 30,
		onReady: async (u) => {
			await postConfirm(u);
		},
	});
	expect(opens).toBe(1); // SSE 클라이언트 살아있어 재오픈 생략
	await sseReader?.cancel();
	await closeGate(root, "ssehb");
});

test("채팅 전송 큐: 응답 중이면 큐 적재·취소 가능, 재진입 시 승격, 넘겨진 뒤 취소 거부(read-wins)", async () => {
	// 에이전트 '응답 중' = runGate 호출 사이(currentResolver null) 구간을 시뮬레이션해
	// 가시 큐 적재·취소·승격·read-wins 를 한 흐름에서 검증.
	let url = "";
	// 1) 에이전트 듣는 중(runGate 대기) → 즉시 전송(chatLog + chat 이벤트).
	const first = await runGate({
		root,
		feature: "queueflow",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (u) => {
			url = u;
			await fetch(`${u}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "첫질문" }),
			});
		},
	});
	expect(first.kind).toBe("chat");
	// first 반환 = runGate 종료 → currentResolver null(에이전트 '응답 중').
	// 2) 응답 중 전송 → 가시 큐에만 적재(chatLog 미진입).
	await fetch(`${url}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text: "두번째" }),
	});
	const st = (await (await fetch(`${url}/api/chat`)).json()) as {
		messages: Array<{ text: string }>;
		queue: Array<{ text: string; id: string }>;
	};
	expect(st.messages.map((m) => m.text)).toEqual(["첫질문"]);
	expect(st.queue.map((m) => m.text)).toEqual(["두번째"]);
	// 3) 큐에 있는 동안 취소 → 완전 제거.
	const cancelRes = (await (
		await fetch(`${url}/api/chat/cancel`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: st.queue[0]!.id }),
		})
	).json()) as { ok: boolean };
	expect(cancelRes.ok).toBe(true);
	const st2 = (await (await fetch(`${url}/api/chat`)).json()) as {
		queue: unknown[];
	};
	expect(st2.queue).toHaveLength(0);
	// 4) 다시 큐 적재 후 runGate 재진입 → '읽기' = chatLog 승격 + chat 이벤트 전달.
	await fetch(`${url}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text: "세번째" }),
	});
	const second = await runGate({
		root,
		feature: "queueflow",
		viewerDistDir: VIEWER_DIST,
		open: false,
	});
	expect(second.kind).toBe("chat");
	if (second.kind === "chat") expect(second.messages[0]?.text).toBe("세번째");
	const st3 = (await (await fetch(`${url}/api/chat`)).json()) as {
		messages: Array<{ text: string; id: string }>;
		queue: unknown[];
	};
	expect(st3.messages.map((m) => m.text)).toEqual(["첫질문", "세번째"]);
	expect(st3.queue).toHaveLength(0);
	// 5) 이미 넘겨진 메시지 취소 → 거부(read-wins).
	const cancelRes2 = (await (
		await fetch(`${url}/api/chat/cancel`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: st3.messages[1]!.id }),
		})
	).json()) as { ok: boolean; reason?: string };
	expect(cancelRes2.ok).toBe(false);
	expect(cancelRes2.reason).toBe("already-sent");
	// 정리.
	await runGate({
		root,
		feature: "queueflow",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (u) => {
			await fetch(`${u}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});
	await closeGate(root, "queueflow");
});

test("stage-request: 채팅과 같은 큐를 경유 — 대기 채팅 뒤 적재, 드레인 시 선행 채팅 먼저, 선두 도달 시 decision 으로 실행, 대기 중 채팅 거부, 취소 가능", async () => {
	// 사용자 동작 예시 5단계(확정 대기 중 취소 포함)를 한 흐름으로 검증.
	let url = "";
	// 1) 에이전트 듣는 중 → 채팅 즉시 전달(chat 이벤트).
	const first = await runGate({
		root,
		feature: "stagereq2",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (u) => {
			url = u;
			await fetch(`${u}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "첫질문" }),
			});
		},
	});
	expect(first.kind).toBe("chat");
	// first 반환 = 응답 중(resolver null).
	// 2)·3) 응답 중 채팅 2건 큐 적재.
	await fetch(`${url}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text: "두번째" }),
	});
	await fetch(`${url}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text: "세번째" }),
	});
	// 4) 확정 → 큐 마지막 칸(세번째 뒤)에 stage-request 적재.
	const stReq = (await (
		await fetch(`${url}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				kind: "stage-request",
				targetStage: 2,
				decision: {
					verdict: "confirm",
					comments: [{ text: "진행" }],
				},
			}),
		})
	).json()) as { ok: boolean };
	expect(stReq.ok).toBe(true);
	const st = (await (await fetch(`${url}/api/chat`)).json()) as {
		messages: Array<Record<string, unknown>>;
		queue: Array<Record<string, unknown>>;
	};
	expect(st.queue.map((m) => m.kind ?? "chat")).toEqual([
		"chat",
		"chat",
		"stage-request",
	]);
	expect(st.messages.find((m) => m.kind === "stage-request")).toBeUndefined();
	// 5) 확정 대기 중 채팅 전송 → 거부.
	const rejected = (await (
		await fetch(`${url}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "무시될채팅" }),
		})
	).json()) as { ok: boolean; reason?: string };
	expect(rejected.ok).toBe(false);
	expect(rejected.reason).toBe("stage-request-pending");
	// 6) 대기 중 확정 요청 취소 → 큐에서 제거 후 채팅 재허용.
	const srId = st.queue[2]!.id as string;
	const cancelRes = (await (
		await fetch(`${url}/api/chat/cancel`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: srId }),
		})
	).json()) as { ok: boolean };
	expect(cancelRes.ok).toBe(true);
	const rechatted = (await (
		await fetch(`${url}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "다시가능" }),
		})
	).json()) as { ok: boolean };
	expect(rechatted.ok).toBe(true);
	// 7) 재확정 → 큐 적재(취소된 자리 재저장). 코멘트로 decision 페이로드 흐름 검증.
	await fetch(`${url}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			kind: "stage-request",
			targetStage: 2,
			decision: { verdict: "confirm", comments: [{ text: "재진행" }] },
		}),
	});
	// 8) runGate 재진입(응답 완료) → **선두 1개씩만** chat 으로 전달(일괄 배출 금지),
	//    stage-request 는 큐 끝까지 대기 유지. 각 재진입마다 큐가 하나씩 줄어든다.
	const r2 = await runGate({
		root,
		feature: "stagereq2",
		viewerDistDir: VIEWER_DIST,
		open: false,
	});
	expect(r2.kind).toBe("chat");
	if (r2.kind === "chat")
		expect(r2.messages.map((m) => m.text)).toEqual(["두번째"]);
	const mid = (await (await fetch(`${url}/api/chat`)).json()) as {
		queue: Array<Record<string, unknown>>;
	};
	expect(mid.queue.map((m) => m.kind ?? "chat")).toEqual([
		"chat",
		"chat",
		"stage-request",
	]);
	const r3 = await runGate({
		root,
		feature: "stagereq2",
		viewerDistDir: VIEWER_DIST,
		open: false,
	});
	expect(r3.kind).toBe("chat");
	if (r3.kind === "chat")
		expect(r3.messages.map((m) => m.text)).toEqual(["세번째"]);
	const r4 = await runGate({
		root,
		feature: "stagereq2",
		viewerDistDir: VIEWER_DIST,
		open: false,
	});
	expect(r4.kind).toBe("chat");
	if (r4.kind === "chat")
		expect(r4.messages.map((m) => m.text)).toEqual(["다시가능"]);
	// 9) 다음 재진입 → 선두 stage-request → decision(confirm) 실행 + fulfilled 기록.
	const third = await runGate({
		root,
		feature: "stagereq2",
		viewerDistDir: VIEWER_DIST,
		open: false,
	});
	expect(third.kind).toBe("decision");
	if (third.kind === "decision") {
		expect(third.decision.verdict).toBe("confirm");
		expect(third.decision.comments[0]?.text).toBe("재진행");
	}
	const fin = (await (await fetch(`${url}/api/chat`)).json()) as {
		messages: Array<Record<string, unknown>>;
		queue: unknown[];
	};
	const sr = fin.messages.find((m) => m.kind === "stage-request");
	expect(sr?.status).toBe("fulfilled");
	expect(sr?.targetStage).toBe(2);
	expect(fin.queue).toHaveLength(0);
	await closeGate(root, "stagereq2");
});

test("stage-request: 게이트 열려 있고 앞 대기 없으면 즉시 decision resolve + fulfilled 기록", async () => {
	const event = await runGate({
		root,
		feature: "stagereq3",
		viewerDistDir: VIEWER_DIST,
		open: false,
		onReady: async (u) => {
			const r = (await (
				await fetch(`${u}/api/chat`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						kind: "stage-request",
						targetStage: 2,
						decision: { verdict: "confirm", comments: [] },
					}),
				})
			).json()) as { ok: boolean };
			expect(r.ok).toBe(true);
			const st = (await (await fetch(`${u}/api/chat`)).json()) as {
				messages: Array<Record<string, unknown>>;
				queue: unknown[];
			};
			// 즉시 실행 — 큐 비움, chatLog fulfilled 기록.
			expect(st.queue).toHaveLength(0);
			expect(st.messages.find((m) => m.kind === "stage-request")?.status).toBe(
				"fulfilled",
			);
		},
	});
	expect(event.kind).toBe("decision");
	if (event.kind === "decision") expect(event.decision.verdict).toBe("confirm");
	await closeGate(root, "stagereq3");
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
