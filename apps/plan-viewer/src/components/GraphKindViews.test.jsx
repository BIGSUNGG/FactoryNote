// SequenceView·FlowchartView 렌더 테스트(ADR-021): 읽기 전용 SVG 가 데이터 요소를
// 빠짐없이 그리는지 happy-dom 실제 DOM 으로 검증. 조작 핸들러 없음(읽기 전용) 단언 포함.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import SequenceView from "./SequenceView.jsx";
import FlowchartView from "./FlowchartView.jsx";

const h = React.createElement;

const seqData = {
	version: 2,
	type: "sequence",
	title: "로그인",
	participants: [
		{ id: "ui", name: "UI" },
		{ id: "auth", name: "Auth" },
	],
	body: [
		{ from: "ui", to: "auth", label: "요청" },
		{
			kind: "loop",
			label: "재시도",
			body: [{ from: "auth", to: "ui", label: "응답", kind: "reply" }],
		},
	],
};

const flowData = {
	version: 2,
	type: "flowchart",
	title: "배포",
	nodes: [
		{ id: "start", label: "시작", shape: "terminal" },
		{ id: "build", label: "빌드" },
		{ id: "check", label: "검사", shape: "decision" },
	],
	edges: [
		{ from: "start", to: "build" },
		{ from: "build", to: "check", label: "완료" },
	],
};

let container;
let root;

async function renderInto(el) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await React.act(async () => {
		root.render(el);
	});
}

test("SequenceView: 참여자·메시지·fragment 렌더", async () => {
	await renderInto(h(SequenceView, { data: seqData }));

	const svg = container.querySelector("svg.seq-view");
	expect(svg).toBeTruthy();
	// 참여자 박스 2 + 라이프라인 2.
	expect(container.querySelectorAll(".seq-participant rect").length).toBe(2);
	expect(container.querySelectorAll("line.seq-lifeline").length).toBe(2);
	// 메시지 2(요청 + 응답) — 응답은 reply 클래스.
	const msgs = container.querySelectorAll("line.seq-message");
	expect(msgs.length).toBe(2);
	expect(container.querySelectorAll("line.seq-message.reply").length).toBe(1);
	// fragment(loop) 박스 1 + 라벨 텍스트.
	expect(container.querySelectorAll(".seq-fragment rect").length).toBe(1);
	expect(container.querySelector(".seq-fragment-label").textContent).toContain(
		"loop",
	);
	// 메시지 라벨 렌더.
	const labels = [...container.querySelectorAll(".seq-message-label")].map(
		(t) => t.textContent,
	);
	expect(labels).toContain("요청");
	await React.act(async () => root.unmount());
	container.remove();
});

test("FlowchartView: 노드·shape·엣지·라벨 렌더", async () => {
	await renderInto(h(FlowchartView, { data: flowData }));

	const svg = container.querySelector("svg.flow-view");
	expect(svg).toBeTruthy();
	// 노드 3: terminal(rounded rect) + process(rect) + decision(polygon).
	expect(container.querySelectorAll(".flow-node").length).toBe(3);
	expect(container.querySelectorAll("rect.flow-node-shape").length).toBe(2);
	expect(
		container.querySelectorAll("polygon.flow-node-shape.decision").length,
	).toBe(1);
	// 엣지 2 + 엣지 라벨 1.
	expect(container.querySelectorAll(".flow-edge line").length).toBe(2);
	expect(container.querySelectorAll(".flow-edge-label").length).toBe(1);
	// 노드 라벨 렌더.
	const labels = [...container.querySelectorAll(".flow-node text")].map(
		(t) => t.textContent,
	);
	expect(labels).toEqual(["시작", "빌드", "검사"]);
});

test("읽기 전용: 두 뷰 모두 클릭·드래그 조작 핸들러 없음", () => {
	for (const el of container.querySelectorAll(
		"svg.seq-view *, svg.flow-view *, svg.seq-view, svg.flow-view",
	)) {
		// React 합성 이벤트 props 는 DOM 속성으로 붙지 않으나, 인라인 onclick 등이
		// 없음을 확인해 조작 경로 부재를 가드한다.
		expect(el.getAttribute("onclick")).toBeNull();
		expect(el.getAttribute("onmousedown")).toBeNull();
		expect(el.getAttribute("ondblclick")).toBeNull();
	}
});

afterAll(async () => {
	if (root) await React.act(async () => root.unmount());
	container?.remove();
	GlobalRegistrator.unregister();
});
