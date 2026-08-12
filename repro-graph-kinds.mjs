// 데모 뷰어: 현재 구현된 그래프 기능 전체 확인(ADR-018·020·021).
// 임시 .factorynote 워크스페이스를 만들어 Stage 2 게이트를 강제로 열고 브라우저로 서빙:
//   - 다중 그래프 + 에이전트 자유 이름(ADR-020)
//   - 계층 트리 드릴다운 + sequence(fragment 포함) + flowchart(shape·백엣지)(ADR-021)
// 사용: bun repro-graph-kinds.mjs  → 브라우저 자동 오픈, Ctrl+C 로 종료.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import {
	initialState,
	saveState,
	writeArtifact,
} from "./packages/factorynote/src/index.ts";
import { buildViewerState } from "./apps/pi-extension/src/viewer-state.ts";

// 서빙 전 최신 dist 보장 — 소스 변경 후 낡은 dist 로 그래프가 안 보이는 회귀 방지.
// 모듈 로드 시 ensureViewerDist() 가(stale 이면) vite 빌드를 실행한다.
import "./ensure-viewer-dist.ts";

const DIST = join(process.cwd(), "apps", "plan-viewer", "dist");
const FEATURE = "graph-showcase";

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
};

// --- 1. 임시 워크스페이스 조립 ---
const root = await mkdtemp(join(tmpdir(), "fn-showcase-"));
await saveState(root, { ...initialState(FEATURE), stage: 2 });

const designMd = `# 모듈 · 클래스 설계

요청 처리 파이프라인의 모듈 구조와 로그인 시나리오, 배포 흐름을 정리한다.

## 모듈 관계도 — 계층 트리(더블클릭 드릴다운)

<!-- graph: module-architecture.json -->

모듈 노드를 **더블클릭**하면 자식 레벨(클래스)이 아래 패널에 스택된다. 재더블클릭은 선택 해제.

## 로그인 시나리오 — Sequence 다이어그램

<!-- graph: login-sequence.json -->

alt/loop fragment 구간과 응답(reply, 점선) 화살표를 확인하라.

## 배포 흐름 — Flowchart

<!-- graph: deploy-flow.json -->

terminal(둥근 모서리)·process(사각)·decision(마름모) shape 와 검사 실패 시 되돌아가는 백엣지(점선)를 확인하라.

## 참고 — 구 고정 이름 호환

<!-- graph: 02-design-graph.json -->

기존 규약(고정 이름) 산출물도 그대로 렌더링된다.

## 요구사항 추적 표

| 항목 | 모듈 | 상태 |
| --- | --- | --- |
| 로그인 | auth | 완료 |
| 렌더링 | ui | 진행 |
`;

// (a) 계층 트리 — 루트 + 자식 파일 서브디렉터리(드릴다운용).
await writeArtifact(
	root,
	FEATURE,
	"stage2/module-architecture.json",
	JSON.stringify({
		version: 2,
		title: "모듈 관계도",
		childLevel: "classes",
		nodes: [
			{
				id: "ui",
				label: "UI",
				layer: "API",
				children: "classes/ui.json",
				refs: [{ to: "auth", comment: "로그인 요청" }],
			},
			{
				id: "auth",
				label: "Auth",
				layer: "Service",
				children: "classes/auth.json",
			},
			{ id: "store", label: "Store", layer: "Repository" },
		],
	}),
);
await writeArtifact(
	root,
	FEATURE,
	"stage2/module-architecture/classes/ui.json",
	JSON.stringify({
		version: 2,
		id: "ui",
		childLevel: "methods",
		nodes: [
			{ id: "LoginView", type: "class", name: "LoginView", module: "ui" },
			{ id: "Dashboard", type: "class", name: "Dashboard", module: "ui" },
		],
	}),
);
await writeArtifact(
	root,
	FEATURE,
	"stage2/module-architecture/classes/auth.json",
	JSON.stringify({
		version: 2,
		id: "auth",
		childLevel: "methods",
		nodes: [
			{ id: "AuthService", type: "class", name: "AuthService", module: "auth" },
		],
	}),
);

