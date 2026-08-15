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
export function makeGateHandler(
	gate: {
		root: string;
		feature: string;
		viewerDistDir: string;
		lastSeen: number;
		chatLog: import("@factorynote/core").ChatMessage[];
		pendingChats: import("@factorynote/core").ChatMessage[];
		currentResolver: ((e: GateEvent) => void) | null;
		sseClients: Set<import("node:http").ServerResponse>;
	},
	// SSE push — gate-manager 가 broadcastSse 를 주입(gate-http↔gate-manager 순환 import 회피).
	broadcast: (type: string, data?: unknown) => void,
) {
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
			if (url === "/api/events") {
				// SSE — 뷰어가 상태·채팅 변경을 push 로 수신(폴링 대체). 연결이 유지되는 동안
				// 탭 생존 하트비트로 삼는다(재오픈 판정은 sseClients 비어있을 때만 lastSeen 사용).
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
			if (url === "/api/chat/cancel" && req.method === "POST") {
				// 전송 대기 큐에서 취소. 아직 에이전트에 넘겨지지 않은(pendingChats 에 있는)
				// 메시지만 제거 → 완전 삭제(chatLog 미진입). 이미 넘겨졌으면 거부(read-wins).
				const body = await readBody(req);
				const parsed = JSON.parse(body) as { id?: unknown };
				const id = typeof parsed.id === "string" ? parsed.id : "";
				const idx = gate.pendingChats.findIndex((m) => m.id === id);
				if (idx >= 0) {
					gate.pendingChats.splice(idx, 1);
					broadcast("chat");
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true }));
				} else {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false, reason: "already-sent" }));
				}
				return;
			}
			if (url === "/api/chat") {
				if (req.method === "POST") {
					const body = await readBody(req);
					const parsed = JSON.parse(body) as {
						text?: unknown;
						blockId?: unknown;
						quote?: unknown;
						kind?: unknown;
						targetStage?: unknown;
						decision?: unknown;
					};
					// 단계 진행 요청(confirm 시 뷰어가 POST) — 채팅과 같은 pendingChats 큐의 마지막 칸에
					// 적재되어 기존 대기 채팅의 응답이 모두 끝난 뒤 실행된다. 게이트가 열려 있고 앞에
					// 대기가 없으면(유일 항목) 즉시 decision 으로 resolve — fulfilled 기록만 chatLog 에 남긴다.
					// 선두 도달은 runGate 재진입 시 큐 드레인이 decision 이벤트로 처리한다.
					if (parsed.kind === "stage-request") {
						if (gate.pendingChats.some((m) => m.kind === "stage-request")) {
							res.writeHead(200, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ ok: false, reason: "already-pending" }));
							return;
						}
						const target =
							typeof parsed.targetStage === "number" ? parsed.targetStage : 0;
						const pd = parsed.decision as
							| { comments?: unknown; revertTo?: unknown }
							| undefined;
						const decision: GateDecision = {
							verdict: "confirm",
							comments: Array.isArray(pd?.comments) ? pd.comments : [],
							...(typeof pd?.revertTo === "number"
								? {
										revertTo: pd.revertTo as NonNullable<
											GateDecision["revertTo"]
										>,
									}
								: {}),
						};
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
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: true }));
						return;
					}
					const text = typeof parsed.text === "string" ? parsed.text : "";
					// 확정(단계 진행) 요청이 큐에서 대기 중 → 이후 채팅은 거부(뷰어가 잠금 안내 표시).
					if (gate.pendingChats.some((m) => m.kind === "stage-request")) {
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({ ok: false, reason: "stage-request-pending" }),
						);
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
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true }));
					return;
				}
				// GET /api/chat — 누적 로그(messages) + 전송 대기 큐(queue).
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						messages: gate.chatLog,
						queue: gate.pendingChats,
					}),
				);
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
