// 그래프 트리(계층 그래프) 파싱/검증 + md↔json 참조 프로토콜(ADR-018).
// 그래프 데이터는 산출물 md 옆 계층 파일 트리: 루트 <산출물>-graph.json +
// <산출물>-graph/ 서브디렉터리에 자식이 있는 노드마다 파일 1개(임의 깊이).
// 관계는 나가는 참조(refs {to, comment})만 소스 노드 파일에 작성 — 단방향 한쪽, 양방향 양쪽.
// position 등 좌표 필드 금지 — 뷰어 자동 배치(ADR-016). 코어는 envelope 만 보증하고
// 노드 표시 필드는 불투명하게 취급한다.
import type {
	GraphFileNode,
	GraphLevel,
	GraphLevelFile,
	GraphRef,
	GraphTreeNode,
} from "./types.ts";

/** md 안의 그래프 JSON 참조 코멘트(`<!-- graph: <파일명> -->`).
 * 파일명은 안전한 문자만 허용(경로 분리자 금지 — traversal 차단). */
export const GRAPH_REF_RE = /<!--\s*graph:\s*([\w.-]+)\s*-->/;

/** md 에서 그래프 JSON 참조 파일명 추출. 참조 없으면 undefined. */
export function graphRefFile(md: string): string | undefined {
	const m = (md ?? "").match(GRAPH_REF_RE);
	return m?.[1];
}

/** 산출물 md 파일명에 대응하는 그래프 루트 JSON 파일명(`02-design.md` → `02-design-graph.json`). */
export function graphJsonNameFor(mdFile: string): string {
	return mdFile.replace(/\.md$/i, "") + "-graph.json";
}

/** 루트 json 파일명 → 자식 파일들이 사는 서브디렉터리명(`draft-graph.json` → `draft-graph`). */
export function graphDirNameFor(rootJsonFile: string): string {
	return rootJsonFile.replace(/\.json$/i, "");
}

/** 자식 파일 경로 안전 검사(traversal 방어). 상대경로 + `/` 외 분리자·`..` 금지 + `.json` 끝. */
export function isSafeChildPath(p: unknown): p is string {
	if (typeof p !== "string" || p.length === 0 || p.length > 512) return false;
	if (p.startsWith("/") || p.startsWith("\\") || /^[A-Za-z]:/.test(p))
		return false;
	if (p.includes("\\") || p.includes("..")) return false;
	if (!p.endsWith(".json")) return false;
	return p
		.split("/")
		.every((s) => s.length > 0 && s !== "." && !s.includes("\0"));
}

function coerceRef(r: unknown, ctx: string): GraphRef {
	if (typeof r !== "object" || r === null) {
		throw new Error(`${ctx}: ref not an object`);
	}
	const o = r as { to?: unknown; comment?: unknown };
	if (typeof o.to !== "string" || o.to.length === 0) {
		throw new Error(`${ctx}: ref.to missing`);
	}
	if (typeof o.comment !== "string" || o.comment.length === 0) {
		throw new Error(`${ctx}: ref.comment missing`);
	}
	return { to: o.to, comment: o.comment };
}

function coerceNode(n: unknown, i: number): GraphFileNode {
	if (typeof n !== "object" || n === null) {
		throw new Error(`invalid node #${i}: not an object`);
	}
	const o = n as Record<string, unknown>;
	if (typeof o.id !== "string" || o.id.length === 0) {
		throw new Error(`node #${i}: id missing`);
	}
	const out: GraphFileNode = { ...o, id: o.id };
	if (o.refs !== undefined) {
		if (!Array.isArray(o.refs)) throw new Error(`node ${o.id}: refs not array`);
		out.refs = o.refs.map((r, j) => coerceRef(r, `node ${o.id} ref #${j}`));
	} else {
		delete out.refs;
	}
	if (o.children !== undefined) {
		if (!isSafeChildPath(o.children)) {
			throw new Error(`node ${o.id}: unsafe children path`);
		}
		out.children = o.children;
	} else {
		delete out.children;
	}
	return out;
}

