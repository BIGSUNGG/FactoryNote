// 그래프 산물(GraphArtifact) 파싱/검증. 코어는 envelope(sections) 만 보증하고
// 노드/엣지 내부(react-flow 필드)는 불투명하게 취급한다.
// F2: Stage 2 산물은 마크다운 단일진실 — ```factorynote-graph 펜스 안의 JSON{sections} 가 구조.
import type { GraphArtifact, GraphSection } from "./types.ts";

export function emptyGraphArtifact(): GraphArtifact {
	return { sections: [] };
}

/** JSON 문자열 → GraphArtifact. 파싱/형태 불량 시 null(게이트 서버가 산출물 읽기 시 그레이스풀 처리). */
export function parseGraphArtifact(raw: string): GraphArtifact | null {
	try {
		return coerceGraphArtifact(JSON.parse(raw));
	} catch {
		return null;
	}
}

/** unknown(예: JSON.parse 결과) → GraphArtifact. envelope 만 검증. */
export function coerceGraphArtifact(value: unknown): GraphArtifact {
	if (typeof value !== "object" || value === null) {
		throw new Error("invalid graph artifact: not an object");
	}
	const obj = value as { sections?: unknown };
	if (!Array.isArray(obj.sections)) {
		throw new Error("invalid graph artifact: sections missing");
	}
	return { sections: obj.sections.map(coerceSection) };
}

// --- F2: 설계 마크다운(구조 펜스 + prose) 파싱/직렬화/역동기화 ---
// 구조 블록 = ```factorynote-graph 펜스 안의 JSON {sections:[...]} (GraphArtifact).
// prose = 펜스를 제외한 나머지 md(계층/설명 근거 등).
const GRAPH_FENCE = "factorynote-graph";
const FENCE_RE = /```factorynote-graph[^\n]*\n([\s\S]*?)\n```/;

/** 설계 마크다운 파싱 결과: 구조(GraphArtifact) + prose. */
export interface DesignMarkdown {
	structure: GraphArtifact;
	prose: string;
}

/** md → { structure, prose }. 구조 펜스가 없거나 불량이면 빈 구조. */
export function parseDesignMarkdown(md: string): DesignMarkdown {
	const m = md.match(FENCE_RE);
	const structure =
		m && m[1] !== undefined
			? (parseGraphArtifact(m[1]) ?? emptyGraphArtifact())
			: emptyGraphArtifact();
	const prose = m
		? (md.slice(0, m.index ?? 0) + md.slice((m.index ?? 0) + m[0].length))
				.replace(/\n{3,}/g, "\n\n")
				.trim()
			: md.trim();
	return { structure, prose };
}

/** { structure, prose } → 정규화된 md(왕복 일관성: parse(serialize(x))===x). */
export function serializeDesignMarkdown(parts: {
	structure: GraphArtifact;
	prose: string;
}): string {
	const fence =
		"```" + GRAPH_FENCE + "\n" + JSON.stringify(parts.structure, null, 2) + "\n```";
	const prose = parts.prose.replace(/\s+$/, "");
	return prose ? prose + "\n\n" + fence + "\n" : fence + "\n";
}

/** 기존 md 의 구조 펜스만 치환(역동기화). prose 는 그대로 보존. 펜스가 없으면 추가. */
export function applyStructureToMarkdown(
	md: string,
	structure: GraphArtifact,
): string {
	const replacement =
		"```" + GRAPH_FENCE + "\n" + JSON.stringify(structure, null, 2) + "\n```";
	if (FENCE_RE.test(md)) {
		return md.replace(FENCE_RE, () => replacement);
	}
	const trimmed = md.replace(/\s+$/, "");
	return trimmed ? trimmed + "\n\n" + replacement + "\n" : replacement + "\n";
}

function coerceSection(s: unknown, i: number): GraphSection {
	if (typeof s !== "object" || s === null) {
		throw new Error(`invalid section #${i}`);
	}
	const o = s as {
		id?: unknown;
		title?: unknown;
		nodes?: unknown;
		edges?: unknown;
	};
	if (
		typeof o.id !== "string" ||
		typeof o.title !== "string" ||
		!Array.isArray(o.nodes) ||
		!Array.isArray(o.edges)
	) {
		throw new Error(`invalid section #${i}: shape`);
	}
	return {
		id: o.id,
		title: o.title,
		nodes: o.nodes as GraphSection["nodes"],
		edges: o.edges as GraphSection["edges"],
	};
}
