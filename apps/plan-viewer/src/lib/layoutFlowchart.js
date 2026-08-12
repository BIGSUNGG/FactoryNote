// 플로우차트 결정적 자동 배치(ADR-021) — 순수 로직, 컴포넌트와 분리.
// 입력: {nodes:[{id,label,shape?}], edges:[{from,to,label?}]} — 좌표는 여기서만 결정.
// 랭크 = 소스로부터 최장 경로(Kahn, 사이클 노드는 입력 순서 폴백), 행 내 순서는
// predecessor barycenter + 입력 순서 타이브레이크. 노드 겹침 0(상수 간격 보장).

export const FLOW_METRICS = {
	nodeW: 150,
	nodeH: 46,
	colGap: 44,
	rowGap: 64,
	pad: 24,
};

/** 플로우차트 데이터 → 렌더 좌표. 결정적(같은 입력 → 같은 출력). */
export function layoutFlowchart(data) {
	const m = FLOW_METRICS;
	const nodes = data.nodes || [];
	const edges = data.edges || [];
	const order = new Map(nodes.map((n, i) => [n.id, i]));
	const preds = new Map(nodes.map((n) => [n.id, []]));
	const succs = new Map(nodes.map((n) => [n.id, []]));
	const indeg = new Map(nodes.map((n) => [n.id, 0]));
	for (const e of edges) {
		if (!preds.has(e.to) || !succs.has(e.from)) continue;
		preds.get(e.to).push(e.from);
		succs.get(e.from).push(e.to);
		indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
	}

	// 랭크 배정 — Kahn(입력 순서 큐). 사이클 잔여는 maxRank+1 로 순차 배치.
	const rank = new Map();
	const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
	for (const id of queue) rank.set(id, 0);
	let head = 0;
	while (head < queue.length) {
		const id = queue[head++];
		for (const s of succs.get(id)) {
			rank.set(s, Math.max(rank.get(s) ?? 0, (rank.get(id) ?? 0) + 1));
			indeg.set(s, indeg.get(s) - 1);
			if (indeg.get(s) === 0) queue.push(s);
		}
	}
	let maxRank = -1;
	for (const r of rank.values()) maxRank = Math.max(maxRank, r);
	for (const n of nodes) {
		if (!rank.has(n.id)) rank.set(n.id, ++maxRank);
	}

	// 랭크별 그룹(입력 순서) → barycenter 1패스 정렬(결정적 타이브레이크 = 입력 순서).
	const rows = new Map();
	for (const n of nodes) {
		const r = rank.get(n.id);
		if (!rows.has(r)) rows.set(r, []);
		rows.get(r).push(n.id);
	}
	const posInRow = new Map();
	for (const r of [...rows.keys()].sort((a, b) => a - b)) {
		const ids = rows.get(r);
		const bary = (id) => {
			const ps = preds.get(id).filter((p) => posInRow.has(p));
			if (ps.length === 0) return order.get(id);
			return ps.reduce((s, p) => s + posInRow.get(p), 0) / ps.length;
		};
		ids.sort((a, b) => bary(a) - bary(b) || order.get(a) - order.get(b));
		ids.forEach((id, i) => posInRow.set(id, i));
		rows.set(r, ids);
	}

	const widest = Math.max(...[...rows.values()].map((ids) => ids.length), 1);
	const rowWidth = (k) => k * m.nodeW + (k - 1) * m.colGap;
	const totalW = rowWidth(widest);

	const placed = new Map();
	for (const [r, ids] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
		const x0 = m.pad + (totalW - rowWidth(ids.length)) / 2;
		ids.forEach((id, i) => {
			const node = nodes.find((n) => n.id === id);
			placed.set(id, {
				id,
				label: node.label,
				shape: node.shape ?? "process",
				x: x0 + i * (m.nodeW + m.colGap),
				y: m.pad + r * (m.nodeH + m.rowGap),
				w: m.nodeW,
				h: m.nodeH,
				rank: r,
			});
		});
	}

	const placedNodes = nodes.map((n) => placed.get(n.id));
	const placedEdges = edges
		.filter((e) => placed.has(e.from) && placed.has(e.to))
		.map((e) => {
			const a = placed.get(e.from);
			const b = placed.get(e.to);
			return {
				from: e.from,
				to: e.to,
				label: e.label ?? "",
				x1: a.x + a.w / 2,
				y1: a.y + a.h,
				x2: b.x + b.w / 2,
				y2: b.y,
				back: rank.get(e.from) >= rank.get(e.to),
			};
		});

	const rankCount = rows.size;
	return {
		width: m.pad * 2 + totalW,
		height:
			m.pad * 2 +
			Math.max(1, rankCount) * m.nodeH +
			Math.max(0, rankCount - 1) * m.rowGap,
		nodes: placedNodes,
		edges: placedEdges,
	};
}
