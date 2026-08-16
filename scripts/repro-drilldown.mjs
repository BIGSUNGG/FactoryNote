// 재현·회귀 체크: 게이트 뷰어 그래프 드릴다운(ADR-018) — 실제 브라우저(Chrome headless)에서
// 모듈 노드 더블클릭 → 하위 레벨 패널 렌더 검증. 실제 chat-program 데이터 서빙.
// 사용: bun repro-drilldown.mjs  (성공 시 "DRILLDOWN PASS", 실패 시 비 0 종료)
// 구조: bun = 데이터 조립(viewer-state TS) + 게이트 HTTP 서빙 + Chrome 실행,
//       node = playwright-core CDP 브라우저 구동(bun 은 ws CDP 연결이 걸려서 분리).
import { spawn, spawnSync } from "node:child_process"; // spawnSync 는 finally 의 taskkill 전용(서빙 종료 후)
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildViewerState } from "../apps/pi-extension/src/viewer-state.ts";
import { serveViewer, resolveRepoRoot } from "./repro-serve.mjs";

const ROOT = "C:/Projects/Test/.factorynote";
const FEATURE = "chat-program";
const DIST = resolveRepoRoot("apps/plan-viewer/dist");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9400 + Math.floor(Math.random() * 400); // 실행별 고유 포트

// 실제 feature 데이터로 /api/state 조립 — 게이트만 강제로 연 상태(reviewing 재현).
const payload = await buildViewerState(ROOT, FEATURE);
const stateJson = JSON.stringify({ ...payload, gateOpen: true });

const server = serveViewer(DIST, stateJson);

const base = `http://127.0.0.1:${server.port}`;

// 서빙 자체 검증(브라우저 무관).
const selfCheck = await fetch(`${base}/api/state`);
if (!selfCheck.ok) throw new Error("/api/state 서빙 실패");
console.error("[repro] 서버 OK:", base);

// Chrome headless 실행 → CDP 대기.
const prof = await mkdtemp(join(tmpdir(), "fn-drilldown-"));
const chromeProc = spawn(
	CHROME,
	[
		"--headless=new",
		"--disable-gpu",
		"--no-sandbox",
		"--no-proxy-server", // 사내 WPAD/프록시 자동탐색으로 goto 행 방지
		`--remote-debugging-port=${CDP_PORT}`,
		`--user-data-dir=${prof}`,
		"about:blank",
	],
	{ stdio: "ignore", detached: true },
);
chromeProc.unref();

let cdpUp = false;
for (let i = 0; i < 30; i++) {
	try {
		const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
		if (r.ok) {
			cdpUp = true;
			break;
		}
	} catch {
		/* 재시도 */
	}
	await new Promise((res) => setTimeout(res, 500));
}

let exitCode = 1;
try {
	if (!cdpUp) throw new Error("Chrome CDP 미응답");
	// 브라우저 구동은 node 로(bun 은 CDP ws 연결 행). spawnSync 는 bun 서버 이벤트
	// 루프를 블록해 /api 응답이 멈추므로 반드시 비동기 spawn.
	exitCode = await new Promise((resolve) => {
		const child = spawn(
			"node",
			[process.env.FN_BROWSER_SCRIPT ?? "repro-drilldown-browser.mjs"],
			{
				stdio: "inherit",
				env: {
					...process.env,
					FN_BASE: base,
					FN_CDP_PORT: String(CDP_PORT),
				},
			},
		);
		child.on("exit", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
} catch (err) {
	console.log(String(err));
} finally {
	server.stop(true);
	// Windows: 트리 전체 종료(taskkill /T) 후 프로필 정리.
	try {
		spawnSync("taskkill", ["/PID", String(chromeProc.pid), "/T", "/F"], {
			stdio: "ignore",
		});
	} catch {
		/* 이미 종료 */
	}
	await new Promise((res) => setTimeout(res, 800));
	await rm(prof, { recursive: true, force: true }).catch(() => undefined);
}
process.exit(exitCode);
