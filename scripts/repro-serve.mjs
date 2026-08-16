// repro-* 스모크 스크립트 공용 — 뷰어 dist 서빙 미니 서버(Bun.serve).
// 실 게이트 서버 대신: /api/state 고정 페이로드 + /api/* 폴백 + 정적 SPA.
// repro-drilldown.mjs · repro-graph-kinds.mjs 이 동일 블록을 복제하던 것을 추출(2026-08 하드닝).
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 이 모듈(scripts/) 위치 기준 레포 루트 결정 — 실행 cwd 와 무관하게 동작. */
export function resolveRepoRoot(rel) {
	const here = fileURLToPath(new URL(".", import.meta.url)); // <repo>/scripts/
	return resolve(here, "..", rel);
}

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
};

/** 뷰어 dist 서빙 스모크 서버 — stateJson 은 이미 gateOpen 포함해 호출측에서 조립. */
export function serveViewer(dist, stateJson) {
	return Bun.serve({
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
				const body = await readFile(join(dist, path));
				return new Response(body, {
					headers: {
						"Content-Type": MIME[extname(path)] ?? "application/octet-stream",
					},
				});
			} catch {
				const body = await readFile(join(dist, "index.html"));
				return new Response(body, {
					headers: { "Content-Type": MIME[".html"] },
				});
			}
		},
	});
}