/** unknown(JSON.parse 결과) → GraphLevelFile. envelope 검증:
 * version=2 · nodes 형태 · refs {to, comment} · children 경로 안전 · 파일 내 id 유일. */
export function coerceGraphLevelFile(value: unknown): GraphLevelFile {
	if (typeof value !== "object" || value === null) {
		throw new Error("invalid graph level: not an object");
	}
	const o = value as {
		version?: unknown;
		id?: unknown;
		title?: unknown;
		childLevel?: unknown;
		nodes?: unknown;
	};
	if (o.version !== 2) {
		throw new Error("invalid graph level: version must be 2");
	}
	if (!Array.isArray(o.nodes)) {
		throw new Error("invalid graph level: nodes missing");
	}
	const nodes = o.nodes.map(coerceNode);
	const seen = new Set<string>();
	for (const n of nodes) {
		if (seen.has(n.id)) throw new Error(`duplicate node id: ${n.id}`);
		seen.add(n.id);
	}
	return {
		version: 2,
		...(typeof o.id === "string" && o.id.length > 0 ? { id: o.id } : {}),
		...(typeof o.title === "string" ? { title: o.title } : {}),
		...(typeof o.childLevel === "string" ? { childLevel: o.childLevel } : {}),
		nodes,
	};
}

/** JSON 문자열 → GraphLevelFile. 파싱/형태 불량 시 null(호출측이 그레이스풀 처리). */
export function parseGraphLevelFile(raw: string): GraphLevelFile | null {
	try {
		return coerceGraphLevelFile(JSON.parse(raw));
	} catch {
		return null;
	}
}

/** 루트 raw + 자식 파일 리더 → 조립된 트리. 루트 불량 → null.
 * 자식 파일 누락/불량은 해당 노드의 children 생략으로 우아하게 처리(트리 전체는 유지). */
export async function loadGraphTree(
	rootRaw: string,
	rootFile: string,
	readRel: (relPath: string) => Promise<string | null>,
): Promise<GraphLevel | null> {
	const root = parseGraphLevelFile(rootRaw);
	if (!root) return null;

	async function toLevel(
		file: GraphLevelFile,
		path: string,
	): Promise<GraphLevel> {
		const nodes: GraphTreeNode[] = [];
		for (const n of file.nodes) {
			const { children, ...rest } = n;
			let childLevel: GraphLevel | undefined;
			if (children) {
				const raw = await readRel(children).catch(() => null);
				const parsed = raw !== null ? parseGraphLevelFile(raw) : null;
				if (parsed) childLevel = await toLevel(parsed, children);
			}
			nodes.push({
				...rest,
				id: n.id,
				...(childLevel ? { children: childLevel } : {}),
			});
		}
		return {
			file: path,
			...(file.id ? { parentId: file.id } : {}),
			...(file.title !== undefined ? { title: file.title } : {}),
			...(file.childLevel !== undefined ? { childLevel: file.childLevel } : {}),
			nodes,
		};
	}

	return toLevel(root, rootFile);
}

/** 루트에서 도달 가능한 자식 파일들의 상대경로(승격 복사용 — 고아·잔여 파일 자연 제외). */
export async function collectGraphChildFiles(
	rootRaw: string,
	readRel: (relPath: string) => Promise<string | null>,
): Promise<string[]> {
	const root = parseGraphLevelFile(rootRaw);
	if (!root) return [];
	const out: string[] = [];
	const seen = new Set<string>();

	async function walk(file: GraphLevelFile): Promise<void> {
		for (const n of file.nodes) {
			const rel = n.children;
			if (!rel || seen.has(rel)) continue;
			seen.add(rel);
			out.push(rel);
			const raw = await readRel(rel).catch(() => null);
			const parsed = raw !== null ? parseGraphLevelFile(raw) : null;
			if (parsed) await walk(parsed);
		}
	}

	await walk(root);
	return out;
}
