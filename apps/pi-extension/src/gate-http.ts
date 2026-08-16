// 게이트 HTTP 핸들러 — /api/* 라우팅 + 정적 SPA 서빙. node:* builtins만 사용.
// 라우팅(serve)과 엔드포인트 로직(*Handler)을 분리 — 각 핸들러는 자기 엔드포인트만 담당.
import { readFile } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";
import { buildViewerState } from "./viewer-state.ts";
import type { PersistentGate } from "./gate-manager.ts";
import type { ChatMessage } from "./gate-events.ts";
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
	const cleaned = (urlPath.split("?")[0] ?? urlPath).replace(/^\/+/, "");
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

type Req = import("node:http").IncomingMessage;
type Res = import("node:http").ServerResponse;

function sendJson(res: Res, payload: unknown): void {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(payload));
}

/** 요청 본문을 JSON 으로 파싱 — 불량이면 null(호출측은 400 응답). */
async function readJson(req: Req): Promise<unknown> {
	try {
		return JSON.parse(await readBody(req));
	} catch {
		return null;
	}
}

/** GET /api/state — 뷰어 대시보드 페이로드. */
async function stateHandler(gate: PersistentGate, _req: Req, res: Res) {
	const payload = await buildViewerState(gate.root, gate.feature);
	sendJson(res, payload);
}

/** GET /api/events — SSE push 채널(폴링 대체). 연결 유지 = 탭 하트비트. */
function eventsHandler(gate: PersistentGate, req: Req, res: Res) {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-store",
		Connection: "keep-alive",
	});
	res.write(": connected\n\n");
	gate.sseClients.add(res);
	req.on("close", () => {
		gate.sseClients.delete(res);
	});
}

/** POST /api/decision — 게이트 결정(확정/수정/정정). 불량 본문은 400. */
async function decisionHandler(gate: PersistentGate, req: Req, res: Res) {
	const parsed = (await readJson(req)) as GateDecision | null;
	if (parsed === null) {
		res.writeHead(400);
		res.end("bad request");
		return;
	}
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
}

/** POST /api/review-request — 현 산출물 재검토 +1 사이클 요청(게이트 유지). */
function reviewRequestHandler(gate: PersistentGate, _req: Req, res: Res) {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ ok: true }), () => {
		const r = gate.currentResolver;
		gate.currentResolver = null;
		r?.({ kind: "review-request" });
	});
}

/** GET /api/chat — 누적 로그(messages) + 전송 대기 큐(queue). */
function chatGetHandler(gate: PersistentGate, _req: Req, res: Res) {
	sendJson(res, { messages: gate.chatLog, queue: gate.pendingChats });
}

/** 단계 진행 요청(stage-request) POST 본문 → 정규화된 결정. */
function parseStageRequestDecision(parsed: {
	targetStage?: unknown;
	decision?: unknown;
}): { target: number; decision: GateDecision } {
	const target =
		typeof parsed.targetStage === "number" ? parsed.targetStage : 0;
	const pd = parsed.decision as
		| { comments?: unknown; revertTo?: unknown }
		| undefined;
	return {
		target,
		decision: {
			verdict: "confirm",
			comments: Array.isArray(pd?.comments) ? pd.comments : [],
			...(typeof pd?.revertTo === "number"
				? { revertTo: pd.revertTo as NonNullable<GateDecision["revertTo"]> }
				: {}),
		},
	};
}

