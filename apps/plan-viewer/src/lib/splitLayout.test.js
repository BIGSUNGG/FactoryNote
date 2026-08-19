// splitLayout 자체체크(ADR-032): 분할 트리 변환 — 4방향 분할, 이동(중앙 드롭),
// 복제 분할(우클릭 메뉴), 빈 영역 collapse, pinned 문서 탭 마지막 1개 보호, 비율 클램프.
import { expect, test } from "bun:test";
import {
	createRootLayout,
	splitPane,
	moveTab,
	closeTabIn,
	setRatio,
	setActive,
	findLeaf,
	allLeaves,
	countTab,
	syncDocTabs,
} from "./splitLayout.js";
import { DOC_TAB } from "./viewerTabs.js";

const G = (f) => ({ id: `graph:${f}`, label: f, graphFile: f });
const root = () => createRootLayout([DOC_TAB, G("a")], "doc");
const leafIds = (node) => allLeaves(node).map((l) => l.id);

test("4방향 분할 — left/up 은 새 영역이 children[0], right/down 은 children[1]", () => {
	for (const [direction, idx] of [
		["left", 0],
		["right", 1],
		["up", 0],
		["down", 1],
	]) {
		const base = root();
		const r = splitPane(base, base.id, direction, [base.tabs[1]]);
		// id 는 시퀀스 생성이므로 구조로 검증: root 가 split 이 되고 새 leaf 가 해당 방향에.
		expect(r.type).toBe("split");
		expect(r.dir).toBe(
			direction === "left" || direction === "right" ? "h" : "v",
		);
		expect(r.children[idx].tabs.map((t) => t.id)).toEqual(["graph:a"]);
		expect(r.children[1 - idx].tabs.map((t) => t.id)).toEqual(["doc"]);
	}
});

test("드래그 분할(move)은 원본에서 탭을 빼서 옮김 — 원본이 비면 트리가 새 leaf 하나로 축소", () => {
	const base = root();
	const doc = base.tabs[0];
	const r = splitPane(base, base.id, "right", [doc, base.tabs[1]], {
		move: true,
	});
	// 유일한 leaf 의 두 탭을 모두 옮김 → 원본 empty → collapse 로 단일 leaf.
	expect(r.type).toBe("leaf");
	expect(r.tabs.map((t) => t.id)).toEqual(["doc", "graph:a"]);
});

test("우클릭 메뉴 분할(move=false)은 탭을 복제 — 원본에 그대로 남음", () => {
	const base = root();
	const r = splitPane(base, base.id, "down", [base.tabs[1]], { move: false });
	expect(allLeaves(r).map((l) => l.tabs.map((t) => t.id))).toEqual([
		["doc", "graph:a"],
		["graph:a"],
	]);
	expect(countTab(r, "graph:a")).toBe(2);
});

test("중앙 드롭(moveTab) — 탭이 from→to 이동, to 활성으로, from 이 비면 영역 제거", () => {
	const base = root();
	const s1 = splitPane(base, base.id, "right", [G("b")], { move: false }); // pane1[doc,a] + pane2[b]
	const [left, right] = allLeaves(s1);
	const moved = moveTab(s1, "graph:a", left.id, right.id);
	const leaves = allLeaves(moved);
	expect(leaves.length).toBe(2);
	expect(findLeaf(moved, left.id).tabs.map((t) => t.id)).toEqual(["doc"]);
	expect(findLeaf(moved, right.id).tabs.map((t) => t.id)).toEqual([
		"graph:b",
		"graph:a",
	]);
	expect(findLeaf(moved, right.id).activeId).toBe("graph:a");
	// from 의 마지막 탭을 옮기면 from 영역 제거(collapse)
	const b2 = root();
	const s2 = splitPane(b2, b2.id, "right", [G("c")], { move: false });
	const [l2] = allLeaves(s2);
	const s3 = splitPane(s2, l2.id, "down", [l2.tabs[0]], { move: true }); // doc 아래로
	const docLeaf = allLeaves(s3).find((l) => l.tabs.some((t) => t.id === "doc"));
	const graphLeaf = allLeaves(s3).find((l) =>
		l.tabs.some((t) => t.id === "graph:c"),
	);
	const collapsed = moveTab(s3, "graph:c", graphLeaf.id, docLeaf.id);
	expect(leafIds(collapsed).length).toBe(allLeaves(s3).length - 1);
	expect(findLeaf(collapsed, docLeaf.id).tabs.map((t) => t.id)).toEqual([
		"doc",
		"graph:c",
	]);
});

