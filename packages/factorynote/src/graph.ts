// 그래프 트리(계층 그래프) 파싱/검증 + md↔json 참조 프로토콜(ADR-018).
// 그래프 데이터는 산출물 md 옆 계층 파일 트리: 루트 <산출물>-graph.json +
// <산출물>-graph/ 서브디렉터리에 자식이 있는 노드마다 파일 1개(임의 깊이).
// 관계는 나가는 참조(refs {to, comment})만 소스 노드 파일에 작성 — 단방향 한쪽, 양방향 양쪽.
// position 등 좌표 필드 금지 — 뷰어 자동 배치(ADR-016). 코어는 envelope 만 보증하고
// 노드 표시 필드는 불투명하게 취급한다.
import type {
	GraphFileNode,
	GraphFlowchartEdge,
	GraphFlowchartFile,
	GraphFlowchartNode,
	GraphFlowchartShape,
	GraphKind,
	GraphLevel,
	GraphLevelFile,
	GraphRef,
	GraphSequenceFile,
	GraphSequenceFragment,
	GraphSequenceItem,
	GraphSequenceMessage,
	GraphTreeNode,
} from "./types/index.ts";

/** md 안의 그래프 JSON 참조 코멘트(`<!-- graph: <파일명> -->`).
 * 파일명은 안전한 문자만 허용(경로 분리자 금지 — traversal 차단). */
export const GRAPH_REF_RE = /<!--\s*graph:\s*([\w.-]+)\s*-->/;

/** 그래프 이름은 에이전트가 자유롭게 결정(ADR-020) — 루트 json 파일명 하나만 참조.
 * 안전 검사: 경로 분리자는 정규식이 이미 차단, `..`(상승 traversal)·`.json` 아닌 이름 거부. */
export function isSafeGraphName(name: string): boolean {
	return (
		name.length > 0 &&
		name.endsWith(".json") &&
		!name.includes("..") &&
		name !== ".json"
	);
}

/** md 의 그래프 JSON 참조 파일명 **전부**를 문서 순서대로 추출(ADR-020 다중 그래프).
 * 안전하지 않은 이름(`..`·`.json` 아님)은 제외 — 호출측이 개수 비교로 규약 위반 감지. */
export function graphRefFiles(md: string): string[] {
	const out: string[] = [];
	for (const m of (md ?? "").matchAll(new RegExp(GRAPH_REF_RE, "g"))) {
		if (m[1] && isSafeGraphName(m[1])) out.push(m[1]);
	}
	return out;
}

/** md 에서 첫 그래프 JSON 참조 파일명 추출(하위 호환 편의). 참조 없으면 undefined. */
export function graphRefFile(md: string): string | undefined {
	return graphRefFiles(md)[0];
}

/** md 안 `<!-- graph:` 시도 총 개수(규약 위반 감지용 — 엄밀 정규식과 별개). */
export function graphRefAttemptCount(md: string): number {
	return (md ?? "").match(/<!--\s*graph:/gi)?.length ?? 0;
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
	// refs·children 은 검증을 거친 값만 담는다 — 원시 스프레드에서 미리 제외해
	// 속성 삭제(delete) 후처리가 필요 없다.
	const { refs: rawRefs, children: rawChildren, ...rest } = o;
	const out: GraphFileNode = { ...rest, id: o.id };
	if (rawRefs !== undefined) {
		if (!Array.isArray(rawRefs))
			throw new Error(`node ${o.id}: refs not array`);
		out.refs = rawRefs.map((r, j) => coerceRef(r, `node ${o.id} ref #${j}`));
	}
	if (rawChildren !== undefined) {
		if (!isSafeChildPath(rawChildren)) {
			throw new Error(`node ${o.id}: unsafe children path`);
		}
		out.children = rawChildren;
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

// --- Sequence·Flowchart envelope(ADR-021) — 단일 파일 그래프. ---

const FLOWCHART_SHAPES: readonly GraphFlowchartShape[] = [
	"terminal",
	"process",
	"decision",
];
const FRAGMENT_KINDS = ["alt", "loop", "opt"] as const;
const MAX_SEQ_DEPTH = 16; // fragment 중첩 상한 — 불량 입력 스택 보호.

function coerceId(value: unknown, ctx: string): string {
	if (typeof value !== "string" || value.length === 0)
		throw new Error(`${ctx}: id missing`);
	return value;
}

function coerceUniqueIds(ids: string[], ctx: string): void {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) throw new Error(`${ctx}: duplicate id: ${id}`);
		seen.add(id);
	}
}

