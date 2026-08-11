// 그래프 산물(GraphArtifact) 파싱/검증 + md↔json 참조 프로토콜.
// 그래프 데이터는 산출물 md 옆 별도 `.json` 파일에 저장되고, md 는
// `<!-- graph: <파일명> -->` HTML 코멘트 참조만 가진다(ADR-016).
// 코어는 envelope(sections) 만 보증하고 노드/엣지 내부(레이아웃 불필요 필드)는
// 불투명하게 취급한다. position 등 좌표 필드는 프로토콜에서 금지 — 뷰어 자동 배치.
import type { GraphArtifact, GraphSection } from "./types.ts";

/** md 안의 그래프 JSON 참조 코멘트(`<!-- graph: <파일명> -->`).
 * 파일명은 안전한 문자만 허용(경로 분리자 금지 — traversal 차단). */
export const GRAPH_REF_RE = /<!--\s*graph:\s*([\w.-]+)\s*-->/;

/** md 에서 그래프 JSON 참조 파일명 추출. 참조 없으면 undefined. */
export function graphRefFile(md: string): string | undefined {
	const m = (md ?? "").match(GRAPH_REF_RE);
	return m?.[1];
}

/** 산출물 md 파일명에 대응하는 그래프 JSON 파일명(`02-design.md` → `02-design-graph.json`). */
export function graphJsonNameFor(mdFile: string): string {
	return mdFile.replace(/\.md$/i, "") + "-graph.json";
}

export function emptyGraphArtifact(): GraphArtifact {
	return { sections: [] };
}

/** JSON 문자열 → GraphArtifact. 파싱/형태 불량 시 null(호출측이 그레이스풀 처리). */
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
