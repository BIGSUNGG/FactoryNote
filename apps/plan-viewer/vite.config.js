import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMockApi } from "./dev/mock-api.js";

// 테스트 뷰어(시안 A 모노톤) — Vite 설정.
// dev 전용 목업: 실제 게이트 서버 의미론(큐·stage-request·취소·SSE, ADR-024/026)을
// dev/mock-api.js 순수 모듈로 모방. 실구동은 pi 영속 게이트 서버가 /api/* 를 서빙한다.
const dataDir = fileURLToPath(new URL("./src/data", import.meta.url));
const load = (f) => readFileSync(`${dataDir}/${f}`, "utf8");

const FAKE_REPLIES = [
	"알겠습니다. 해당 부분을 반영했습니다.",
	"좋은 지적이에요. 구조를 조정했어요.",
	"수정 완료 — 산출물을 확인해 주세요.",
	"반영했습니다. 추가 의견 있으면 알려주세요.",
];
// 정해진 파일 수정(임의 사전 정의) — 현 단계 마크다운 "맨 위"에 눈에 띄는 배너로 prepend.
// 형식: 「수정된 부분 → 내용」 으로 어느 섹션이 어떻게 바뀌었는지 즉시 알 수 있게.
const FAKE_EDITS = [
	"> ✏️ 수정된 부분: **「기능 요구사항」** → 세부 조건을 보강했습니다.\n\n",
	"> ✏️ 수정된 부분: **「범위 경계」** → 스코프 경계를 명확히 했습니다.\n\n",
	"> ✏️ 수정된 부분: **「핵심 로직」** → 예외 케이스를 추가했습니다.\n\n",
	"> ✏️ 수정된 부분: **「처리 매트릭스」** → 우선순위를 재조정했습니다.\n\n",
];
const STAGE_NAMES = ["요청 이해", "시나리오", "구현 계획"];

const readBody = (req) =>
	new Promise((resolve) => {
		let data = "";
		req.on("data", (c) => (data += c));
		req.on("end", () => resolve(data));
	});

export default defineConfig({
	plugins: [
		react(),
		{
			name: "dev-mock",
			apply: "serve",
			configureServer(server) {
				// 목업 API(순수 모듈 — 실서버 의미론, mock-api.test.js 로 검증).
				const api = createMockApi({
					feature: "auth-module",
					stageName: STAGE_NAMES[0],
					artifacts: [
						{ stage: 1, name: STAGE_NAMES[0], md: load("plan.md") },
						{ stage: 2, name: STAGE_NAMES[1], md: load("scenarios.md") },
						{ stage: 3, name: STAGE_NAMES[2], md: load("impl.md") },
					],
					replyDelayMs: 3000,
					replies: FAKE_REPLIES,
					edits: FAKE_EDITS,
				});
				// 상태 변동 → SSE push(구독은 아래 미들웨어에서 클라이언트 관리).
				// SSE 클라이언트 — 상태·채팅 변동 시 push(ADR-022 와 동일 이벤트 이름).
				const sseClients = new Set();
				const push = (type) => {
					const frame = `event: ${type}\ndata: {}\n\n`;
					for (const res of sseClients) {
						try {
							res.write(frame);
						} catch {
							sseClients.delete(res);
						}
					}
				};
				server.middlewares.use(async (req, res, next) => {
					const url = (req.url || "").split("?")[0];
					const json = (obj) => {
						res.setHeader("Content-Type", "application/json");
						res.end(JSON.stringify(obj));
					};
					if (url === "/api/state") {
						json(api.getState());
						return;
					}
					if (url === "/api/events") {
						res.writeHead(200, {
							"Content-Type": "text/event-stream",
							"Cache-Control": "no-store",
							Connection: "keep-alive",
						});
						res.write(": connected\n\n");
						sseClients.add(res);
						req.on("close", () => sseClients.delete(res));
						return;
					}
					if (url === "/api/chat" && req.method === "GET") {
						json(api.getChat());
						return;
					}
					if (url === "/api/chat" && req.method === "POST") {
						let p = {};
						try {
							p = JSON.parse((await readBody(req)) || "{}");
						} catch {
							/* malformed — 무시 */
						}
						// 단계 이름 표시용: targetStage → STAGE_NAMES 매핑(데모 편의).
						if (p.kind === "stage-request" && STAGE_NAMES[p.targetStage - 1])
							p.stageName = STAGE_NAMES[p.targetStage - 1];
						json(api.postChat(p));
						return;
					}
					if (url === "/api/chat/cancel" && req.method === "POST") {
						let p = {};
						try {
							p = JSON.parse((await readBody(req)) || "{}");
						} catch {
							/* 무시 */
						}
						json(api.cancel(p.id));
						return;
					}
					if (url === "/api/decision" && req.method === "POST") {
						let d = {};
						try {
							d = JSON.parse((await readBody(req)) || "{}");
						} catch {
							/* 무시 */
						}
						json(api.postDecision(d));
						return;
					}
					if (url === "/api/review-request") {
						res.end("");
						return;
					}
					next();
				});
				// mock 상태 변동 → SSE push(state=단계 진행·산출물 갱신, chat=큐·회신).
				api.subscribe((type) => push(type));
			},
		},
	],
	// 5180 우선. 점유 중이면 vite 가 다음 포트로 이관하고 open:true 가
	// 실제 포트로 브라우저를 열어주므로 strictPort(충돌 시 하드 에러)는 뺀다.
	server: { port: 5180, open: true },
});
