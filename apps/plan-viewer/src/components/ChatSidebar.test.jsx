// ChatSidebar 전송 대기 큐 테스트:
// 1) 대기 메시지가 본 채팅과 분리된 '전송 대기 중' 영역에 ✕ 버튼과 함께 렌더.
// 2) ✕ 클릭 → POST /api/chat/cancel 호출 후 큐에서 제거.
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
			cancelCalls.push(JSON.parse(opts?.body ?? "{}"));
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

test("대기 메시지가 '전송 대기 중' 영역에 ✕ 버튼과 렌더되고 본 채팅엔 중복 미노출", async () => {
	chatResp = {
		messages: [{ id: "m1", role: "agent", text: "안녕", at: 1 }],
		queue: [{ id: "q1", role: "user", text: "수정해줘", at: 2 }],
	};
	await React.act(async () => {
		root.render(h(ChatSidebar, { stage: 1 }));
	});
	await React.act(async () => {
		await flush();
	});
	expect(container.textContent).toContain("전송 대기 중");
	expect(container.textContent).toContain("수정해줘");
	expect(container.querySelector(".chat-cancel")).toBeDefined();
	// 본 채팅 영역(.chat-body)엔 대기 메시지가 중복되지 않는다.
	const sentMsgs = container.querySelectorAll(".chat-body .chat-msg");
	expect([...sentMsgs].some((el) => el.textContent.includes("수정해줘"))).toBe(
		false,
	);
});

test("✕ 클릭 → /api/chat/cancel POST 후 큐에서 제거", async () => {
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
	const cancelBtn = container.querySelector(".chat-cancel");
	await React.act(async () => {
		cancelBtn.dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
		await flush();
	});
	expect(cancelCalls).toHaveLength(1);
	expect(cancelCalls[0].id).toBe("q9");
	// 취소 후 큐 비어 → 대기 영역·메시지 사라짐.
	expect(container.textContent).not.toContain("취소될메시지");
});
