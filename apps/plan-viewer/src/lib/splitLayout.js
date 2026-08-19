// 탭 분할 레이아웃 순수 로직(ADR-032) — 브라우저식 무한 중첩 분할 트리 변환만 담당.
// leaf  = { type:"leaf",  id, tabs:[], activeId }
// split = { type:"split", id, dir:"h"|"v", ratio, children:[a,b] }
// dir "h" = 좌우 배치(children[0]가 왼쪽), "v" = 상하 배치(children[0]가 위).
// 상태·렌더는 PlanPage·SplitNode. viewerTabs.js 와 같은 순수 변환 패턴(ADR-031).

export const DIRECTION = {
	left: { dir: "h", before: true },
	right: { dir: "h", before: false },
	up: { dir: "v", before: true },
	down: { dir: "v", before: false },
};

let seq = 0;
/** 레이아웃 노드 고유 id — 세션 내 유일한 새 id 생성. */
export const nextId = (prefix) => `${prefix}${++seq}`;

/** 초기 레이아웃 — 문서 탭 하나만 든 단일 leaf. */
export const createRootLayout = (tabs, activeId) => ({
	type: "leaf",
	id: nextId("pane"),
	tabs,
	activeId,
});

/** 깊이 우선 탐색으로 leaf 찾기(없으면 null). */
export function findLeaf(node, paneId) {
	if (!node) return null;
	if (node.type === "leaf") return node.id === paneId ? node : null;
	return (
		findLeaf(node.children[0], paneId) ?? findLeaf(node.children[1], paneId)
	);
}

/** 모든 leaf 를 트리 순서대로 수집. */
export function allLeaves(node) {
	if (!node) return [];
	if (node.type === "leaf") return [node];
	return [...allLeaves(node.children[0]), ...allLeaves(node.children[1])];
}

/** 특정 id 탭이 레이아웃 전체에 몇 개인지(문서 탭 마지막 1개 보호 판정용). */
export const countTab = (root, tabId) =>
	allLeaves(root).reduce(
		(n, l) => n + l.tabs.filter((t) => t.id === tabId).length,
		0,
	);

/** 트리 전 노드에 fn 을 1회씩 적용(top-down) — fn 반환 결과는 재순회하지 않음.
 * replacer 가 원본 pane id 를 유지한 새 노드를 만들어도 무한 재귀가 없다. */
const mapNode = (node, fn) => {
	if (!node) return node;
	const mapped = fn(node);
	if (mapped == null) return null;
	return node.type === "split"
		? {
				...mapped,
				children: [
					mapNode(node.children[0], fn),
					mapNode(node.children[1], fn),
				],
			}
		: mapped;
};

/** 빈 leaf 제거 + 자식이 하나 남은 split 은 그 자식으로 축소(트리 collapse). */
export function collapseTree(node) {
	if (!node) return null;
	if (node.type === "leaf") return node.tabs.length ? node : null;
	const kids = node.children.map(collapseTree).filter(Boolean);
	if (kids.length === 0) return null;
	if (kids.length === 1) return kids[0];
	return { ...node, children: kids };
}

/** paneId leaf 를 replacer 로 교체 — 새 분할·탭 이동·닫기의 공통 기반. */
export function replacePane(root, paneId, replacer) {
	return collapseTree(
		mapNode(root, (leaf) => (leaf.id === paneId ? replacer(leaf) : leaf)),
	);
}

/** 분할 — paneId 영역의 dir 방향에 tabs 로 새 leaf 추가.
 * move=true(드래그)면 원본에서 탭을 빼서 옮기고, false(우클릭 메뉴)면 복제. */
export function splitPane(root, paneId, direction, tabs, { move = true } = {}) {
	const d = DIRECTION[direction];
	if (!d || tabs.length === 0) return root;
	return replacePane(root, paneId, (leaf) => {
		const kept = move ? leaf.tabs.filter((t) => !tabs.includes(t)) : leaf.tabs;
		const keptActive = kept.includes(leaf.activeId)
			? leaf.activeId
			: (kept[0]?.id ?? null);
		const src = { ...leaf, tabs: kept, activeId: keptActive };
		const dst = {
			type: "leaf",
			id: nextId("pane"),
			tabs,
			activeId: tabs[0].id,
		};
		return {
			type: "split",
			id: nextId("split"),
			dir: d.dir,
			ratio: 0.5,
			children: d.before ? [dst, src] : [src, dst],
		};
	});
}