test("닫기 — 마지막 탭 닫힌 영역 제거·트리 축소, pinned 문서 탭은 마지막 1개만 닫기 불가", () => {
	const base = root();
	const s = splitPane(base, base.id, "right", [base.tabs[1]], { move: true });
	expect(allLeaves(s).length).toBe(2);
	const [, graphPane] = allLeaves(s);
	// 그래프 탭 닫기 → graphPane empty → collapse → 단일 leaf(doc)
	const closed = closeTabIn(s, graphPane.id, "graph:a");
	expect(closed.type).toBe("leaf");
	expect(closed.tabs.map((t) => t.id)).toEqual(["doc"]);
	// 문서 탭: 유일한 1개 → 닫기 불가
	expect(closeTabIn(closed, closed.id, "doc")).toBe(closed);
	// 문서 탭 복제 후 하나는 닫기 가능
	const dup = splitPane(closed, closed.id, "down", [closed.tabs[0]], {
		move: false,
	});
	const [p1, p2] = allLeaves(dup);
	const after = closeTabIn(dup, p2.id, "doc");
	expect(allLeaves(after).length).toBe(1);
	expect(findLeaf(after, p1.id).tabs.map((t) => t.id)).toEqual(["doc"]);
});

test("setActive · setRatio(0.15~0.85 클램프)", () => {
	const base = root();
	const s = splitPane(base, base.id, "right", [base.tabs[1]], { move: false });
	const [, p2] = allLeaves(s);
	const act = setActive(s, p2.id, "doc");
	expect(findLeaf(act, p2.id).activeId).toBe("doc");
	expect(s.ratio).toBe(0.5);
	expect(setRatio(s, s.id, 0.9).ratio).toBe(0.85);
	expect(setRatio(s, s.id, 0.05).ratio).toBe(0.15);
	expect(setRatio(s, s.id, 0.7).ratio).toBe(0.7);
});

test("중첩 분할 — 분할된 영역을 다시 분할(무한 중첩)", () => {
	const base = root();
	let r = splitPane(base, base.id, "right", [G("b")], { move: false });
	const [, right] = allLeaves(r);
	r = splitPane(r, right.id, "down", [G("c")], { move: false });
	expect(r.type).toBe("split");
	expect(r.children[1].type).toBe("split");
	expect(r.children[1].dir).toBe("v");
	expect(allLeaves(r).length).toBe(3);
});

// ——— syncDocTabs(다중 문서 탭 동기화) ———
const S = (f) => ({ id: `doc:${f}`, label: f, docFile: f, pinned: true });

test("syncDocTabs — 새 문서 탭은 첫 leaf 의 문서 탭 뒤에 추가, 그래프 탭·둘째 leaf 유지", () => {
	let l = root(); // leaf1: [doc, graph:a]
	l = splitPane(l, l.id, "right", [G("b")], { move: false }); // leaf2: [graph:b]
	const synced = syncDocTabs(l, [DOC_TAB, S("draft.a.md")]);
	const [first, second] = allLeaves(synced);
	expect(first.tabs.map((t) => t.id)).toEqual([
		"doc",
		"doc:draft.a.md",
		"graph:a",
	]);
	expect(second.tabs.map((t) => t.id)).toEqual(["graph:b"]);
});

test("syncDocTabs — 사라진 문서 탭 제거·새 탭 교체, 활성 탭 제거 시 폴백", () => {
	let l = root();
	l = syncDocTabs(l, [DOC_TAB, S("draft.a.md")]);
	l = setActive(l, l.id, "doc:draft.a.md");
	const synced = syncDocTabs(l, [DOC_TAB, S("draft.b.md")]);
	const leaf = allLeaves(synced)[0];
	expect(leaf.tabs.map((t) => t.id)).toEqual([
		"doc",
		"doc:draft.b.md",
		"graph:a",
	]);
	// 활성이던 draft.a.md 제거됨 → 활성 폴백(첫 탭)
	expect(leaf.activeId).toBe("doc");
});

test("syncDocTabs — 문서 탭만 있던 leaf 가 비면 트리에서 축소", () => {
	let l = createRootLayout([DOC_TAB], "doc");
	l = splitPane(l, l.id, "right", [S("draft.a.md")], { move: false });
	expect(allLeaves(l).length).toBe(2);
	const synced = syncDocTabs(l, [DOC_TAB]); // draft.a.md 사라짐
	expect(synced.type).toBe("leaf");
	expect(synced.tabs.map((t) => t.id)).toEqual(["doc"]);
});

test("syncDocTabs — 사용자가 복제·이동한 문서 탭은 그대로 유지(중복 보존)", () => {
	let l = root();
	l = syncDocTabs(l, [DOC_TAB, S("draft.a.md")]);
	// 위성 탭을 우클릭 분할로 복제
	const sat = l.tabs.find((t) => t.id === "doc:draft.a.md");
	l = splitPane(l, l.id, "down", [sat], { move: false });
	expect(countTab(l, "doc:draft.a.md")).toBe(2);
	const synced = syncDocTabs(l, [DOC_TAB, S("draft.a.md")]);
	expect(countTab(synced, "doc:draft.a.md")).toBe(2);
});
