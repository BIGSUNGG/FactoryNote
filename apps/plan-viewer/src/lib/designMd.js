// 설계 마크다운(구조 펜스 + prose) 파싱/직렬화/역동기화 — core graph.ts 의 브라우저 포트.
// 뷰어는 @factorynote/core 에 의존하지 않는 독립 번들이므로 동일 로직을 JS 로 유지한다.
// 구조 블록 = ```factorynote-graph 펜스 안의 JSON { sections: [...] }.

const GRAPH_FENCE = "factorynote-graph";
const FENCE_RE = /```factorynote-graph[^\n]*\n([\s\S]*?)\n```/;
// fallback: factorynote-graph 펜스가 없거나 파싱 실패 시 sections 를 포함한 임의 펜스 탐색.
const ANY_FENCE_RE = /```[a-zA-Z0-9_-]*[^\n]*\n([\s\S]*?)\n```/g;

/** LLM 생성 JSON 의 흔한 오류 관용: 단행 // 주석·후행 쉼표 제거 후 파싱. */
function sanitizeJson(str) {
	return str.replace(/\/\/[^\n]*/g, "").replace(/,\s*([}\]])/g, "$1");
}

/** 펜스 안 JSON 문자열 → { sections } (형태 불량 시 빈 구조). */
function coerceStructure(jsonStr) {
	try {
		const obj = JSON.parse(sanitizeJson(jsonStr));
		// 수용: {sections:[...]} | [section,...] 배열 | bare 섹션 객체(에이전트가 sections 래퍼 누락).
		let sections;
		if (Array.isArray(obj)) sections = obj;
		else if (obj && Array.isArray(obj.sections)) sections = obj.sections;
		else if (
			obj &&
			(Array.isArray(obj.nodes) ||
				Array.isArray(obj.edges) ||
				(typeof obj.id === "string" && typeof obj.title === "string"))
		)
			sections = [obj];
		else return { sections: [] };
		return {
			sections: sections
				.filter(
					(s) =>
						s &&
						typeof s.id === "string" &&
						typeof s.title === "string" &&
						Array.isArray(s.nodes) &&
						Array.isArray(s.edges),
				)
				.map((s) => ({
					id: s.id,
					title: s.title,
					nodes: s.nodes,
					edges: s.edges,
				})),
		};
	} catch {
		return { sections: [] };
	}
}

/** md → { structure, prose }. 구조 펜스가 없거나 불량이면 빈 구조.
 * factorynote-graph 펜스를 우선 쓰고, 없거나 파싱이 빈 구조면 sections 를 포함한
 * 임의의 코드펜스(```json 등)로 fallback — 에이전트 출력 포맷 편차를 흡수. */
export function parseDesignMarkdown(md) {
	const src = md ?? "";
	const m = src.match(FENCE_RE);
	let structure = m && m[1] != null ? coerceStructure(m[1]) : { sections: [] };
	let used = m ?? null;
	if (structure.sections.length === 0) {
		for (const fm of src.matchAll(ANY_FENCE_RE)) {
			if (fm.index === (m?.index ?? -1)) continue; // 동일 펜스 스킵
			const s = coerceStructure(fm[1]);
			if (s.sections.length > 0) {
				structure = s;
				used = fm;
				break;
			}
		}
	}
	const prose = used
		? (src.slice(0, used.index) + src.slice(used.index + used[0].length))
				.replace(/\n{3,}/g, "\n\n")
				.trim()
		: src.trim();
	return { structure, prose };
}

/** { structure, prose } → 정규화된 md(core graph.ts 와 왕복 일관성). */
export function serializeDesignMarkdown({ structure, prose }) {
	const fence =
		"```" + GRAPH_FENCE + "\n" + JSON.stringify(structure, null, 2) + "\n```";
	const p = (prose ?? "").replace(/\s+$/, "");
	return p ? p + "\n\n" + fence + "\n" : fence + "\n";
}

/** 기존 md 의 구조 펜스만 치환(역동기화). prose 는 그대로 보존. 펜스가 없으면 추가. */
export function applyStructureToMarkdown(md, structure) {
	const replacement =
		"```" + GRAPH_FENCE + "\n" + JSON.stringify(structure, null, 2) + "\n```";
	if (FENCE_RE.test(md ?? "")) {
		return (md ?? "").replace(FENCE_RE, () => replacement);
	}
	const trimmed = (md ?? "").replace(/\s+$/, "");
	return trimmed ? trimmed + "\n\n" + replacement + "\n" : replacement + "\n";
}
