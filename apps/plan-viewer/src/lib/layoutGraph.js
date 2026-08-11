// 그래프 자동 배치 — 결정적(deterministic), 수동 위치 없음(ADR-016).
// 그래프 JSON 은 토폴로지(노드·관계)만 담고, 좌표는 여기서만 계산한다.
//  - 모듈 관계도: layer(API→Service→Repository→Util→External) 행 + 관계 방향(위상 깊이),
//    행 내 순서는 인접 행 barycenter 로 정돈.
//  - 클래스 구조도: 클래스는 소속 모듈 그룹 안 그리드, 그룹 크기 = 자식 + 패딩,
//    그룹 간 관계 축약 위상 순서로 그룹 배치.
// 모든 배치는 축적 좌표 + 간격 보장 → 노드·그룹 겹침 0, 클래스는 항상 그룹 경계 내부.

export const LAYER_ORDER = ["API", "Service", "Repository", "Util", "External"];

export const MODULE_W = 180;
export const MODULE_H = 64;
export const CLASS_W = 200;
export const GAP_X = 48; // 같은 행 노드 사이 간격
export const GAP_Y = 56; // 행(그룹 행) 사이 간격
export const GROUP_PAD = 20; // 그룹 내부 패딩
export const GROUP_HEAD = 30; // 그룹 라벨 영역 높이

/** 클래스 노드 높이 — 이름/모듈 헤더 + attrs/methods行数 비례. */
export function classNodeHeight(data) {
	const rows = (data?.attrs?.length ?? 0) + (data?.methods?.length ?? 0);
	return 44 + rows * 18 + 10;
}

/** 섹션이 클래스 구조도인지(모듈 그룹/클래스 노드 하나라도 포함). 빈 섹션 = 모듈 관계도. */
export function sectionIsClass(section) {
	return (section?.nodes ?? []).some((n) => {
		const t = n?.type ?? n?.data?.type;
		return t === "group" || t === "class" || t === "modGroup" || t === "cls";
	});
}

// --- 공통: 위상 깊이(Kahn 최장 경로). 사이클 잔여는 maxDepth+1 로 확정 배치. ---
function topoDepths(ids, pairs) {
	const indeg = new Map(ids.map((id) => [id, 0]));
	const adj = new Map(ids.map((id) => [id, []]));
	for (const [s, t] of pairs) {
		if (indeg.has(s) && indeg.has(t) && s !== t) {
			adj.get(s).push(t);
			indeg.set(t, indeg.get(t) + 1);
		}
	}
	const depth = new Map(ids.map((id) => [id, 0]));
	const queue = ids.filter((id) => indeg.get(id) === 0);
	const seen = new Set();
	while (queue.length) {
		const id = queue.shift();
		seen.add(id);
		for (const t of adj.get(id)) {
			depth.set(t, Math.max(depth.get(t), depth.get(id) + 1));
			indeg.set(t, indeg.get(t) - 1);
			if (indeg.get(t) === 0) queue.push(t);
		}
	}
	let maxD = 0;
	for (const d of depth.values()) maxD = Math.max(maxD, d);
	for (const id of ids) if (!seen.has(id)) depth.set(id, maxD + 1);
	return depth;
}

/** 행 배열 → 행 내 순서 정돈(인접 행 barycenter, 아래→위 1회 왕복). 입력 순서 안정. */
function refineRows(rows, pairs) {
	const rowOf = new Map();
	const colOf = new Map();
	const index = () => {
		rows.forEach((ids, r) =>
			ids.forEach((id, c) => {
				rowOf.set(id, r);
				colOf.set(id, c);
			}),
		);
	};
	index();
	const bary = (id, dirRows) => {
		const ns = [];
		for (const [s, t] of pairs) {
			if (dirRows === "up" && t === id && rowOf.has(s)) ns.push(colOf.get(s));
			if (dirRows === "down" && s === id && rowOf.has(t)) ns.push(colOf.get(t));
		}
		if (ns.length === 0) return null;
		return ns.reduce((a, b) => a + b, 0) / ns.length;
	};
	for (const dir of ["up", "down"]) {
		for (let r = 0; r < rows.length; r++) {
			const rr = dir === "up" ? r : rows.length - 1 - r;
			const ids = rows[rr];
			const keyed = ids.map((id, c) => ({ id, key: bary(id, dir) ?? c }));
			keyed.sort(
				(a, b) => a.key - b.key || ids.indexOf(a.id) - ids.indexOf(b.id),
			);
			rows[rr] = keyed.map((k) => k.id);
			index();
		}
	}
	return rows;
}

