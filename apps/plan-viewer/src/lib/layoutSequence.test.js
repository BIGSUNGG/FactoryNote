// layoutSequence 자체체크(ADR-021): 컬럼·시간축 순서·fragment 박스(중첩 포함)·결정성.
import { test, expect } from "bun:test";
import { layoutSequence } from "./layoutSequence.js";

const data = {
	version: 2,
	type: "sequence",
	participants: [
		{ id: "ui", name: "UI" },
		{ id: "api", name: "API" },
		{ id: "db", name: "DB" },
	],
	body: [
		{ from: "ui", to: "api", label: "요청" },
		{
			kind: "loop",
			label: "재시도",
			body: [
				{ from: "api", to: "db", label: "쿼리" },
				{
					kind: "alt",
					label: "성공?",
					body: [{ from: "db", to: "api", label: "결과", kind: "reply" }],
				},
			],
		},
		{ from: "api", to: "ui", label: "응답", kind: "reply" },
	],
};

test("참여자 컬럼: 입력 순서대로 x 증가", () => {
	const l = layoutSequence(data);
	expect(l.participants.map((p) => p.id)).toEqual(["ui", "api", "db"]);
	expect(l.participants[0].x).toBeLessThan(l.participants[1].x);
	expect(l.participants[1].x).toBeLessThan(l.participants[2].x);
});

test("메시지: 시간축 순서 = body 순서, y 단조 증가", () => {
	const l = layoutSequence(data);
	expect(l.messages.map((m) => m.label)).toEqual([
		"요청",
		"쿼리",
		"결과",
		"응답",
	]);
	for (let i = 1; i < l.messages.length; i++) {
		expect(l.messages[i].y).toBeGreaterThan(l.messages[i - 1].y);
	}
	// from/to 컬럼 좌표가 참여자 x 와 일치.
	const byId = Object.fromEntries(l.participants.map((p) => [p.id, p.x]));
	for (const m of l.messages) {
		expect(m.x1).toBe(byId[m.from]);
		expect(m.x2).toBe(byId[m.to]);
	}
	expect(l.messages[3].kind).toBe("reply");
});

test("fragment: 중첩 포함 박스 — 바깥(loop)이 안쪽(alt)을 완전히 포함", () => {
	const l = layoutSequence(data);
	expect(l.fragments.map((f) => f.kind)).toEqual(["loop", "alt"]);
	const loop = l.fragments.find((f) => f.kind === "loop");
	const alt = l.fragments.find((f) => f.kind === "alt");
	expect(alt.y).toBeGreaterThan(loop.y);
	expect(alt.y + alt.h).toBeLessThan(loop.y + loop.h);
	expect(alt.x).toBeGreaterThanOrEqual(loop.x);
	expect(alt.x + alt.w).toBeLessThanOrEqual(loop.x + loop.w);
	expect(loop.label).toBe("재시도");
});

test("fragment 스팬: 내부 메시지가 쓰는 컬럼만 덮는다", () => {
	const l = layoutSequence(data);
	const alt = l.fragments.find((f) => f.kind === "alt");
	// alt 안 메시지는 db→api — 컬럼 1·2 만 스팬(컬럼 0 미포함).
	const col0Right = l.participants[0].x + 85;
	expect(alt.x).toBeGreaterThan(col0Right - 85);
});

test("자가 호출 메시지: self 플래그 + 같은 x", () => {
	const l = layoutSequence({
		version: 2,
		type: "sequence",
		participants: [{ id: "a", name: "A" }],
		body: [{ from: "a", to: "a", label: "self" }],
	});
	expect(l.messages[0].self).toBe(true);
	expect(l.messages[0].x1).toBe(l.messages[0].x2);
});

test("결정성: 같은 입력 → 두 번 같은 출력", () => {
	expect(layoutSequence(data)).toEqual(layoutSequence(data));
});
