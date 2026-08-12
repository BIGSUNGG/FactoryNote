// layoutFlowchart 자체체크(ADR-021): 결정적 자동 배치 + 노드 겹침 0 + 사이클 안전.
import { test, expect } from "bun:test";
import { layoutFlowchart } from "./layoutFlowchart.js";

const data = {
	version: 2,
	type: "flowchart",
	nodes: [
		{ id: "start", label: "시작", shape: "terminal" },
		{ id: "build", label: "빌드" },
		{ id: "test", label: "테스트" },
		{ id: "check", label: "통과?", shape: "decision" },
		{ id: "end", label: "종료", shape: "terminal" },
	],
	edges: [
		{ from: "start", to: "build" },
		{ from: "build", to: "test" },
		{ from: "test", to: "check", label: "완료" },
		{ from: "check", to: "end", label: "예" },
		{ from: "check", to: "build", label: "아니오" }, // 백엣지(사이클)
	],
};

test("노드: 전부 배치되고 좌표 보유", () => {
	const l = layoutFlowchart(data);
	expect(l.nodes).toHaveLength(5);
	for (const n of l.nodes) {
		expect(Number.isFinite(n.x)).toBe(true);
		expect(Number.isFinite(n.y)).toBe(true);
	}
});

test("위상: 소스(start)가 가장 위, 종료가 가장 아래 — 백엣지에도 안전", () => {
	const l = layoutFlowchart(data);
	const byId = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
	expect(byId.start.y).toBeLessThan(byId.build.y);
	expect(byId.build.y).toBeLessThan(byId.test.y);
	expect(byId.test.y).toBeLessThan(byId.check.y);
	expect(byId.end.y).toBeGreaterThan(byId.check.y);
	// 백엣지(check→build)는 back 플래그 — build 로 들어오는 정방향 엣지와 구분해 확인.
	expect(l.edges.find((e) => e.from === "check" && e.to === "build").back).toBe(
		true,
	);
	expect(l.edges.find((e) => e.from === "start" && e.to === "build").back).toBe(
		false,
	);
});

test("노드 겹침 0: 모든 노드 쌍이 사각형 분리", () => {
	const l = layoutFlowchart(data);
	for (let i = 0; i < l.nodes.length; i++) {
		for (let j = i + 1; j < l.nodes.length; j++) {
			const a = l.nodes[i];
			const b = l.nodes[j];
			const sepX = a.x + a.w <= b.x || b.x + b.w <= a.x;
			const sepY = a.y + a.h <= b.y || b.y + b.h <= a.y;
			expect(sepX || sepY).toBe(true);
		}
	}
});

test("엣지: 존재 노드만 연결, 화살표 좌표는 노드 경계에서 출발·도착", () => {
	const l = layoutFlowchart(data);
	expect(l.edges).toHaveLength(5);
	const byId = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
	for (const e of l.edges) {
		const a = byId[e.from];
		const b = byId[e.to];
		expect(e.y1).toBe(a.y + a.h);
		expect(e.y2).toBe(b.y);
	}
});

test("결정성: 같은 입력 → 두 번 같은 출력", () => {
	expect(layoutFlowchart(data)).toEqual(layoutFlowchart(data));
});
