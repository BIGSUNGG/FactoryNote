// TabBar 렌더 자체체크(ADR-031): 고정 탭은 닫기(X) 버튼 없음, 그래프 탭만 X 렌더,
// X 클릭 → onClose(탭 선택으로 버블 안 됨), 탭 클릭 → onSelect. happy-dom DOM 이벤트 검증.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import TabBar from "./TabBar.jsx";
import { DOC_TAB } from "../lib/viewerTabs.js";

const h = React.createElement;
const tabs = [
	DOC_TAB,
	{ id: "graph:a.json", label: "a.json", graphFile: "a.json" },
];

let container;
let root;

async function render(props) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await React.act(async () => {
		root.render(h(TabBar, props));
	});
}

afterAll(async () => {
	if (root) await React.act(async () => root.unmount());
	container?.remove();
	GlobalRegistrator.unregister();
});

test("고정 md 탭에는 닫기(X) 버튼이 렌더되지 않음", async () => {
	await render({ tabs, activeId: "doc", onSelect() {}, onClose() {} });
	const tabEls = container.querySelectorAll(".viewer-tab");
	expect(tabEls.length).toBe(2);
	expect(tabEls[0].classList.contains("pinned")).toBe(true);
	expect(tabEls[0].querySelector(".viewer-tab-close")).toBeNull();
	expect(tabEls[1].querySelector(".viewer-tab-close")).not.toBeNull();
	// 활성 탭 표시
	expect(tabEls[0].getAttribute("aria-selected")).toBe("true");
	expect(tabEls[1].getAttribute("aria-selected")).toBe("false");
});

test("X 클릭 → onClose(id)만 발생(탭 선택 버블 없음) · 탭 클릭 → onSelect(id)", async () => {
	let selected = null;
	let closed = null;
	await render({
		tabs,
		activeId: "doc",
		onSelect: (id) => (selected = id),
		onClose: (id) => (closed = id),
	});
	const graphTab = container.querySelectorAll(".viewer-tab")[1];
	graphTab
		.querySelector(".viewer-tab-close")
		.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	expect(closed).toBe("graph:a.json");
	expect(selected).toBeNull(); // stopPropagation — 탭 선택 미발생
	graphTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	expect(selected).toBe("graph:a.json");
});
