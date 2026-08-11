// 계층 그래프 트리(ADR-018) 순수 로직 — 드릴다운 선택·병합·참조 변환.
// React 미의존 → bun 테스트 대상. 뷰어는 이 함수들로만 트리 상태를 다룬다.

/** refs → 엣지. 보이는 노드 집합에 없는 대상(미선택·미해결) 참조는 숨긴다. */
export function refsToEdges(nodes) {
	const ids = new Set((nodes ?? []).map((n) => n.id));
	const edges = [];
	for (const n of nodes ?? []) {
		for (const r of n.refs ?? []) {
			if (r.to !== n.id && ids.has(r.to)) {
				edges.push({
					id: `${n.id}->${r.to}`,
					source: n.id,
					target: r.to,
					data: { desc: r.comment ?? "" },
				});
			}
		}
	}
	return edges;
}

/** 선택 토글 — 없으면 추가(끝에), 있으면 제거. 순서 보존(병합 패널 순서). */
export function toggleSelect(selected, id) {
	return selected.includes(id)
		? selected.filter((x) => x !== id)
		: [...selected, id];
}

const labelOf = (n) => n.label ?? n.name ?? n.id;

/**
 * 선택된 노드들의 자식 레벨을 하나의 레벨로 병합.
 * 부모가 2개 이상이면 모듈(부모) 그룹 노드를 합성해 소속을 유지한다.
 * 선택 노드 중 자식이 하나도 없으면 null(자식 패널 없음).
 */
export function mergeChildLevels(level, selectedIds) {
	const parents = (level?.nodes ?? []).filter(
		(n) => selectedIds.includes(n.id) && n.children,
	);
	if (parents.length === 0) return null;
	const multi = parents.length > 1;
	const groups = multi
		? parents.map((p) => ({
				id: `grp-${p.id}`,
				type: "group",
				label: labelOf(p),
			}))
		: [];
	const nodes = [];
	for (const p of parents) {
		for (const c of p.children.nodes ?? []) {
			nodes.push(multi ? { ...c, parentNode: `grp-${p.id}` } : c);
		}
	}
	const levels = [
		...new Set(parents.map((p) => p.children.childLevel).filter(Boolean)),
	];
	const childLevel = levels.join("/") || undefined;
	return {
		file: `merged:${parents.map((p) => p.id).join("+")}`,
		...(childLevel ? { childLevel } : {}),
		title: `${childLevel ?? "하위 노드"} — ${parents.map(labelOf).join(", ")}`,
		nodes: [...groups, ...nodes],
	};
}

/** 레벨 제목(뷰어 카드 헤더). 루트는 파일 title, 병합 레벨은 병합 시 합성된 title. */
export function levelTitle(level, depth) {
	if (level?.title) return level.title;
	return depth === 0 ? "관계도" : (level?.childLevel ?? "하위 노드");
}
