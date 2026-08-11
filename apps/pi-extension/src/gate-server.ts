// Gate server — 로컬 HTTP 서버로 뷰어를 서빙하고 사용자 게이트 결정을 받아 에이전트로 반환.
// 웹 페이지가 게이트 역할(ADR-003 옵션 경로를 주경로로). node:* builtins만 사용(런타임 의존 0).
//
// 책임별 모듈:
//  - gate-events.ts   — GateEvent/ChatMessage 계약 타입
//  - viewer-state.ts  — /api/state 페이로드 조립(산출물·그래프 트리·회귀 숨김)
//  - gate-http.ts     — /api/* 라우팅 HTTP 핸들러 + 정적 SPA 서빙
//  - gate-manager.ts  — 기능별 영속 게이트 서버 풀(생성/재사용/종료/채팅 로그)
//  - gate-browser.ts  — 브라우저 오픈·모듈 경로 유틸
import {
	getOrCreateGate,
	BROWSER_REOPEN_AFTER_MS,
	closeGate,
	appendAgentChat,
} from "./gate-manager.ts";
import { openBrowser, moduleDir, resolveViewerDist } from "./gate-browser.ts";
import type { GateEvent } from "./gate-events.ts";

export type { GateEvent } from "./gate-events.ts";
export { closeGate, appendAgentChat } from "./gate-manager.ts";
export { moduleDir, resolveViewerDist } from "./gate-browser.ts";

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
