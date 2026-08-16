// DocScrollbar 자체체크 — 커스텀 스크롤바 지오메트리·드래그·트랙 클릭·키보드·마커 통합.
// 실행: bun test apps/plan-viewer
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { afterAll, expect, test } from "bun:test";
import React from "react";
import { createRoot } from "react-dom/client";
import DocScrollbar from "./DocScrollbar.jsx";

const h = React.createElement;
const flush = () => new Promise((r) => setTimeout(r, 0));

/** 레이아웃 없는 happy-dom 용 가짜 스크롤 컨테이너(client 400 / total 2000). */
function fakeDoc() {
	const el = document.createElement("div");
	let st = 0;
	Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });
	Object.defineProperty(el, "scrollHeight", {
		value: 2000,
		configurable: true,
	});
	Object.defineProperty(el, "scrollTop", {
		get: () => st,
		set: (v) => {
			st = Math.max(0, Math.min(2000 - 400, v));
		},
		configurable: true,
	});
	return el;
}

const ptr = (type, target, clientY) =>
	target.dispatchEvent(
		new window.MouseEvent(type, { clientY, bubbles: true, cancelable: true }),
	);

let root;
afterAll(async () => {
	if (root) await React.act(async () => root.unmount());
	GlobalRegistrator.unregister();
});

async function mount(doc, marks = []) {
	const host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
	await React.act(async () => {
		root.render(h(DocScrollbar, { docRef: { current: doc }, marks }));
		await flush();
	});
	return host;
}

test("스크롤 불필요(total<=client)면 렌더 안 함", async () => {
	const doc = fakeDoc();
	Object.defineProperty(doc, "scrollHeight", {
		value: 300,
		configurable: true,
	});
	const host = await mount(doc);
	expect(host.querySelector(".doc-scroll")).toBe(null);
});

test("thumb 지오메트리: 높이 하한·위치 비율, scrollTop 변경 시 동기화", async () => {
	const doc = fakeDoc();
	const host = await mount(doc);
	const thumb = host.querySelector(".doc-scroll-thumb");
	// h = max(400/2000*396(트랙=client-인셋4), 32) = 79.2, top = 0
	expect(thumb.style.height).toBe("79.2px");
	expect(thumb.style.top).toBe("0px");
	// 스크롤 → thumb 위치 갱신: (800/1600)*(396-79.2)=158.4
	doc.scrollTop = 800;
	doc.dispatchEvent(new window.Event("scroll"));
	await React.act(async () => {
		await flush();
	});
	expect(host.querySelector(".doc-scroll-thumb").style.top).toBe("158.4px");
	// aria 반영
	expect(
		host.querySelector("[role=scrollbar]").getAttribute("aria-valuenow"),
	).toBe("50");
});

test("트랙 클릭 → thumb 중심이 클릭 지점으로 점프", async () => {
	const doc = fakeDoc();
	const host = await mount(doc);
	const track = host.querySelector(".doc-scroll");
	// happy-dom rect=0 → y=clientY. y=200: r=(200-39.6)/316.8≈0.506 → ≈810
	ptr("pointerdown", track, 200);
	await React.act(async () => {
		await flush();
	});
	expect(Math.round(doc.scrollTop)).toBe(810);
});

test("thumb 드래그 → 이동량 환산만큼 scrollTop 변경", async () => {
	const doc = fakeDoc();
	const host = await mount(doc);
	const thumb = host.querySelector(".doc-scroll-thumb");
	ptr("pointerdown", thumb, 0);
	// dy=50 → 50/316.8*1600≈253
	ptr("pointermove", window, 50);
	await React.act(async () => {
		await flush();
	});
	expect(Math.round(doc.scrollTop)).toBe(253);
	ptr("pointerup", window, 50);
	// 업 이후 이동 무시
	ptr("pointermove", window, 100);
	await React.act(async () => {
		await flush();
	});
	expect(Math.round(doc.scrollTop)).toBe(253);
});

test("트랙 키보드: ArrowDown/PageDown/Home", async () => {
	const doc = fakeDoc();
	const host = await mount(doc);
	const track = host.querySelector(".doc-scroll");
	const key = (k) =>
		track.dispatchEvent(
			new window.KeyboardEvent("keydown", {
				key: k,
				bubbles: true,
				cancelable: true,
			}),
		);
	await React.act(async () => {
		key("ArrowDown");
		await flush();
	});
	expect(doc.scrollTop).toBe(40);
	await React.act(async () => {
		key("PageDown");
		await flush();
	});
	expect(doc.scrollTop).toBe(440);
	await React.act(async () => {
		key("Home");
		await flush();
	});
	expect(doc.scrollTop).toBe(0);
});

test("ADR-027 마커는 트랙(role=scrollbar) 자식으로 통합 렌더", async () => {
	const doc = fakeDoc();
	const host = await mount(doc, [
		{ id: "m1", top: 10, h: 20, added: true },
		{ id: "m2", top: 40, h: 12, added: false },
	]);
	const track = host.querySelector("[role=scrollbar]");
	const marks = track.querySelectorAll(".doc-rail-mark");
	expect(marks.length).toBe(2);
	expect(marks[0].classList.contains("added")).toBe(true);
	expect(marks[1].classList.contains("added")).toBe(false);
});
