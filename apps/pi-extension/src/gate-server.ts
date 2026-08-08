// Gate server — 로컬 HTTP 서버로 뷰어를 서빙하고 사용자 게이트 결정을 받아 에이전트로 반환.
// 웹 페이지가 게이트 역할(ADR-003 옵션 경로를 주경로로). node:* builtins만 사용(런타임 의존 0).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	STAGES,
	loadState,
	readArtifact,
	type ArtifactFormat,
	type ChatMessage,
	type GateDecision,
} from "@factorynote/core";

/** 게이트 대기 중 발생 이벤트: 사용자 최종 결정, 또는 실시간 채팅(에이전트에 전달해 답변/수정 유도). */
export type GateEvent =
	| { kind: "decision"; decision: GateDecision }
	| { kind: "chat"; messages: ChatMessage[] };

export interface ViewerState {
	feature: string;
	stage: number;
	stageName: string;
	requiresArtifact: boolean;
	done: boolean;
	/** 현 단계 산출물이 사용자 검토 대기 중인지(에이전트가 게이트를 열었는지). 뷰어 폴링 신호. */
	gateOpen: boolean;
	designPrompt: string;
	feedbackChecklist: string[];
	artifacts: {
		stage: number;
		name: string;
		file: string;
		format: ArtifactFormat;
		md?: string;
	}[];
}

async function buildViewerState(
	root: string,
	feature: string,
): Promise<ViewerState> {
	const state = (await loadState(root, feature)) ?? null;
	const stage = state?.stage ?? 1;
	const def = STAGES[stage - 1] ?? STAGES[0]!;
	const artifacts: ViewerState["artifacts"] = [];
	for (const s of STAGES) {
		if (!s.artifactFile) continue;
		// 회귀 정합성(#1): revert 로 state.stage 가 뒤로 옮겨졌다면 그 이후 단계의
		// (이제 무효한) 산출물은 뷰어에서 숨긴다. state 미지정 시 기존 동작 유지.
		if (state && s.id > state.stage) continue;
		const raw = await readArtifact(root, feature, s.artifactFile);
		if (raw === undefined) continue;
		artifacts.push({
			stage: s.id,
			name: s.name,
			file: s.artifactFile,
			format: s.format,
			md: raw,
		});
	}
	return {
		feature,
		stage,
		stageName: def.name,
		requiresArtifact: def.producesArtifact,
		done: state?.done ?? false,
		gateOpen: state?.gateOpen ?? false,
		designPrompt: def.designPrompt,
		feedbackChecklist: [...def.feedbackChecklist],
		artifacts,
	};
}

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

function openBrowser(url: string): void {
	const cmd =
		process.platform === "win32"
			? `start "" "${url}"`
			: process.platform === "darwin"
				? `open "${url}"`
				: `xdg-open "${url}"`;
	exec(cmd, () => {
		/* 열기 실패는 무시 — 사용자가 URL을 직접 열 수 있음 */
	});
}

export interface RunGateOptions {
	root: string;
	feature: string;
	viewerDistDir: string;
	signal?: AbortSignal;
	open?: boolean;
	/** 게이트 자동 만료(ms). 0 또는 미지정=끄기. 좀비 게이트 방지(#4). */
	timeoutMs?: number;
	/** 서버가 준비되면 URL 을 알릨(테스트/디버그용). async 면 완료를 기다린다. */
	onReady?: (url: string) => void | Promise<void>;
	/** 브라우저 오픈 함수(테스트 주입용). 미지정 시 기본 openBrowser. */
	browserOpener?: (url: string) => void;
	/** 탭 하트비트가 이 시간(ms) 이상 없으면 브라우저 재오픈(테스트용). 미지정 시 기본값. */
	reopenAfterMs?: number;
}

