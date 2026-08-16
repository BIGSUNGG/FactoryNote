// ChatSidebar 전송 대기 큐 테스트:
// 1) 대기 채팅은 본문 미노출 한 줄 미리보기로 큐 영역에 렌더(카드 클릭 = 취소).
// 2) 큐 카드 클릭 → POST /api/chat/cancel 호출 후 큐에서 제거.
// 3) 큐의 단계 진행 요청은 검정 카드 + 클릭 취소 허용 + 채팅 입력 잠금·안내.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, beforeEach, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import ChatSidebar from "./ChatSidebar.jsx";

const h = React.createElement;

// fetch 스텁 — GET /api/chat 는 {messages, queue} 반환, cancel POST 는 기록.
let chatResp;
let cancelCalls;
const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

function installStubs() {
	chatResp = { messages: [], queue: [] };
	cancelCalls = [];
	globalThis.fetch = async (url, opts) => {
		const u = String(url);
		if (u.endsWith("/api/chat/cancel")) {
			try {
				cancelCalls.push(JSON.parse(opts?.body ?? "{}"));
			} catch {
				/* 본문 파싱 실패 시 무시 */
			}
			chatResp = { messages: chatResp.messages, queue: [] }; // 취소 후 큐 비움
			return { ok: true, json: async () => ({ ok: true }) };
		}
		if (u.endsWith("/api/chat")) {
			return { ok: true, json: async () => chatResp };
		}
		return { ok: false, json: async () => ({}) };
	};
	// ChatSidebar 가 EventSource 를 직접 쓰지 않지만 글로벌 안전장치.
	function EsStub() {}
	EsStub.prototype.addEventListener = () => {};
	EsStub.prototype.close = () => {};
	globalThis.EventSource = EsStub;
}

let container;
let root;

beforeEach(async () => {
	installStubs();
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterAll(async () => {
	if (root) await React.act(async () => root.unmount());
	container?.remove();
	globalThis.fetch = originalFetch;
	globalThis.EventSource = originalEventSource;
	GlobalRegistrator.unregister();
});

// 폴링/마운트 fetchChat 완료를 기다린다.
function flush() {
	return new Promise((r) => setTimeout(r, 0));
}

test("대기 채팅은 한 줄 미리보기로 큐 렌더(카드=취소 버튼), 채팅 입력은 유지", async () => {
	chatResp = {
		messages: [{ id: "m1", role: "agent", text: "안녕", at: 1 }],
		queue: [
			{ id: "q1", role: "user", text: "수정해줘", at: 2 },
			{
				id: "q2",
				role: "user",
				text: "a".repeat(60),
				at: 3,
				blockId: "b3",
			},
		],
	};
	await React.act(async () => {
		root.render(h(ChatSidebar, { stage: 1 }));
	});
	await React.act(async () => {
		await flush();
	});
	expect(container.textContent).toContain("전송 대기 중");
	const items = container.querySelectorAll(".chat-queued-msg");
	expect(items).toHaveLength(2);
	// 미리보기 — 무엇이 대기 중인지 식별 가능(첫 줄 + 말줄임 40자).
	expect(items[0].textContent).toContain("수정해줘");
	expect(items[1].textContent).toContain("[b3]");
	expect(items[1].textContent).toContain("a".repeat(40));
	expect(items[1].textContent).not.toContain("a".repeat(41)); // 40자 넘으면 말줄임
	// 카드 전체가 취소 트리거(버블 role) — 별도 ✕ 버튼 없음.
	expect(items[0].getAttribute("role")).toBe("button");
	expect(items[0].querySelector("button")).toBeNull();
	// 본 채팅 영역(.chat-body)에는 대기 메시지가 노출되지 않는다.
	const sentMsgs = container.querySelectorAll(".chat-body .chat-msg");
	expect([...sentMsgs].some((el) => el.textContent.includes("수정해줘"))).toBe(
		false,
	);
	// 일반 채팅 대기만으로는 입력이 잠기지 않는다.
	expect(container.querySelector(".chat-input-row textarea").disabled).toBe(
		false,
	);
});

test("큐 카드 클릭 → /api/chat/cancel POST 후 큐에서 제거", async () => {
	chatResp = {
		messages: [],
		queue: [{ id: "q9", role: "user", text: "취소될메시지", at: 1 }],
	};
	await React.act(async () => {
		root.render(h(ChatSidebar, { stage: 1 }));
	});
	await React.act(async () => {
		await flush();
	});
	const card = container.querySelector(".chat-queued-msg");
	await React.act(async () => {
		card.dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
		await flush();
	});
	expect(cancelCalls).toHaveLength(1);
	expect(cancelCalls[0].id).toBe("q9");
	// 취소 후 큐 비어 → 대기 영역·메시지 사라짐.
	expect(container.textContent).not.toContain("취소될메시지");
});

test("큐의 단계 요청은 검정 카드 + 클릭 취소 허용 렌더, 채팅 입력 잠금·안내", async () => {
	chatResp = {
		messages: [],
		queue: [
			{
				id: "sr1",
				role: "user",
				kind: "stage-request",
				status: "pending",
				targetStage: 2,
				text: "Stage 2 진행 요청",
				at: 1,
			},
		],
	};
	await React.act(async () => {
		root.render(h(ChatSidebar, { stage: 1 }));
	});
	await React.act(async () => {
		await flush();
	});
	const pending = container.querySelector(".chat-queued-msg.stage-request");
	expect(pending).toBeDefined();
	expect(pending.textContent).toContain("Stage 2 진행 요청");
	// 채팅과 동일하게 카드 클릭으로 취소 허용.
	expect(pending.getAttribute("role")).toBe("button");
	// 확정 대기 중 채팅 입력 잠금 + 안내 표시.
	expect(container.querySelector(".chat-input-row textarea").disabled).toBe(
		true,
	);
	expect(container.querySelector(".chat-send").disabled).toBe(true);
	expect(container.querySelector(".chat-lock-notice")).toBeDefined();
	expect(container.textContent).toContain("다음 단계 요청이 대기 중");
	// 본 채팅 본문엔 pending 단계 요청이 노출되지 않음.
	expect(
		container.querySelector(".chat-body .chat-msg.stage-request"),
	).toBeNull();
	// 카드 클릭 → /api/chat/cancel POST 로 확정 요청 취소(큐 비면 잠금 해제).
	await React.act(async () => {
		pending.dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
		await flush();
	});
	expect(cancelCalls).toHaveLength(1);
	expect(cancelCalls[0].id).toBe("sr1");
	expect(container.querySelector(".chat-lock-notice")).toBeNull();
});

test("fulfilled 단계 요청은 채팅 본문에 강조 렌더", async () => {
	chatResp = {
		messages: [
			{
				id: "sr2",
				role: "user",
				kind: "stage-request",
				status: "fulfilled",
				targetStage: 2,
				text: "Stage 2 진행 요청",
				at: 1,
			},
		],
		queue: [],
	};
	await React.act(async () => {
		root.render(h(ChatSidebar, { stage: 2 }));
	});
	await React.act(async () => {
		await flush();
	});
	const done = container.querySelector(".chat-body .chat-msg.stage-request");
	expect(done).toBeDefined();
	expect(done.textContent).toContain("Stage 2 진행 요청");
	// 큐 영역엔 fulfilled 는 노출되지 않음.
	expect(container.querySelector(".chat-queued-msg.stage-request")).toBeNull();
});
