// 그래프 정규화: 에이전트 의미 JSON → react-flow 호환 노드/엣지. 순수 함수.
// GraphStage.jsx 와 테스트(graphNormalize.test.js) 가 공유 — 컴포넌트에 묶인
// 렌더링 결정 로직을 분리해 회귀를 가드한다.
//
// 타입 규칙(레지스트리 키 = GraphStage.jsx 의 NODE_TYPES_4/NODE_TYPES_3 과 일치):
//   Stage 4: agent "group" → modGroup, "class" → cls (둘 다 레지스트리 키). 누락 시 cls.
//   Stage 3: type 누락 시 layer 로 module/external 추론.
export function gridPos(i) {
	const col = i % 3;
	const row = Math.floor(i / 3);
	return { x: 40 + col * 220, y: 40 + row * 130 };
}

export function normalizeNode(n, i, stage) {
	const data = (n && typeof n === "object" && n.data) || n || {};
	const id = n?.id ?? data.id ?? `n${i}`;
	let type = n?.type;
	if (stage === 4) {
		// agent 가 내는 type("group"/"class") 또는 data.type 을 레지스트리 키로 정규화.
		if (type === "group" || data.type === "group") type = "modGroup";
		else if (type === "class" || data.type === "class" || !type) type = "cls";
	} else if (!type) {
		type = data.layer === "External" ? "external" : "module";
	}
	const position = n?.position ?? gridPos(i);
	const node = { id, type, position, data: { ...data, id } };
	if (stage === 4) {
		const parent = n?.parentNode ?? data.parentNode;
		if (parent && type === "cls") {
			node.parentNode = parent;
			node.extent = "parent";
		}
		if (type === "modGroup") {
			node.selectable = false;
			node.style = {
				width: n?.width ?? data.width ?? 240,
				height: n?.height ?? data.height ?? 130,
			};
		}
	}
	return node;
}

export function normalizeEdge(e) {
	const source = e.source;
	const target = e.target;
	return {
		id: e.id ?? `${source}->${target}`,
		source,
		target,
		data: { desc: e.data?.desc ?? e.desc ?? "" },
	};
}

export function normalizeSections(sections, stage) {
	return (sections ?? []).map((sec) => ({
		id: sec.id,
		title: sec.title,
		nodes: (sec.nodes ?? []).map((n, i) => normalizeNode(n, i, stage)),
		edges: (sec.edges ?? []).map(normalizeEdge),
	}));
}
