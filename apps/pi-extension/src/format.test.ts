// formatForAgent 회귀 테스트 — 채팅 루프 재호출 지시문이 약화되지 않는지 지킨다.
// 에이전트가 chatPending 수신 후 턴을 종료해 게이트가 끊기는 버그(게이트 유지)의 방어막.
import { test, expect } from "bun:test";
import { formatForAgent, type AgentOut } from "./format.ts";

const base: AgentOut = {
	done: false,
	stage: 1,
	stageName: "Stage 1",
	nextAction: "spawn-design",
	dfLoop: 0,
	designPrompt: "",
	gateResult: null,
	message: "게이트 대기 중.",
};

test("chatPending 이 있으면 factorynote_plan(chatResponse) 재호출을 명령형으로 지시한다", () => {
	const out = formatForAgent("feat", {
		...base,
		chatPending: [{ id: "m1", role: "user", text: "이 단계 설명해줘" }],
	});
	expect(out).toContain("이 단계 설명해줘");
	expect(out).toContain("factorynote_plan");
	expect(out).toContain("chatResponse");
	// 턴 종료 금지 — 재호출 유도 강화의 핵심 구문(둘 중 하나는 반드시 present).
	expect(out).toMatch(/턴을 종료하지 말|턴을 끝내면/);
});

test("chatPending 이 없으면 재호출 지시문을 내보내지 않는다", () => {
	const out = formatForAgent("feat", base);
	expect(out).not.toContain("chatResponse");
	expect(out).not.toMatch(/턴을 종료하지 말|턴을 끝내면/);
});

test("chatPending 블록이 본문 message 보다 먼저(상단) 나타난다", () => {
	const out = formatForAgent("feat", {
		...base,
		message: "본문-마커",
		chatPending: [{ id: "m1", role: "user", text: "질문-마커" }],
	});
	expect(out.indexOf("질문-마커")).toBeLessThan(out.indexOf("본문-마커"));
});