/** 탭 이동(드롭 존 중앙) — from→to 로 옮기고 to 의 활성으로. from 이 비면 영역 제거. */
export function moveTab(root, tabId, fromPaneId, toPaneId) {
	if (fromPaneId === toPaneId) return root;
	const from = findLeaf(root, fromPaneId);
	const tab = from?.tabs.find((t) => t.id === tabId);
	if (!tab) return root;
	const removed = replacePane(root, fromPaneId, (leaf) => ({
		...leaf,
		tabs: leaf.tabs.filter((t) => t.id !== tab.id),
		activeId:
			leaf.activeId === tab.id
				? (leaf.tabs.find((t) => t.id !== tab.id)?.id ?? null)
				: leaf.activeId,
	}));
	return replacePane(removed, toPaneId, (leaf) => ({
		...leaf,
		tabs: leaf.tabs.some((t) => t.id === tab.id)
			? leaf.tabs
			: [...leaf.tabs, tab],
		activeId: tab.id,
	}));
}

/** 닫기 후 활성 탭 — viewerTabs.nextActive 와 같은 규칙(우측 우선). */
function nextActiveIn(tabs, closedId, activeId) {
	if (activeId !== closedId) return activeId;
	const i = tabs.findIndex((t) => t.id === closedId);
	const rest = tabs.filter((t) => t.id !== closedId);
	return rest[Math.min(i, rest.length - 1)]?.id ?? null;
}

/** 탭 닫기 — pinned 탭은 레이아웃 전체의 마지막 1개일 때만 닫기 불가.
 * 마지막 탭이 닫힌 leaf 는 제거되고 트리가 축소된다. */
export function closeTabIn(root, paneId, tabId) {
	const leaf = findLeaf(root, paneId);
	const tab = leaf?.tabs.find((t) => t.id === tabId);
	if (!tab) return root;
	if (tab.pinned && countTab(root, tabId) <= 1) return root;
	const removed = replacePane(root, paneId, (l) => ({
		...l,
		tabs: l.tabs.filter((t) => t.id !== tabId),
		activeId: nextActiveIn(l.tabs, tabId, l.activeId),
	}));
	// 같은 탭(문서 탭 복제 등)이 다른 leaf 의 활성이면 그곳도 활성 해제.
	return mapNode(removed, (l) =>
		l.type === "leaf" &&
		l.activeId === tabId &&
		!l.tabs.some((t) => t.id === tabId)
			? { ...l, activeId: l.tabs[0]?.id ?? null }
			: l,
	);
}

/** leaf 의 활성 탭 변경. */
export function setActive(root, paneId, tabId) {
	return mapNode(root, (l) =>
		l.id === paneId ? { ...l, activeId: tabId } : l,
	);
}

/** 문서 탭 동기화(다중 문서) — leaf 마다: 사라진 문서 탭 제거, 새 문서 탭은
 * 첫 leaf 에 추가(그래프 탭·사용자 배치 유지). 비게 된 leaf 는 트리에서 축소.
 * 문서 탭 = graphFile 이 없는 탭(주 문서 "doc" + 위성 `doc:<파일명>`). */
export function syncDocTabs(root, docTabList) {
	const byId = new Map(docTabList.map((t) => [t.id, t]));
	const present = new Set(
		allLeaves(root).flatMap((l) => l.tabs.map((t) => t.id)),
	);
	const missing = docTabList.filter((t) => !present.has(t.id));
	let anchored = false;
	const mapped = mapNode(root, (leaf) => {
		if (leaf.type !== "leaf") return leaf;
		// 문서 탭은 새 목록 버전으로 교체(라벨 갱신), 그래프 탭·사용자 배치 유지.
		const kept = leaf.tabs
			.filter((t) => t.graphFile || byId.has(t.id))
			.map((t) => (t.graphFile ? t : byId.get(t.id)));
		let tabs = kept;
		if (!anchored) {
			anchored = true;
			// 새 문서 탭은 기존 문서 탭 바로 뒤에 삽입(문서 탭끼리 군집 유지).
			const at = kept.reduce((acc, t, i) => (t.graphFile ? acc : i + 1), 0);
			tabs = [...kept.slice(0, at), ...missing, ...kept.slice(at)];
		}
		const activeId = tabs.some((t) => t.id === leaf.activeId)
			? leaf.activeId
			: (tabs[0]?.id ?? null);
		return { ...leaf, tabs, activeId };
	});
	return collapseTree(mapped);
}

/** 분할 경계 비율 변경(0.15~0.85 클램프). */
export function setRatio(root, splitId, ratio) {
	const r = Math.min(0.85, Math.max(0.15, ratio));
	return mapNode(root, (n) => (n.id === splitId ? { ...n, ratio: r } : n));
}