// --- 영속 게이트 서버(기능별 1개) ---
// 단계마다 서버를 새로 만들지 않고 플랜 전체에서 하나의 서버/포트를 재사용 →
// 같은 브라우저 탭이 단계 전환을 따라간다. 서버는 플랜 완료(closeGate) 시에만 닫힌다.
// 브라우저 오픈은 하트비트로 제어: 뷰어 탭이 살아있는(최근 요청 있음) 동안은 재오픈하지 않고,
// 탭이 없거나(최초) 닫혔으면 새 게이트 시작 시 다시 연다(다중 탭 방지 + 재오픈 보장).
interface PersistentGate {
	root: string;
	feature: string;
	viewerDistDir: string;
	server: import("node:http").Server;
	url: string;
	port: number;
	/** 마지막 뷰어 요청 시각(ms). 탭 생존 하트비트 — 오래되면 탭이 닫힌 것으로 보고 브라우저 재오픈. */
	lastSeen: number;
	currentResolver: ((e: GateEvent) => void) | null;
	/** 채팅 누적 로그(사용자+에이전트). 뷰어가 GET /api/chat 로 폴링. */
	chatLog: ChatMessage[];
	/** 에이전트에 아직 전달되지 않은 사용자 채팅(runGate 가 chat 이벤트로 resolve 시 비움). */
	pendingChats: ChatMessage[];
}

const gates = new Map<string, PersistentGate>();

/** 뷰어 하트비트가 이 시간(ms) 이상 없으면 탭이 닫힌 것으로 보고 브라우저를 다시 연다. 뷰어 폴링 주기(2s)의 2.5배 여유. */
const BROWSER_REOPEN_AFTER_MS = 5000;

function gateKey(root: string, feature: string): string {
	return `${root}::${feature}`;
}

