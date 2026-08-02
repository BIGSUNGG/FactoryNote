// 그래프 산출물(GraphArtifact) 파싱/검증. 코어는 envelope(sections) 만 보증하고
// 노드/엣지 내부(react-flow 필드)는 불투명하게 취급한다. Stage 3/4 .json 산출물용.
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
