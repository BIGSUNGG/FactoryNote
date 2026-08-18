// 그래프 블록 더블클릭 → 상세 탭 열기 배선 자체체크(ADR-031):
// 캔버스·헤더 더블클릭이 onOpenGraph(그래프 파일명) 호출 — Block.jsx 배선 검증.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import Block from "./Block.jsx";

const h = React.createElement;

const seqData = {
	version: 2,
	type: "sequence",
	title: "로그인",
	participants: [
		{ id: "ui", name: "UI" },
		{ id: "auth", name: "Auth" },
	],
	body: [{ from: "ui", to: "auth", label: "요청" }],
};

const block = { id: "b1", type: "graph", graphFile: "a.json" };
const graphData = { "a.json": { type: "sequence", data: seqData } };

let container;
let root;
let opened = [];

async function render() {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await React.act(async () => {
		root.render(
			h(Block, {
				block,
				comments: [],
				onAddComment() {},
				onActivate() {},
				activeTargetId: null,
				graphData,
				onOpenGraph: (f) => opened.push(f),
			}),
		);
	});
}

afterAll(async () => {
	if (root) await React.act(async () => root.unmount());
	container?.remove();
	GlobalRegistrator.unregister();
});

test("그래프 캔버스·헤더 더블클릭 → onOpenGraph(그래프 파일명)", async () => {
	opened = [];
	await render();
	container
		.querySelector(".block-graph-canvas")
		.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
	expect(opened).toEqual(["a.json"]);
	container
		.querySelector(".block-graph-head")
		.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
	expect(opened).toEqual(["a.json", "a.json"]);
});
