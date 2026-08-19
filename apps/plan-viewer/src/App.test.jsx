// App.jsx 상태 전이·읽기 전용 이전 단계 보기 테스트(F2):
// 1) 확정 제출 후 gateOpen=false 가 와도 전체 '준비 중' 화면으로 전환하지 않고
//    기존 페이지를 유지하며 확정 버튼이 로딩(스피너)으로 연출된다.
// 2) 이전 단계를 스테퍼로 클릭하면 읽기 전용(코멘트·채팅·게이트 비활성) 이전 단계 뷰로
//    전환되고, '현재 단계로 돌아가기'로 복귀하면 게이트/채팅이 다시 활성화된다.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, beforeEach, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const h = React.createElement;

// 게이트 서버 상태 fixture — stage 3, 산출물 1·2·3 포함(승인된 이전 단계 포함).
function makeState(over = {}) {
	return {
		feature: "demo",
		stage: 3,
		stageName: "구현 계획",
		requiresArtifact: true,
		done: false,
		gateOpen: true,
		designPrompt: "",
		artifacts: [
			{
				stage: 1,
				name: "요구사항",
				file: "stage1.md",
				format: "markdown",
				md: "# Stage 1 — 시나리오",
			},
			{
				stage: 2,
				name: "설계",
				file: "stage2.md",
				format: "markdown",
				md: "# Stage 2 — 설계",
			},
			{
				stage: 3,
				name: "구현 계획",
				file: "stage3.md",
				format: "markdown",
				md: "# Stage 3 — 구현 계획",
			},
		],
		...over,
	};
}

// fetch/EventSource 스텁.
let currentState;
let esListeners; // { type -> Set<fn> }
let chatPosts; // /api/chat POST 기록(stage-request 검증용)
let decisionPosts; // /api/decision POST 기록(채널 단일화 검증용)
let chatGet; // GET /api/chat 응답(큐 대기 상태 시나리오용)
const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

function installStubs() {
	currentState = makeState();
	esListeners = new Map();
	chatPosts = [];
	decisionPosts = [];
	chatGet = { messages: [], queue: [] };
	globalThis.fetch = async (url, opts) => {
		if (String(url).endsWith("/api/state")) {
			return { ok: true, json: async () => currentState };
		}
		if (String(url).endsWith("/api/decision")) {
			if (opts?.body) {
				try {
					decisionPosts.push(JSON.parse(opts.body));
				} catch {
					/* 본문 파싱 실패 시 무시 */
				}
			}
			return { ok: true, json: async () => ({}) };
		}
		if (String(url).endsWith("/api/chat")) {
			const method = opts?.method ?? "GET";
			if (method !== "GET" && opts?.body) {
				try {
					chatPosts.push(JSON.parse(opts.body));
				} catch {
					/* 본문 파싱 실패 시 무시 */
				}
			}
			return {
				ok: true,
				json: async () => (method === "GET" ? chatGet : {}),
			};
		}
		if (String(url).endsWith("/api/review-request")) {
			return { ok: true, json: async () => ({}) };
		}
		return { ok: false, json: async () => ({}) };
	};
	function EsStub() {
		this.emit = null;
	}
	EsStub.prototype.addEventListener = (type, fn) => {
		if (!esListeners.has(type)) esListeners.set(type, new Set());
		esListeners.get(type).add(fn);
	};
	EsStub.prototype.close = () => {};
	globalThis.EventSource = EsStub;
}

// 게이트 재오픈 시 SSE 'state' 이벤트를 밀어 App 이 fetchState 를 다시 돌리게 한다.
function pushState(next) {
	currentState = next;
	const fns = esListeners.get("state") || new Set();
	for (const fn of fns) fn(new Event("state"));
}

// SSE 'chat' 이벤트(큐 변동)를 밀어 App 이 fetchQueue 를 다시 돌리게 한다.
function pushChat() {
	const fns = esListeners.get("chat") || new Set();
	for (const fn of fns) fn(new Event("chat"));
}

let container;
let root;

beforeEach(async () => {
	installStubs();
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await React.act(async () => {
		root.render(h(App));
	});
});

