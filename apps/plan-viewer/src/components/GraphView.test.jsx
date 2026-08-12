// GraphView 드릴다운 재현·회귀 테스트(ADR-018): 자식 있는 모듈 노드 더블클릭 →
// 선택 토글 + 하위 레벨 패널 렌더. happy-dom 으로 실제 DOM 이벤트 경로 검증.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import { loadGraphTree } from "../../../../packages/factorynote/src/index.ts";
import GraphView from "./GraphView.jsx";

const h = React.createElement;

// 실제 데이터 축소 판: 루트 2 모듈(하나는 자식 파일 보유) + 클래스 자식 레벨.
const childJson = JSON.stringify({
	version: 2,
	id: "m1",
	childLevel: "classes",
	nodes: [{ id: "C1", type: "class", name: "C1", module: "m1" }],
});
const rootRaw = JSON.stringify({
	version: 2,
	title: "테스트 관계도",
	childLevel: "modules",
	nodes: [
		{
			id: "m1",
			type: "module",
			label: "M1",
			layer: "API",
			children: "m1.json",
		},
		{ id: "m2", type: "module", label: "M2", layer: "Service" },
	],
});
const tree = await loadGraphTree(rootRaw, "draft-graph.json", async (rel) =>
	rel === "m1.json" ? childJson : null,
);

let container;
let root;

async function render() {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await React.act(async () => {
		root.render(h(GraphView, { tree }));
	});
}

afterAll(async () => {
	if (root) await React.act(async () => root.unmount());
	container?.remove();
	GlobalRegistrator.unregister();
});

test("드릴다운: 루트 레벨 렌더 + 더블클릭 힌트 표시 + 노드 히트테스팅 보장", async () => {
	await render();
	const nodes = container.querySelectorAll(".react-flow__node");
	expect(nodes.length).toBe(2);
	expect(container.textContent).toContain("노드 더블클릭");
	// 회귀(그래프 드릴다운 미출력): ReactFlow v11 은 클릭 계열 핸들러 없이
	// selectable·draggable 이 아니면 wrapper 에 인라인 pointer-events:none 주입 →
	// 더블클릭이 히트테스팅에서 사라짐. GraphView 의 no-op onNodeClick 가드 확인.
	for (const el of nodes) expect(el.style.pointerEvents).not.toBe("none");
});

test("드릴다운: 자식 있는 노드 더블클릭 → 하위 레벨 패널 렌더", async () => {
	const nodeEl = [...container.querySelectorAll(".react-flow__node")].find(
		(el) => el.textContent.includes("M1"),
	);
	expect(nodeEl).toBeDefined();
	await React.act(async () => {
		nodeEl.dispatchEvent(
			new window.MouseEvent("dblclick", { bubbles: true, cancelable: true }),
		);
	});
	// 선택 반영(제목) + 병합 자식 패널(두 번째 graph-card) 렌더.
	expect(container.textContent).toContain("선택: M1");
	expect(container.querySelectorAll(".graph-card").length).toBe(2);
	expect(container.textContent).toContain("C1");
});

test("드릴다운: 재더블클릭 → 선택 해제(패널 제거)", async () => {
	const nodeEl = [...container.querySelectorAll(".react-flow__node")].find(
		(el) => el.textContent.includes("M1"),
	);
	await React.act(async () => {
		nodeEl.dispatchEvent(
			new window.MouseEvent("dblclick", { bubbles: true, cancelable: true }),
		);
	});
	expect(container.querySelectorAll(".graph-card").length).toBe(1);
	expect(container.textContent).not.toContain("선택: M1");
});
