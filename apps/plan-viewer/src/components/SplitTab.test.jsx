// 탭 분할 상호작용 렌더 자체체크(ADR-032): 드래그 → 드롭 존(5방향) 표시,
// 가장자리 드롭 = 분할·탭 이동, 중앙 드롭 = 병합, 우클릭 메뉴 = 복제 분할,
// 마지막 탭 닫기 = 영역 제거. PlanPage + SplitNode 배선을 happy-dom 으로 검증.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import PlanPage from "./PlanPage.jsx";

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

const props = {
	mdSource: "# 제목\n\n<!-- graph: a.json -->\n",
	stage: 1,
	activeStage: 1,
	onGate() {},
	onReview() {},
	graphData: { "a.json": { type: "sequence", data: seqData } },
};

let container;
let root;

async function renderPage() {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await React.act(async () => {
		root.render(h(PlanPage, props));
	});
}
async function cleanup(unregister = false) {
	if (root) await React.act(async () => root.unmount());
	container?.remove();
	root = null;
	container = null;
	if (unregister) GlobalRegistrator.unregister();
}
afterAll(() => cleanup(true));

const fire = async (el, type, Ctor = Event, init = {}) => {
	await React.act(async () => {
		el.dispatchEvent(
			new Ctor(type, { bubbles: true, cancelable: true, ...init }),
		);
	});
};

/** 그래프 탭 열기(블록 더블클릭) → [문서, a.json] */
async function openGraphTab() {
	await fire(
		container.querySelector(".block-graph-canvas"),
		"dblclick",
		MouseEvent,
	);
	expect(container.querySelectorAll(".viewer-tab").length).toBe(2);
}

const graphTabEl = () =>
	[...container.querySelectorAll(".viewer-tab")].find((el) =>
		el.textContent.includes("a.json"),
	);
const panes = () => [...container.querySelectorAll(".split-leaf")];
const paneLabels = (pane) =>
	[...pane.querySelectorAll(".viewer-tab-label")].map((el) => el.textContent);

test("탭 드래그 → 5방향 드롭 존 표시 → 오른쪽 드롭 = 분할·탭 이동", async () => {
	await renderPage();
	await openGraphTab();
	await fire(graphTabEl(), "dragstart");
	const zones = container.querySelectorAll(".split-zone");
	expect(zones.length).toBe(5);
	expect([...zones].map((z) => z.dataset.zone).sort()).toEqual([
		"center",
		"down",
		"left",
		"right",
		"up",
	]);
	await fire(container.querySelector('[data-zone="right"]'), "dragover");
	expect(
		container.querySelector('[data-zone="right"]').classList.contains("hover"),
	).toBe(true);
	await fire(container.querySelector('[data-zone="right"]'), "drop");
	expect(panes().length).toBe(2);
	const labels = panes().map(paneLabels);
	// 원본 영역은 문서 탭, 새(오른쪽) 영역은 그래프 탭 — 드래그는 이동.
	expect(labels.flat().sort()).toEqual(["a.json", "문서"]);
	expect(labels.some((l) => l.length === 1 && l[0] === "문서")).toBe(true);
	expect(container.querySelectorAll(".split-zone").length).toBe(0);
	await cleanup();
});

test("중앙 드롭 = 대상 영역으로 탭 이동(병합)", async () => {
	await renderPage();
	await openGraphTab();
	// 사전: 오른쪽 분할로 그래프 탭을 별도 영역으로
	await fire(graphTabEl(), "dragstart");
	await fire(container.querySelector('[data-zone="right"]'), "drop");
	expect(panes().length).toBe(2);
	// 그래프 탭을 다시 문서 영역 중앙으로 드롭 → 단일 영역·탭 2개
	const graphPane = panes().find((p) => paneLabels(p).includes("a.json"));
	const docPane = panes().find((p) => paneLabels(p).includes("문서"));
	await fire(graphPane.querySelector(".viewer-tab"), "dragstart");
	await fire(docPane.querySelector('[data-zone="center"]'), "drop");
	expect(panes().length).toBe(1);
	expect(paneLabels(panes()[0]).sort()).toEqual(["a.json", "문서"]);
	await cleanup();
});

test("탭 우클릭 → 분할 메뉴 4항목 → 클릭 시 탭 복제 분할(원본 유지)", async () => {
	await renderPage();
	const docTab = container.querySelector(".viewer-tab");
	await fire(docTab, "contextmenu", MouseEvent, { clientX: 10, clientY: 20 });
	const menu = document.querySelector(".split-menu");
	expect(menu).not.toBeNull();
	const items = [...menu.querySelectorAll("button")].map((b) => b.textContent);
	expect(items).toEqual([
		"왼쪽으로 분할",
		"오른쪽으로 분할",
		"위로 분할",
		"아래로 분할",
	]);
	await fire(menu.querySelectorAll("button")[1], "click", MouseEvent);
	expect(document.querySelector(".split-menu")).toBeNull();
	expect(panes().length).toBe(2);
	// 복제 — 두 영역 모두 문서 탭 보유
	for (const p of panes()) expect(paneLabels(p)).toContain("문서");
	await cleanup();
});

test("영역의 마지막 탭 닫기 → 영역 제거(트리 축소)", async () => {
	await renderPage();
	await openGraphTab();
	await fire(graphTabEl(), "dragstart");
	await fire(container.querySelector('[data-zone="right"]'), "drop");
	expect(panes().length).toBe(2);
	const graphPane = panes().find((p) => paneLabels(p).includes("a.json"));
	await fire(graphPane.querySelector(".viewer-tab-close"), "click", MouseEvent);
	expect(panes().length).toBe(1);
	expect(paneLabels(panes()[0])).toEqual(["문서"]);
	await cleanup();
});