afterAll(async () => {
	if (root) await React.act(async () => root.unmount());
	container?.remove();
	globalThis.fetch = originalFetch;
	globalThis.EventSource = originalEventSource;
	GlobalRegistrator.unregister();
});

// ——— 1) 확정 후에 페이지 유지 + 확정 버튼 로딩 ———
test("확정 제출 후 gateOpen=false 여도 페이지 유지, 확정 버튼이 로딩 연출", async () => {
	// Stage 2(중간 단계) reviewing. gateOpen=true. 준비 중 화면 아님.
	await React.act(async () => {
		currentState = makeState({ stage: 2, stageName: "모듈·클래스 설계" });
	});
	await React.act(async () => {
		// state 갱신 → 재렌더 유도(초기 fetch 는 이미 +1회 완료 상태의 stage2 를 받았는지 확인).
		pushState(currentState);
	});

	// 확정 클릭 → onGate POST → pending=true.
	const confirmBtn = [...container.querySelectorAll("button")].find((b) =>
		b.textContent.includes("확정 → Stage 3"),
	);
	expect(confirmBtn).toBeDefined();
	await React.act(async () => {
		confirmBtn.dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
	});

	// 서버가 결정 수락 → gateOpen=false 푸시(에이전트 산출물 작성 중).
	await React.act(async () => {
		pushState(
			makeState({ stage: 2, stageName: "모듈·클래스 설계", gateOpen: false }),
		);
	});

	// 여전히 기존 검토 페이지(main 문서 + 게이트 바)를 유지 — 전체 준비 화면이 아님.
	expect(container.textContent).not.toContain("이전 단계 확정");
	expect(container.textContent).toContain("Stage 2");
	// 확정 버튼이 로딩 연출: 스피너 + '다음 단계 작성 중…', 액션 비활성.
	const primary = [...container.querySelectorAll("button")].find((b) =>
		b.className.includes("primary"),
	);
	expect(primary.disabled).toBe(true);
	expect(container.querySelector(".spinner")).toBeDefined();
	expect(primary.textContent).toContain("다음 단계 작성 중");

	// 게이트 재오픈(gateOpen=true) → 로딩 해소 + 페이지는 그 단계로 유지.
	await React.act(async () => {
		pushState(
			makeState({ stage: 2, stageName: "모듈·클래스 설계", gateOpen: true }),
		);
	});
	const primary2 = [...container.querySelectorAll("button")].find((b) =>
		b.className.includes("primary"),
	);
	expect(primary2.disabled).toBe(false);
	expect(container.querySelector(".spinner")).toBeNull();
});

// ——— 2) 이전 단계 읽기 전용 보기 ———
test("이전 단계 스테퍼 클릭 → 읽기 전용(게이트·채팅 비활성), 현재 단계 복귀로 재활성", async () => {
	// Stage 3 reviewing. 3단계 스테퍼 렌더.
	const steps = [...container.querySelectorAll(".step")];
	expect(steps.length).toBe(3);

	// Stage 1 스테퍼 클릭 → 읽기 전용 이전 단계 보기.
	await React.act(async () => {
		steps[0].dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
	});

	// 읽기 전용 배너 + 코멘트·채팅·게이트 비활성.
	expect(container.querySelector(".readonly-banner")).toBeDefined();
	expect(container.textContent).toContain("읽기 전용");
	expect(container.querySelector(".gate")).toBeNull(); // 게이트(확정/정정) 숨김
	const chatSend = [...container.querySelectorAll("button")].find((b) =>
		b.textContent.includes("전송"),
	);
	expect(chatSend.disabled).toBe(true);

	// 버그2: 읽기 전용으로 이전 단계를 봐도 뒤의 실제 작성 단계(2·3)는 done(작성됨)이다.
	// '아직 안 쓴 단계'인 잠금(locked)은 실제 state.stage(3) 초과뿐이므로 여기엔 없다.
	const writtenStates = [...container.querySelectorAll(".step")].map(
		(el) => el.className,
	);
	expect(writtenStates[1]).toContain("done"); // Stage 2 작성됨·선택 가능(잠금 아님)
	expect(writtenStates[2]).toContain("done"); // Stage 3(현재)도 작성됨·복귀 가능(잠금 아님)
	for (const cls of writtenStates) expect(cls).not.toContain("locked");

	// '현재 단계로 돌아가기' → 편집 가능(게이트 복귀).
	await React.act(async () => {
		const exit = [...container.querySelectorAll("button")].find((b) =>
			b.textContent.includes("현재 단계로"),
		);
		exit.dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
	});
	expect(container.querySelector(".readonly-banner")).toBeNull();
	expect(container.querySelector(".gate")).toBeDefined();
	const chatSend2 = [...container.querySelectorAll("button")].find((b) =>
		b.textContent.includes("전송"),
	);
	expect(chatSend2.disabled).toBe(false);
});