/** 영속 게이트의 HTTP 핸들러(게이트 객체를 클로저로 잡는다). */
export function makeGateHandler(
	gate: PersistentGate,
	// SSE push — gate-manager 가 broadcastSse 를 주입(gate-http↔gate-manager 순환 import 회피).
	broadcast: (type: string, data?: unknown) => void,
) {
	/** POST /api/chat 채널의 stage-request 처리 — 채팅과 같은 pendingChats 큐의 마지막 칸에
	 *  적재되어 기존 대기 채팅의 응답이 모두 끝난 뒤 실행된다. 게이트가 열려 있고 앞에
	 *  대기가 없으면(유일 항목) 즉시 decision 으로 resolve — fulfilled 기록만 chatLog 에 남긴다. */
	async function chatStageRequest(
		parsed: Parameters<typeof parseStageRequestDecision>[0],
		res: Res,
	): Promise<void> {
		if (gate.pendingChats.some((m) => m.kind === "stage-request")) {
			sendJson(res, { ok: false, reason: "already-pending" });
			return;
		}
		const { target, decision } = parseStageRequestDecision(parsed);
		const item: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			kind: "stage-request",
			status: "pending",
			targetStage: target,
			text: `Stage ${target} 진행 요청`,
			at: Date.now(),
			decision,
		};
		gate.pendingChats.push(item);
		broadcast("chat");
		const r = gate.currentResolver;
		if (r && gate.pendingChats[0] === item) {
			// 앞 대기 없음(게이트 열림) → 즉시 진행: fulfilled 기록 + decision resolve.
			gate.pendingChats.shift();
			item.status = "fulfilled";
			gate.chatLog.push(item);
			gate.currentResolver = null;
			r({ kind: "decision", decision });
			broadcast("chat");
		}
		sendJson(res, { ok: true });
	}

	/** POST /api/chat 일반 채팅 — 에이전트가 듣는 중이면 즉시 전송, 응답 중이면 가시 큐 적재. */
	async function chatPost(
		parsed: {
			text?: unknown;
			blockId?: unknown;
			quote?: unknown;
		},
		res: Res,
	): Promise<void> {
		const text = typeof parsed.text === "string" ? parsed.text : "";
		// 확정(단계 진행) 요청이 큐에서 대기 중 → 이후 채팅은 거부(뷰어가 잠금 안내 표시).
		if (gate.pendingChats.some((m) => m.kind === "stage-request")) {
			sendJson(res, { ok: false, reason: "stage-request-pending" });
			return;
		}
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
			// 에이전트가 듣는 중(runGate 대기) → 즉시 전송: chatLog 적재 + 전달.
			// 응답 중(resolver 없음) → 가시 큐(pendingChats)에만 적재. chatLog 에 넣지 않아
			// 취소 시 완전 삭제되고, runGate 재진입(읽기) 시 chatLog 로 승격된다.
			const r = gate.currentResolver;
			if (r) {
				gate.chatLog.push(msg);
				gate.pendingChats.push(msg);
				gate.currentResolver = null;
				r({ kind: "chat", messages: gate.pendingChats.splice(0) });
			} else {
				gate.pendingChats.push(msg);
				broadcast("chat");
			}
		}
		sendJson(res, { ok: true });
	}

	/** POST /api/chat/cancel — 큐 취소(broadcast 필요 — 클로저 주입). */
	async function chatCancel(req: Req, res: Res): Promise<void> {
		const parsed = (await readJson(req)) as { id?: unknown } | null;
		if (parsed === null) {
			res.writeHead(400);
			res.end("bad request");
			return;
		}
		const id = typeof parsed.id === "string" ? parsed.id : "";
		const idx = gate.pendingChats.findIndex((m) => m.id === id);
		if (idx >= 0) {
			gate.pendingChats.splice(idx, 1);
			broadcast("chat");
			sendJson(res, { ok: true });
			return;
		}
		sendJson(res, { ok: false, reason: "already-sent" });
	}

	return async (req: Req, res: Res): Promise<void> => {
		const url = req.url ?? "/";
		gate.lastSeen = Date.now(); // 뷰어 하트비트 — 탭 생존 신호(재오픈 판정에 사용).
		res.setHeader("Cache-Control", "no-store");
		try {
			if (url === "/api/state") return stateHandler(gate, req, res);
			if (url === "/api/events") return eventsHandler(gate, req, res);
			if (url === "/api/decision" && req.method === "POST")
				return decisionHandler(gate, req, res);
			if (url === "/api/review-request" && req.method === "POST")
				return reviewRequestHandler(gate, req, res);
			if (url === "/api/chat/cancel" && req.method === "POST")
				return chatCancel(req, res);
			if (url === "/api/chat") {
				if (req.method === "POST") {
					const parsed = (await readJson(req)) as {
						text?: unknown;
						blockId?: unknown;
						quote?: unknown;
						kind?: unknown;
						targetStage?: unknown;
						decision?: unknown;
					} | null;
					if (parsed === null) {
						res.writeHead(400);
						res.end("bad request");
						return;
					}
					if (parsed.kind === "stage-request")
						return chatStageRequest(parsed, res);
					return chatPost(parsed, res);
				}
				return chatGetHandler(gate, req, res);
			}
			// 정적 자원(SPA). /assets/* → dist 파일, 그 외 → index.html.
			await serveStatic(gate, url, res);
		} catch {
			res.writeHead(500);
			res.end("server error");
		}
	};
}

/** 정적 SPA 서빙 — traversal 차단 + 미존재 시 index.html 폴백. */
async function serveStatic(gate: PersistentGate, url: string, res: Res) {
	const filePath = safeJoin(gate.viewerDistDir, url);
	const fallback = join(gate.viewerDistDir, "index.html");
	const target = filePath && (await canRead(filePath)) ? filePath : fallback;
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
}
