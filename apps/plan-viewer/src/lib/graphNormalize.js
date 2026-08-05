// 그래프 정규화: 에이이전트 의미 JSON → react-flow 호환 노드/엣지. 순수 함수.
// GraphStage.jsx 와 테스트(graphNormalize.test.js) 가 공유 — 컴포넌트에 묶인
// 렌더링 결정 로직을 분리해 회귀를 가드한다.
//
// 종류 판별은 스테이지가 아닌 **노드 타입**으로 한다(병합된 Stage 2 는 한 페이지에
// 모듈 관계도 섹션과 클래스 구조도 섹션이 섞여 있다). 각 노드를 독립적으로 정규화한다.
// 타입 규칙(레지스트리 키 = GraphStage.jsx 의 NODE_TYPES_4/NODE_TYPES_3 과 일치):
//   클래스 구조도 노드: agent "group" → modGroup, "class" → cls (둘 다 레지스트리 키). 누락 시 cls.
//   모듈 관계도 노드: type 누락 시 layer 로 module/external 추론.
export function gridPos(i) {
	const col = i % 3;
	const row = Math.floor(i / 3);
	return { x: 40 + col * 220, y: 40 + row * 130 };
}

/** 노드가 클래스 구조도(modGroup/cls/group/class) 계열인지 판별. */
function isClassKind(rawType) {
	return (
		rawType === "group" ||
		rawType === "class" ||
		rawType === "modGroup" ||
		rawType === "cls"
	);
}

export function normalizeNode(n, i) {
	const data = (n && typeof n === "object" && n.data) || n || {};
	const id = n?.id ?? data.id ?? `n${i}`;
	const rawType = n?.type ?? data.type;
	const classKind = isClassKind(rawType);
	let type;
	if (classKind) {
		type = rawType === "group" || rawType === "modGroup" ? "modGroup" : "cls";
	} else {
		type = data.layer === "External" ? "external" : "module";
	}
	const position = n?.position ?? gridPos(i);
	const node = { id, type, position, data: { ...data, id } };
	if (classKind) {
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

export function normalizeSections(sections) {
	return (sections ?? []).map((sec) => ({
		id: sec.id,
		title: sec.title,
		nodes: (sec.nodes ?? []).map((n, i) => normalizeNode(n, i)),
		edges: (sec.edges ?? []).map(normalizeEdge),
	}));
}

/** 섹션이 클래스 구조도인지(모듈 그룹/클래스 노드를 하나라도 포함) 판별.
 * 빈 섹션은 모듈 관계도로 간주한다(모듈→클래스 설계 흐름상 모듈이 기본). */
export function sectionIsClass(section) {
	return (section?.nodes ?? []).some((n) => {
		const t = n?.type ?? n?.data?.type;
		return isClassKind(t);
	});
}