/** 행 목록(아이디+크기) → 좌표. 행은 가운데 정렬, y 는 축적. position 맵 반환. */
function placeRows(rows, sizeOf) {
	const pos = new Map();
	let y = 0;
	for (const ids of rows) {
		if (ids.length === 0) continue;
		const widths = ids.map((id) => sizeOf(id).w);
		const total = widths.reduce((a, b) => a + b, 0) + GAP_X * (ids.length - 1);
		let x = -total / 2;
		const h = Math.max(...ids.map((id) => sizeOf(id).h));
		for (const id of ids) {
			pos.set(id, { x, y });
			x += sizeOf(id).w + GAP_X;
		}
		y += h + GAP_Y;
	}
	return pos;
}

const pairsOf = (nodes, edges) => {
	const ids = new Set(nodes.map((n) => n.id));
	return (edges ?? [])
		.map((e) => [e.source, e.target])
		.filter(([s, t]) => ids.has(s) && ids.has(t));
};

/** 모듈 관계도 배치 — layer 행(전원 layer 보유 시) 또는 위상 깊이 행. */
export function layoutModuleSection(section) {
	const nodes = section?.nodes ?? [];
	const edges = section?.edges ?? [];
	if (nodes.length === 0)
		return { nodes: [], edges: rfEdges(edges, new Map()) };

	const sizeOf = () => ({ w: MODULE_W, h: MODULE_H });
	const allLayered = nodes.every((n) =>
		LAYER_ORDER.includes(n?.data?.layer ?? n?.layer),
	);
	const pairs = pairsOf(nodes, edges);

	let rows;
	if (allLayered) {
		rows = LAYER_ORDER.map(() => []);
		for (const n of nodes) {
			const r = LAYER_ORDER.indexOf(n?.data?.layer ?? n?.layer);
			rows[r].push(n.id);
		}
	} else {
		const depth = topoDepths(
			nodes.map((n) => n.id),
			pairs,
		);
		const maxD = Math.max(...depth.values());
		rows = Array.from({ length: maxD + 1 }, () => []);
		for (const n of nodes) rows[depth.get(n.id)].push(n.id);
	}
	rows = refineRows(rows, pairs);
	const pos = placeRows(
		rows.filter((r) => r.length > 0),
		sizeOf,
	);

	return {
		nodes: nodes.map((n) => ({
			id: n.id,
			type: (n?.data?.layer ?? n?.layer) === "External" ? "external" : "module",
			position: pos.get(n.id),
			data: { ...(n.data ?? n), id: n.id },
		})),
		edges: rfEdges(edges, pos),
	};
}

