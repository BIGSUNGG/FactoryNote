// 게이트 HTTP 핸들러 — /api/* 라우팅 + 정적 SPA 서빙. node:* builtins만 사용.
import { readFile } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";
import { buildViewerState } from "./viewer-state.ts";
import type { ChatMessage, GateEvent } from "./gate-events.ts";
import type { GateDecision } from "@factorynote/core";

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

function safeJoin(dist: string, urlPath: string): string | null {
	const cleaned = urlPath.split("?")[0]!.replace(/^\/+/, "");
	const target = normalize(join(dist, cleaned));
	const rel = relative(dist, target);
	if (rel.startsWith("..") || rel.includes(`..${sep}`)) return null; // traversal 차단
	return target;
}

async function canRead(path: string): Promise<boolean> {
	try {
		await readFile(path);
		return true;
	} catch {
		return false;
	}
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		req.on("data", (chunk: Buffer) => {
			data += chunk.toString();
		});
		req.on("end", () => resolve(data));
		req.on("error", reject);
	});
}

/** 영속 게이트의 HTTP 핸들러(게이트 객체를 클로저로 잡는다). */
export function makeGateHandler(gate: {
	root: string;
	feature: string;
	viewerDistDir: string;
	lastSeen: number;
	chatLog: import("@factorynote/core").ChatMessage[];
	pendingChats: import("@factorynote/core").ChatMessage[];
	currentResolver: ((e: GateEvent) => void) | null;
}) {
	return async (
		req: import("node:http").IncomingMessage,
		res: import("node:http").ServerResponse,
	): Promise<void> => {
		const url = req.url ?? "/";
		gate.lastSeen = Date.now(); // 뷰어 하트비트 — 탭 생존 신호(재오픈 판정에 사용).
		res.setHeader("Cache-Control", "no-store");
		try {
			if (url === "/api/state") {
				const payload = await buildViewerState(gate.root, gate.feature);
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(payload));
				return;
			}
			if (url === "/api/decision" && req.method === "POST") {
				const body = await readBody(req);
				const parsed = JSON.parse(body) as GateDecision;
				const decision: GateDecision = {
					verdict: parsed.verdict,
					comments: Array.isArray(parsed.comments) ? parsed.comments : [],
					// FR-7: 회귀 대상 단계(revertTo) 뷰어→엔진으로 전달.
					...(typeof parsed.revertTo === "number"
						? { revertTo: parsed.revertTo }
						: {}),
				};
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true }), () => {
					const r = gate.currentResolver;
					gate.currentResolver = null;
					r?.({ kind: "decision", decision });
				});
				return;
			}
			if (url === "/api/review-request" && req.method === "POST") {
				// '검토 요청' — 현 산출물에 AI 재검토(feedback+design 수정) +1 사이클을 요청.
				// 게이트를 닫지 않고 review-request 이벤트로 에이전트에 전달(ADF-013).
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true }), () => {
					const r = gate.currentResolver;
					gate.currentResolver = null;
					r?.({ kind: "review-request" });
				});
				return;
			}
			if (url === "/api/chat") {
				if (req.method === "POST") {
					const body = await readBody(req);
					const parsed = JSON.parse(body) as {
						text?: unknown;
						blockId?: unknown;
						quote?: unknown;
					};
					const text = typeof parsed.text === "string" ? parsed.text : "";
					if (text.trim()) {
						const msg: ChatMessage = {
							id: crypto.randomUUID(),
							role: "user",
							text,
							...(typeof parsed.blockId === "string"
								? { blockId: parsed.blockId }
								: {}),
							...(typeof parsed.quote === "string" && parsed.quote.trim()
								? { quote: parsed.quote }
								: {}),
							at: Date.now(),
						};
						gate.chatLog.push(msg);
						gate.pendingChats.push(msg);
						// 대기 중인 runGate 가 있으면 chat 이벤트로 즉시 전달(게이트 유지).
						const r = gate.currentResolver;
						if (r) {
							gate.currentResolver = null;
							r({ kind: "chat", messages: gate.pendingChats.splice(0) });
						}
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true }));
					return;
				}
				// GET /api/chat — 채팅 누적 로그(뷰어가 폴링으로 표시).
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ messages: gate.chatLog }));
				return;
			}
			// 정적 자원(SPA). /assets/* → dist 파일, 그 외 → index.html.
			const filePath = safeJoin(gate.viewerDistDir, url);
			const fallback = join(gate.viewerDistDir, "index.html");
			const target =
				filePath && (await canRead(filePath)) ? filePath : fallback;
			if (!(await canRead(target))) {
				res.writeHead(404);
				res.end("not found");
				return;
			}
			const data = await readFile(target);
			const ext = target.slice(target.lastIndexOf("."));
			res.writeHead(200, {
				"Content-Type": MIME[ext] ?? "application/octet-stream",
			});
			res.end(data);
		} catch {
			res.writeHead(500);
			res.end("server error");
		}
	};
}