function coerceSeqItem(
	value: unknown,
	ids: Set<string>,
	depth: number,
	ctx: string,
): GraphSequenceItem {
	if (depth > MAX_SEQ_DEPTH)
		throw new Error(`${ctx}: fragment nesting too deep`);
	if (typeof value !== "object" || value === null)
		throw new Error(`${ctx}: item not an object`);
	const o = value as Record<string, unknown>;
	// fragment 판별은 body 배열 존재 여부 — 메시지 kind(call/reply)와 충돌 방지.
	if (Array.isArray(o.body)) {
		if (!FRAGMENT_KINDS.includes(o.kind as (typeof FRAGMENT_KINDS)[number]))
			throw new Error(`${ctx}: fragment kind must be alt|loop|opt`);
		if (!Array.isArray(o.body))
			throw new Error(`${ctx}: fragment body missing`);
		const fragment: GraphSequenceFragment = {
			kind: o.kind as GraphSequenceFragment["kind"],
			body: o.body.map((it, i) =>
				coerceSeqItem(it, ids, depth + 1, `${ctx} fragment[${i}]`),
			),
		};
		if (typeof o.label === "string") fragment.label = o.label;
		return fragment;
	}
	const from = coerceId(o.from, ctx);
	const to = coerceId(o.to, ctx);
	if (typeof o.label !== "string" || o.label.length === 0)
		throw new Error(`${ctx}: message label missing`);
	for (const p of [from, to]) {
		if (!ids.has(p)) throw new Error(`${ctx}: unknown participant: ${p}`);
	}
	const msg: GraphSequenceMessage = { from, to, label: o.label };
	if (o.kind === "reply") msg.kind = "reply";
	return msg;
}

/** unknown → GraphSequenceFile. envelope 검증: version=2 · type · 참여자 id 유일 ·
 * 메시지/fragment 가 참여자 참조 · fragment kind·중첩 상한. 불량 시 throw. */
export function coerceGraphSequenceFile(value: unknown): GraphSequenceFile {
	if (typeof value !== "object" || value === null)
		throw new Error("invalid sequence graph: not an object");
	const o = value as {
		version?: unknown;
		type?: unknown;
		id?: unknown;
		title?: unknown;
		participants?: unknown;
		body?: unknown;
	};
	if (o.version !== 2)
		throw new Error("invalid sequence graph: version must be 2");
	if (o.type !== "sequence")
		throw new Error("invalid sequence graph: type must be 'sequence'");
	if (!Array.isArray(o.participants) || o.participants.length === 0)
		throw new Error("invalid sequence graph: participants missing");
	if (!Array.isArray(o.body))
		throw new Error("invalid sequence graph: body missing");
	const participants = o.participants.map((p, i) => {
		if (typeof p !== "object" || p === null)
			throw new Error(`participant #${i}: not an object`);
		return {
			...(p as Record<string, unknown>),
			id: coerceId((p as Record<string, unknown>).id, `participant #${i}`),
		};
	});
	coerceUniqueIds(
		participants.map((p) => p.id),
		"sequence graph",
	);
	const ids = new Set(participants.map((p) => p.id));
	return {
		version: 2,
		type: "sequence",
		...(typeof o.id === "string" && o.id.length > 0 ? { id: o.id } : {}),
		...(typeof o.title === "string" ? { title: o.title } : {}),
		participants,
		body: o.body.map((it, i) => coerceSeqItem(it, ids, 0, `body[${i}]`)),
	};
}

/** unknown → GraphFlowchartFile. envelope 검증: version=2 · type · 노드 id 유일·label 필수 ·
 * 엣지가 존재 노드 참조 · shape 열거형. 불량 시 throw. */
