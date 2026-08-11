// 영속 게이트 서버(기능별 1개) — 단계마다 서버를 새로 만들지 않고 플랜 전체에서 하나의
// 서버/포트를 재사용 → 같은 브라우저 탭이 단계 전환을 따라간다. 서버는 플랜 완료(closeGate) 시에만 닫힌다.
// 브라우저 오픈은 하트비트로 제어: 뷰어 탭이 살아있는(최근 요청 있음) 동안은 재오픈하지 않고,
// 탭이 없거나(최초) 닫혔으면 새 게이트 시작 시 다시 연다(다중 탭 방지 + 재오픈 보장).
import { createServer } from "node:http";
import { makeGateHandler } from "./gate-http.ts";
import type { ChatMessage, GateEvent } from "./gate-events.ts";

export interface PersistentGate {
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
export const BROWSER_REOPEN_AFTER_MS = 5000;

function gateKey(root: string, feature: string): string {
	return `${root}::${feature}`;
}

/** 기능별 영속 게이트 조회(없으면 생성). 같은 기능은 항상 같은 서버/포트. */
export async function getOrCreateGate(opts: {
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