/** 클래스 구조도 배치 — 그룹 내 클래스 그리드 + 그룹 위상 그리드. */
export function layoutClassSection(section) {
	const rawNodes = section?.nodes ?? [];
	const edges = section?.edges ?? [];
	const groups = rawNodes.filter((n) => {
		const t = n?.type ?? n?.data?.type;
		return t === "group" || t === "modGroup";
	});
	const classes = rawNodes.filter((n) => {
		const t = n?.type ?? n?.data?.type;
		return t === "class" || t === "cls";
	});
	const groupIds = new Set(groups.map((g) => g.id));

	// 1) 그룹 내부: 클래스 그리드 배치(상대 좌표) + 그룹 크기 결정.
	const groupGeom = new Map(); // gid -> { w, h, positions: Map<clsId, {x,y}> }
	for (const g of groups) {
		const kids = classes.filter((c) => {
			const p = c.parentNode ?? c.data?.parentNode;
			return p === g.id;
		});
		const positions = new Map();
		if (kids.length === 0) {
			groupGeom.set(g.id, {
				w: CLASS_W + GROUP_PAD * 2,
				h: GROUP_HEAD + GROUP_PAD * 2,
				positions,
			});
			continue;
		}
		const cols = Math.max(1, Math.ceil(Math.sqrt(kids.length)));
		const cellW = CLASS_W + GAP_X;
		let y = GROUP_HEAD + GROUP_PAD / 2;
		let maxRowW = 0;
		for (let i = 0; i < kids.length; i += cols) {
			const row = kids.slice(i, i + cols);
			const rowH = Math.max(...row.map((c) => classNodeHeight(c.data ?? c)));
			row.forEach((c, j) =>
				positions.set(c.id, { x: GROUP_PAD + j * cellW, y }),
			);
			maxRowW = Math.max(maxRowW, row.length * cellW - GAP_X);
			y += rowH + GAP_Y;
		}
		groupGeom.set(g.id, {
			w: maxRowW + GROUP_PAD * 2,
			h: y - GAP_Y + GROUP_PAD,
			positions,
		});
	}

	// 2) 고아 클래스(부모 그룹 없음) — 그룹 행 아래 독립 행으로 배치.
	const orphans = classes.filter((c) => {
		const p = c.parentNode ?? c.data?.parentNode;
		return !p || !groupIds.has(p);
	});

	// 3) 그룹 배치: 클래스 간 관계를 그룹으로 축약 → 위상 순서 → 그리드.
	const classGroup = new Map();
	for (const g of groups)
		for (const c of classes) {
			const p = c.parentNode ?? c.data?.parentNode;
			if (p === g.id) classGroup.set(c.id, g.id);
		}
	const pairs = pairsOf(rawNodes, edges);
	const groupPairs = [];
	for (const [s, t] of pairs) {
		const gs = classGroup.get(s);
		const gt = classGroup.get(t);
		if (gs && gt && gs !== gt) groupPairs.push([gs, gt]);
	}
	const depth = topoDepths(
		groups.map((g) => g.id),
		groupPairs,
	);
	const ordered = [...groups].sort(
		(a, b) => depth.get(a.id) - depth.get(b.id) || 0,
	);

	const gcols = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
	const groupPos = new Map();
	let gy = 0;
	for (let i = 0; i < ordered.length; i += gcols) {
		const row = ordered.slice(i, i + gcols);
		let gx = 0;
		const rowH = Math.max(...row.map((g) => groupGeom.get(g.id).h));
		for (const g of row) {
			groupPos.set(g.id, { x: gx, y: gy });
			gx += groupGeom.get(g.id).w + GAP_X;
		}
		gy += rowH + GAP_Y;
	}

	// 4) 조립 — 부모(그룹)가 자식(클래스)보다 먼저 와야 react-flow 가 인식한다.
	const rfNodes = [];
	for (const g of groups) {
		const geom = groupGeom.get(g.id);
		rfNodes.push({
			id: g.id,
			type: "modGroup",
			position: groupPos.get(g.id),
			style: { width: geom.w, height: geom.h },
			selectable: false,
			data: { ...(g.data ?? g), id: g.id },
		});
	}
	const orphanPos = new Map();
	if (orphans.length > 0) {
		const cols = Math.max(1, Math.ceil(Math.sqrt(orphans.length)));
		let y = gy;
		for (let i = 0; i < orphans.length; i += cols) {
			const row = orphans.slice(i, i + cols);
			const rowH = Math.max(...row.map((c) => classNodeHeight(c.data ?? c)));
			row.forEach((c, j) =>
				orphanPos.set(c.id, { x: j * (CLASS_W + GAP_X), y }),
			);
			y += rowH + GAP_Y;
		}
	}
	for (const c of classes) {
		const p = c.parentNode ?? c.data?.parentNode;
		const inGroup = p && groupIds.has(p);
		rfNodes.push({
			id: c.id,
			type: "cls",
			position: inGroup
				? groupGeom.get(p).positions.get(c.id)
				: orphanPos.get(c.id),
			...(inGroup ? { parentNode: p, extent: "parent" } : {}),
			data: { ...(c.data ?? c), id: c.id },
		});
	}
	return { nodes: rfNodes, edges: rfEdges(edges, new Map()) };
}

/** react-flow 엣지 변환 — 관계 설명 라벨 + 화살표. */
function rfEdges(edges, _pos) {
	return (edges ?? []).map((e) => ({
		id: e.id ?? `${e.source}->${e.target}`,
		source: e.source,
		target: e.target,
		label: e.data?.desc ?? e.desc ?? "",
		type: "smoothstep",
		markerEnd: { type: "arrowclosed", width: 16, height: 16 },
	}));
}

/** 섹션 1개 → 렌더 준비된 { nodes, edges }(자동 배치 좌표 포함). */
export function layoutSection(section) {
	const laid = sectionIsClass(section)
		? layoutClassSection(section)
		: layoutModuleSection(section);
	return {
		id: section?.id,
		title: section?.title,
		isClass: sectionIsClass(section),
		nodes: laid.nodes,
		edges: laid.edges,
	};
}
