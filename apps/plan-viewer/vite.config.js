import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 시안 A(모노톤) React 목업 — Vite 설정
const dataDir = fileURLToPath(new URL("./src/data", import.meta.url));
const load = (f) => readFileSync(`${dataDir}/${f}`, "utf8");

// dev 전용 목업: src/data/*.md 샘플 산출물로 게이트 UI 미리보기.
// 실구동은 pi 영속 게이트 서버가 /api/state·/api/chat·/api/decision 를 서빙한다.
const mockState = () => ({
	feature: "auth-module",
	stage: 1,
	stageName: "요청 이해",
	gateOpen: true,
	done: false,
	artifacts: [
		{ stage: 1, name: "요청 이해", md: load("plan.md") },
		{ stage: 2, name: "시나리오", md: load("scenarios.md") },
		{ stage: 5, name: "구현 계획", md: load("impl.md") },
	],
});

export default defineConfig({
	plugins: [
		react(),
		{
			name: "dev-mock",
			apply: "serve",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					const url = req.url || "";
					if (url === "/api/state") {
						res.setHeader("Content-Type", "application/json");
						res.end(JSON.stringify(mockState()));
						return;
					}
					if (url.startsWith("/api/chat") || url.startsWith("/api/decision")) {
						if (req.method === "GET" && url.startsWith("/api/chat")) {
							res.setHeader("Content-Type", "application/json");
							res.end("[]");
						} else {
							res.end("");
						}
						return;
					}
					next();
				});
			},
		},
	],
	server: { port: 5173, open: true },
});