// ——— 3) 읽기 전용에서 스테퍼로 '실제 현재 단계' 클릭 시 배너 해제 (버그1) ———
test("이전 단계 읽기 전용에서 실제 현재 단계 스테퍼 클릭 → 배너·게이트·채팅 재활성", async () => {
	const steps = [...container.querySelectorAll(".step")];
	// 이전 단계(Stage 1) 읽기 전용 진입.
	await React.act(async () => {
		steps[0].dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
	});
	expect(container.querySelector(".readonly-banner")).toBeDefined();

	// 스테퍼에서 '실제 현재 단계'(Stage 3) 클릭 → 배너 해제 + 게이트·채팅 재활성.
	// (수정 전엔 viewStage=3 이 되어 readOnly 가 유지되며 배너가 사라지지 않던 버그)
	await React.act(async () => {
		steps[2].dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
	});
	expect(container.querySelector(".readonly-banner")).toBeNull();
	expect(container.querySelector(".gate")).toBeDefined();
	const chatSend = [...container.querySelectorAll("button")].find((b) =>
		b.textContent.includes("전송"),
	);
	expect(chatSend.disabled).toBe(false);
});

// ——— 4) 미작성(잠금) 단계 구분 — Stage 2에서 뒤 단계(3)만 locked ———
test("Stage 2 reviewing : Stage 3(미작성)만 locked, Stage 1(done)은 보기 가능", async () => {
	// Stage 2 로 전환(실제 서버 단계=2 → 미작성 3 존재).
	await React.act(async () => {
		currentState = makeState({
			stage: 2,
			stageName: "모듈·클래스 설계",
			gateOpen: true,
		});
		pushState(currentState);
	});
	const steps = [...container.querySelectorAll(".step")];
	expect(steps[0].className).toContain("done"); // Stage 1 작성됨·보기 가능
	expect(steps[1].className).toContain("current"); // Stage 2 현재(편집)
	expect(steps[2].className).toContain("locked"); // Stage 3 아직 미작성 → 잠금
});

// ——— 5) confirm(마지막 단계 아님) → '다음 단계 요청' 강조 기록 POST ———
test("confirm(마지막 아님) → /api/chat 에 stage-request(decision 포함) POST, /api/decision 미경유", async () => {
	// Stage 1 reviewing → 확정 버튼은 '✓ 확정 → Stage 2'.
	await React.act(async () => {
		currentState = makeState({ stage: 1, stageName: "요구사항·시나리오" });
		pushState(currentState);
	});
	const confirmBtn = [...container.querySelectorAll("button")].find((b) =>
		b.textContent.includes("확정 → Stage 2"),
	);
	expect(confirmBtn).toBeDefined();
	await React.act(async () => {
		confirmBtn.dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
		await new Promise((r) => setTimeout(r, 0));
	});
	const stageReq = chatPosts.find((p) => p.kind === "stage-request");
	expect(stageReq).toBeDefined();
	expect(stageReq.targetStage).toBe(2);
	expect(stageReq.decision.verdict).toBe("confirm");
	expect(decisionPosts).toHaveLength(0); // decision 은 큐 페이로드로만 전달
});

