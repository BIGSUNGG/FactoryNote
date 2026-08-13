import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 시안 A(모노톤) React 목업 — Vite 설정
const dataDir = fileURLToPath(new URL("./src/data", import.meta.url));
const load = (f) => readFileSync(`${dataDir}/${f}`, "utf8");

// dev 전용 목업: src/data/*.md 샘플 산출물로 게이트 UI 미리보기.
// 실구동은 pi 영속 게이트 서버가 /api/state·/api/chat·/api/decision 를 서빙한다.
// 테스트 뷰어용: 채팅 POST → (3초 뒤) 가짜 에이전트 회신 + 정해진 파일 수정을
// 메모리에 반영. App 의 /api/state 폴링(2s)이 갱신본을 자동으로 가져간다.
const mock = {
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
	messages: [],
};
let msgSeq = 0;
let replyIdx = 0;
let editIdx = 0;
const FAKE_REPLIES = [
	"알겠습니다. 해당 부분을 반영했습니다.",
	"좋은 지적이에요. 구조를 조정했어요.",
	"수정 완료 — 산출물을 확인해 주세요.",
	"반영했습니다. 추가 의견 있으면 알려주세요.",
];
// 정해진 파일 수정(임의 사전 정의) — 현 단계 마크다운 "맨 위"에 눈에 띄는 배너로 prepend.
// 형식: 「수정된 부분 → 내용」 으로 어느 섹션이 어떻게 바뀌었는지 즉시 알 수 있게.
// (plan.md 실제 섹션명을 가리켜 테스트 뷰어에서 수정 위치가 명확히 보이도록.)
const FAKE_EDITS = [
	"> ✏️ 수정된 부분: **「기능 요구사항」** → 세부 조건을 보강했습니다.\n\n",
	"> ✏️ 수정된 부분: **「범위 경계」** → 스코프 경계를 명확히 했습니다.\n\n",
	"> ✏️ 수정된 부분: **「핵심 로직」** → 예외 케이스를 추가했습니다.\n\n",
	"> ✏️ 수정된 부분: **「처리 매트릭스」** → 우선순위를 재조정했습니다.\n\n",
];
const addMsg = (role, text, extra = {}) =>
	mock.messages.push({
		id: `m${++msgSeq}`,
		role,
		text,
		ts: Date.now(),
		...extra,
	});
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
				server.middlewares.use(async (req, res, next) => {
					const url = req.url || "";
					if (url === "/api/state") {
						res.setHeader("Content-Type", "application/json");
						res.end(JSON.stringify(mock));
						return;
					}
					if (url.startsWith("/api/chat")) {
						if (req.method === "GET") {
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify({ messages: mock.messages }));
							return;
						}
						if (req.method === "POST") {
							const body = await readBody(req);
							let p = {};
							try {
								p = JSON.parse(body || "{}");
							} catch {
								/* malformed — 무시 */
							}
							const text = (p.text || "").trim();
							if (text)
								addMsg("user", text, p.blockId ? { blockId: p.blockId } : {});
							res.end("");
							// 채팅 내용과 무관하게 3초 뒤 가짜 회신 + 정해진 파일 수정.
							setTimeout(() => {
								addMsg("agent", FAKE_REPLIES[replyIdx++ % FAKE_REPLIES.length]);
								const art = mock.artifacts.find((a) => a.stage === mock.stage);
								if (art)
									art.md = FAKE_EDITS[editIdx++ % FAKE_EDITS.length] + art.md;
							}, 3000);
							return;
						}
						res.end("");
						return;
					}
					if (
						url.startsWith("/api/decision") ||
						url.startsWith("/api/review-request")
					) {
						res.end("");
						return;
					}
					next();
				});
			},
		},
	],
	// 5180 우선. 점유 중이면 vite 가 다음 포트로 이관하고 open:true 가
	// 실제 포트로 브라우저를 열어주므로 strictPort(충돌 시 하드 에러)는 뺀다.
	server: { port: 5180, open: true },
});