// (b) sequence — fragment(alt + 중첩 loop) 포함.
await writeArtifact(
	root,
	FEATURE,
	"stage2/login-sequence.json",
	JSON.stringify({
		version: 2,
		type: "sequence",
		title: "로그인 시나리오",
		participants: [
			{ id: "user", name: "사용자" },
			{ id: "ui", name: "LoginView" },
			{ id: "auth", name: "AuthService" },
			{ id: "db", name: "UserStore" },
		],
		body: [
			{ from: "user", to: "ui", label: "자격증명 입력" },
			{ from: "ui", to: "auth", label: "login(id, pw)" },
			{ from: "auth", to: "db", label: "find(id)" },
			{ from: "db", to: "auth", label: "user record", kind: "reply" },
			{
				kind: "alt",
				label: "비밀번호 일치?",
				body: [
					{ from: "auth", to: "ui", label: "token 발급", kind: "reply" },
					{
						kind: "loop",
						label: "재시도 ≤ 3회",
						body: [
							{ from: "ui", to: "user", label: "오류 표시" },
							{ from: "user", to: "ui", label: "재입력" },
							{ from: "ui", to: "auth", label: "login(id, pw)" },
						],
					},
				],
			},
			{ from: "ui", to: "user", label: "대시보드 전환" },
		],
	}),
);

// (c) flowchart — shape 3종 + 백엣지.
await writeArtifact(
	root,
	FEATURE,
	"stage2/deploy-flow.json",
	JSON.stringify({
		version: 2,
		type: "flowchart",
		title: "배포 파이프라인",
		nodes: [
			{ id: "start", label: "시작", shape: "terminal" },
			{ id: "build", label: "빌드 (tsc -b)" },
			{ id: "test", label: "테스트 (bun test)" },
			{ id: "check", label: "전부 통과?", shape: "decision" },
			{ id: "deploy", label: "install.mjs 배포" },
			{ id: "end", label: "완료", shape: "terminal" },
		],
		edges: [
			{ from: "start", to: "build" },
			{ from: "build", to: "test" },
			{ from: "test", to: "check" },
			{ from: "check", to: "deploy", label: "예" },
			{ from: "check", to: "build", label: "아니오 — 수정 후 재빌드" },
			{ from: "deploy", to: "end" },
		],
	}),
);

// (d) 구 규약 고정 이름 — 하위 호환 확인용.
await writeArtifact(
	root,
	FEATURE,
	"stage2/02-design-graph.json",
	JSON.stringify({
		version: 2,
		title: "구 산출물 그래프(호환)",
		nodes: [
			{ id: "legacy-a", label: "Legacy A" },
			{
				id: "legacy-b",
				label: "Legacy B",
				refs: [{ to: "legacy-a", comment: "참조" }],
			},
		],
	}),
);

await writeArtifact(root, FEATURE, "stage2/02-design.md", designMd);

// --- 2. 게이트 서빙 ---
const payload = await buildViewerState(root, FEATURE);
const stateJson = JSON.stringify({ ...payload, gateOpen: true });

const server = Bun.serve({
	port: 0,
	async fetch(req) {
		let url;
		try {
			url = new URL(req.url);
		} catch {
			return new Response("bad request", { status: 400 });
		}
		if (url.pathname === "/api/state")
			return new Response(stateJson, {
				headers: { "Content-Type": "application/json" },
			});
		if (url.pathname.startsWith("/api/")) {
			if (url.pathname === "/api/chat" && req.method === "GET")
				return new Response("[]", {
					headers: { "Content-Type": "application/json" },
				});
			return new Response("{}", {
				headers: { "Content-Type": "application/json" },
			});
		}
		const path = url.pathname === "/" ? "/index.html" : url.pathname;
		try {
			const body = await readFile(join(DIST, path));
			return new Response(body, {
				headers: {
					"Content-Type": MIME[extname(path)] ?? "application/octet-stream",
				},
			});
		} catch {
			return new Response("not found", { status: 404 });
		}
	},
});

const url = server.url.toString();
console.log(`✅ 그래프 쇼케이스 게이트 서빙 중: ${url}`);
console.log("   Ctrl+C 로 종료(임시 워크스페이스 자동 정리).");

// 기본 브라우저 오픈(Windows: start / macOS: open / Linux: xdg-open).
const opener =
	process.platform === "win32"
		? spawn("cmd", ["/c", "start", "", url], { detached: true })
		: process.platform === "darwin"
			? spawn("open", [url], { detached: true })
			: spawn("xdg-open", [url], { detached: true });
opener.unref();

const cleanup = async () => {
	server.stop();
	await rm(root, { recursive: true, force: true }).catch(() => {});
	process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