// ——— 6) 확정 요청 큐 대기 중 게이트 바 로딩 유지 + 상황별 라벨 ———
test("확정 요청이 큐 대기 중인 동안 게이트 재오픈(채팅 루프)해도 로딩 유지, 다음 단계 오픈 시 해제", async () => {
	const confirmBtn = () =>
		[...container.querySelectorAll(".btn.primary")].find((b) =>
			b.className.includes("primary"),
		) ??
		[...container.querySelectorAll("button")].find((b) =>
			b.textContent.includes("확정"),
		);
	// Stage 1 reviewing.
	await React.act(async () => {
		currentState = makeState({ stage: 1, stageName: "요구사항·시나리오" });
		pushState(currentState);
	});
	// 큐에 stage-request 대기 중 상태로 확정 클릭 → 적재 + fetchQueue → 로딩 시작.
	chatGet = {
		messages: [],
		queue: [{ id: "sr1", kind: "stage-request", status: "pending", at: 1 }],
	};
	let btn = confirmBtn();
	await React.act(async () => {
		btn.dispatchEvent(
			new window.MouseEvent("click", { bubbles: true, cancelable: true }),
		);
		await new Promise((r) => setTimeout(r, 0));
	});
	btn = confirmBtn();
	expect(btn.textContent).toContain("앞선 채팅 응답 후 진행…");
	// 채팅 응답 루프로 같은 단계 게이트가 재오픈(gateOpen=true) → 로딩 유지되어야 한다.
	await React.act(async () => {
		pushState(
			makeState({ stage: 1, stageName: "요구사항·시나리오", gateOpen: true }),
		);
		await new Promise((r) => setTimeout(r, 0));
	});
	btn = confirmBtn();
	expect(btn.textContent).toContain("앞선 채팅 응답 후 진행…");
	expect(btn.disabled).toBe(true);
	// 확정 실행(큐 해소) → 단계 진행 + 게이트 닫힘(2단계 작성 중) → 기본 라벨로 유지.
	chatGet = { messages: [], queue: [] };
	await React.act(async () => {
		pushChat();
		pushState(
			makeState({ stage: 2, stageName: "모듈·클래스 설계", gateOpen: false }),
		);
		await new Promise((r) => setTimeout(r, 0));
	});
	btn = confirmBtn();
	expect(btn.textContent).toContain("다음 단계 작성 중…");
	// Stage 2 게이트 오픈 → 로딩 해제, 다음 확정 버튼 라벨.
	await React.act(async () => {
		pushState(
			makeState({ stage: 2, stageName: "모듈·클래스 설계", gateOpen: true }),
		);
		await new Promise((r) => setTimeout(r, 0));
	});
	btn = confirmBtn();
	expect(btn.textContent).toContain("확정 → Stage 3");
	expect(btn.disabled).toBe(false);
});

// ——— 상단 바: 동적 스테이지 구성 목록(ADR-031) ———
test("상단 바·스템퍼가 정해진 구성(4단계) 스테이지 목록 표시", async () => {
	await React.act(async () => {
		currentState = makeState({
			stage: 2,
			stageName: "리스크 분석",
			stages: [
				{ n: 1, name: "요청 이해·시나리오" },
				{ n: 2, name: "리스크 분석" },
				{ n: 3, name: "테스트 전략" },
				{ n: 4, name: "구현 계획" },
			],
		});
		pushState(currentState);
		await new Promise((r) => setTimeout(r, 0));
	});
	const chips = [...container.querySelectorAll(".stage-chip")];
	expect(chips.map((c) => c.textContent)).toEqual([
		"1요청 이해·시나리오",
		"2리스크 분석",
		"3테스트 전략",
		"4구현 계획",
	]);
	// 현재 단계 강조·이후 단계 ahead.
	expect(chips[1].className).toContain("current");
	expect(chips[2].className).toContain("ahead");
	expect(chips[0].className).not.toContain("ahead");
	// 스템퍼도 동일 구성 기준 — 고정 3단계가 아닌 4스텝.
	expect(container.querySelectorAll(".step").length).toBe(4);
});

test("상단 바: stages 미전달(레거시 state) → 레거시 3단계 폴백", () => {
	// 기본 fixture 는 stages 필드 없음 — 뷰어가 레거시 3단계로 폴백한다.
	expect(container.querySelectorAll(".stage-chip").length).toBe(3);
});