export function coerceGraphFlowchartFile(value: unknown): GraphFlowchartFile {
	if (typeof value !== "object" || value === null)
		throw new Error("invalid flowchart graph: not an object");
	const o = value as {
		version?: unknown;
		type?: unknown;
		id?: unknown;
		title?: unknown;
		nodes?: unknown;
		edges?: unknown;
	};
	if (o.version !== 2)
		throw new Error("invalid flowchart graph: version must be 2");
	if (o.type !== "flowchart")
		throw new Error("invalid flowchart graph: type must be 'flowchart'");
	if (!Array.isArray(o.nodes) || o.nodes.length === 0)
		throw new Error("invalid flowchart graph: nodes missing");
	if (!Array.isArray(o.edges))
		throw new Error("invalid flowchart graph: edges missing");
	const nodes: GraphFlowchartNode[] = o.nodes.map((n, i) => {
		if (typeof n !== "object" || n === null)
			throw new Error(`node #${i}: not an object`);
		const no = n as Record<string, unknown>;
		if (typeof no.label !== "string" || no.label.length === 0)
			throw new Error(`node #${i}: label missing`);
		const node: GraphFlowchartNode = {
			...no,
			id: coerceId(no.id, `node #${i}`),
			label: no.label,
		};
		if (no.shape !== undefined) {
			if (!FLOWCHART_SHAPES.includes(no.shape as GraphFlowchartShape))
				throw new Error(`node #${i}: shape must be terminal|process|decision`);
			node.shape = no.shape as GraphFlowchartShape;
		}
		return node;
	});
	coerceUniqueIds(
		nodes.map((n) => n.id),
		"flowchart graph",
	);
	const ids = new Set(nodes.map((n) => n.id));
	const edges: GraphFlowchartEdge[] = o.edges.map((e, i) => {
		if (typeof e !== "object" || e === null)
			throw new Error(`edge #${i}: not an object`);
		const eo = e as Record<string, unknown>;
		const from = coerceId(eo.from, `edge #${i}`);
		const to = coerceId(eo.to, `edge #${i}`);
		for (const p of [from, to]) {
			if (!ids.has(p)) throw new Error(`edge #${i}: unknown node: ${p}`);
		}
		const edge: GraphFlowchartEdge = { ...eo, from, to };
		if (typeof eo.label === "string") edge.label = eo.label;
		return edge;
	});
	return {
		version: 2,
		type: "flowchart",
		...(typeof o.id === "string" && o.id.length > 0 ? { id: o.id } : {}),
		...(typeof o.title === "string" ? { title: o.title } : {}),
		nodes,
		edges,
	};
}

/** 그래프 파일 종류 판별 — type 필드 없음 = 계층 트리(ADR-018 하위 호환). 불량 시 null. */
export function graphKindOf(raw: string): GraphKind | null {
	try {
		const o = JSON.parse(raw) as { type?: unknown; nodes?: unknown };
		if (o.type === "sequence") return "sequence";
		if (o.type === "flowchart") return "flowchart";
		if (o.type === undefined) return "tree";
		return null;
	} catch {
		return null;
	}
}

/** JSON 문자열 → 종류별 파싱. sequence·flowchart 는 단일 파일(자식 트리 없음). */
export function parseGraphSequenceFile(raw: string): GraphSequenceFile | null {
	try {
		return coerceGraphSequenceFile(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function parseGraphFlowchartFile(
	raw: string,
): GraphFlowchartFile | null {
	try {
		return coerceGraphFlowchartFile(JSON.parse(raw));
	} catch {
		return null;
	}
}

/** 아무 종류든 유효한 그래프 파일이면 종류 반환 — checkRequiredGraph 등 공통 검증용. */
export function parseAnyGraphKind(raw: string): GraphKind | null {
	const kind = graphKindOf(raw);
	if (kind === "sequence")
		return parseGraphSequenceFile(raw) ? "sequence" : null;
	if (kind === "flowchart")
		return parseGraphFlowchartFile(raw) ? "flowchart" : null;
	if (kind === "tree") return parseGraphLevelFile(raw) ? "tree" : null;
	return null;
}

/** readRel 실패(누락·IO)는 null 로 우아하게 처리 — .catch 체인 대신 async/await 로 통일. */
async function readOrNull(
	readRel: (path: string) => Promise<string | null>,
	path: string,
): Promise<string | null> {
	try {
		return await readRel(path);
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
				const raw = await readOrNull(readRel, children);
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
			const raw = await readOrNull(readRel, rel);
			const parsed = raw !== null ? parseGraphLevelFile(raw) : null;
			if (parsed) await walk(parsed);
		}
	}

	await walk(root);
	return out;
}