/** 게이트 HTTP 핸들러(영속 gate 객체를 클로저로 잡는다). */
function makeGateHandler(gate: PersistentGate) {
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
					...(typeof parsed.artifactMd === "string"
						? { artifactMd: parsed.artifactMd }
						: {}),
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

/** 기능별 영속 게이트 조회(없으면 생성). 같은 기능은 항상 같은 서버/포트. */
async function getOrCreateGate(opts: {
	root: string;
	feature: string;
	viewerDistDir: string;
}): Promise<PersistentGate> {
	const key = gateKey(opts.root, opts.feature);
	const existing = gates.get(key);
	if (existing && existing.server.listening) return existing;

	const gate: PersistentGate = {
		root: opts.root,
		feature: opts.feature,
		viewerDistDir: opts.viewerDistDir,
		// 생성 직후 덮어쓰기 전 임시값(handler 가 gate 를 참조해야 해 선언이 꼬임).
		server: undefined as unknown as PersistentGate["server"],
		url: "",
		port: 0,
		lastSeen: 0,
		currentResolver: null,
		chatLog: [],
		pendingChats: [],
	};
	const server = createServer(makeGateHandler(gate));
	gate.server = server;
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const addr = server.address();
	gate.port = typeof addr === "object" && addr ? addr.port : 0;
	gate.url = `http://127.0.0.1:${gate.port}`;
	gates.set(key, gate);
	return gate;
}

/** 영속 게이트 종료(플랜 완료 시 호출). 멱등. */
export async function closeGate(root: string, feature: string): Promise<void> {
	const key = gateKey(root, feature);
	const gate = gates.get(key);
	if (!gate) return;
	gates.delete(key);
	gate.currentResolver = null;
	// 클라이언트가 최종 응답 바이트를 읽어가도록 잠시 대기 후 종료.
	await new Promise((r) => setTimeout(r, 30));
	gate.server.closeAllConnections?.();
	await new Promise<void>((resolve) => gate.server.close(() => resolve()));
}

/**
 * 게이트: 영속 서버에서 이번 단계의 사용자 결정을 대기한다.
 * 서버는 플랜 전체에서 재사용 → 브라우저는 첫 게이트에서 1회만 오픈.
 * 결정·중단·시간초과 시 결정을 반환하되 서버는 닫지 않는다(완료 시 closeGate).
 */
export async function runGate(opts: RunGateOptions): Promise<GateEvent> {
	const {
		root,
		feature,
		viewerDistDir,
		signal,
		open = true,
		timeoutMs = 0,
		onReady,
		browserOpener,
		reopenAfterMs,
	} = opts;

	const gate = await getOrCreateGate({ root, feature, viewerDistDir });

	// 브라우저 오픈: 최초(또는 탭이 닫혀 하트비트가 오래된 경우)에만. 탭이 살아있으면 재오픈하지 않는다(다중 탭 방지).
	if (
		open &&
		Date.now() - gate.lastSeen > (reopenAfterMs ?? BROWSER_REOPEN_AFTER_MS)
	) {
		(browserOpener ?? openBrowser)(gate.url);
	}

	let resolveEvent: ((e: GateEvent) => void) | null = null;
	const settled = new Promise<GateEvent>((resolve) => {
		resolveEvent = resolve;
	});
	gate.currentResolver = (e) => resolveEvent?.(e);

	await onReady?.(gate.url);

	// 채팅 루프 재진입 보호: runGate 가 chat 로 resolve 된 뒤 에이전트가 응답·재진입하는
	// 사이에 쌓인 pendingChats 를 즉시 전달(채팅 유실 방지).
	if (gate.pendingChats.length > 0) {
		const r = gate.currentResolver;
		gate.currentResolver = null;
		r?.({ kind: "chat", messages: gate.pendingChats.splice(0) });
	}

	const onAbort = () => {
		// 중단 시 modify 복귀. 서버는 유지 — 인터럽트 복구가 같은 탭을 재사용.
		gate.currentResolver = null;
		resolveEvent?.({
			kind: "decision",
			decision: {
				verdict: "modify",
				comments: [{ text: "(게이트 중단됨)" }],
			},
		});
	};
	signal?.addEventListener("abort", onAbort, { once: true });

	// #4 게이트 타임아웃: 사용자 결정 없이 만료 시 자동 modify 복귀(좀비 게이트 방지).
	const timer =
		timeoutMs > 0
			? setTimeout(() => {
					gate.currentResolver = null;
					resolveEvent?.({
						kind: "decision",
						decision: {
							verdict: "modify",
							comments: [{ text: "(게이트 시간 초과 — 자동 복귀)" }],
						},
					});
				}, timeoutMs)
			: null;

	const result = await settled;
	signal?.removeEventListener("abort", onAbort);
	if (timer) clearTimeout(timer);
	return result;
}

export interface ObserveGateOptions {
	root: string;
	feature: string;
	viewerDistDir: string;
	open?: boolean;
	onReady?: (url: string) => void | Promise<void>;
	browserOpener?: (url: string) => void;
	reopenAfterMs?: number;
}

/**
 * 관찰용 오픈(auto-advance 모드): 영속 게이트 서버를 확보하고 브라우저를(필요 시)
 * 열되, 사용자 결정을 기다리지 않고 즉시 반환한다. 뷰어는 /api/state 폴링으로
 * 산출물·단계 진행을 실시간 관찰한다. 결정은 호출측이 confirm 으로 자동 적용.
 * runGate 와 별개 — 게이트 결정 대기(블로킹)를 하지 않는다.
 */
export async function observeGate(opts: ObserveGateOptions): Promise<void> {
	const {
		root,
		feature,
		viewerDistDir,
		open = true,
		onReady,
		browserOpener,
		reopenAfterMs,
	} = opts;
	const gate = await getOrCreateGate({ root, feature, viewerDistDir });
	if (
		open &&
		Date.now() - gate.lastSeen > (reopenAfterMs ?? BROWSER_REOPEN_AFTER_MS)
	) {
		(browserOpener ?? openBrowser)(gate.url);
	}
	await onReady?.(gate.url);
}

/** 에이전트 답변을 채팅 로그에 추가(뷰어가 GET /api/chat 폴링으로 표시). drivePlan 이 호출. */
export function appendAgentChat(
	root: string,
	feature: string,
	text: string,
): void {
	const gate = gates.get(gateKey(root, feature));
	if (!gate || !text.trim()) return;
	gate.chatLog.push({
		id: crypto.randomUUID(),
		role: "agent",
		text,
		at: Date.now(),
	});
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

/** 뷰어 dist 디렉토리 후보를 순서대로 탐색. */
export function resolveViewerDist(candidates: string[]): string | null {
	// 동기 존재 여부는 호출측에서 비동기로 확인; 여기선 후보만 정리.
	for (const c of candidates) {
		if (c) return c;
	}
	return null;
}

/** ESM 모듈 경로에서 디렉토리 추출(jiti 환경에서 import.meta.url 사용). */
export function moduleDir(importMetaUrl: string): string {
	return join(fileURLToPath(importMetaUrl), "..");
}
