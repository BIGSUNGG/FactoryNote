// 그래프 트리(계층 그래프) 파싱/검증 + md↔json 참조 프로토콜 자체체크(ADR-018).
import { test, expect } from "bun:test";
import {
	collectGraphChildFiles,
	coerceGraphLevelFile,
	graphDirNameFor,
	graphRefFile,
	graphRefFiles,
	isSafeChildPath,
	isSafeGraphName,
	loadGraphTree,
	parseAnyGraphKind,
	parseGraphFlowchartFile,
	parseGraphLevelFile,
	parseGraphSequenceFile,
} from "./graph.ts";

// 루트(모듈) + 자식(클래스) + 손자(메서드) 3단계 샘플 트리.
const methodFile = JSON.stringify({
	version: 2,
	id: "Parser",
	childLevel: "methods",
	nodes: [
		{ id: "parse", type: "method", label: "parse()" },
		{
			id: "tokenize",
			type: "method",
			label: "tokenize()",
			refs: [{ to: "parse", comment: "호출됨" }],
		},
	],
});
const classFile = JSON.stringify({
	version: 2,
	id: "ui",
	childLevel: "classes",
	nodes: [
		{
			id: "Parser",
			type: "class",
			name: "Parser",
			module: "UI",
			attrs: ["src: string"],
			methods: ["parse()"],
			children: "modules/ui/Parser.json",
			refs: [{ to: "AuthService", comment: "인증 위임" }],
		},
	],
});
const rootFile = JSON.stringify({
	version: 2,
	title: "모듈 관계도",
	childLevel: "modules",
	nodes: [
		{
			id: "ui",
			label: "UI",
			layer: "API",
			type: "module",
			children: "modules/ui.json",
			refs: [{ to: "auth", comment: "인증 요청" }],
		},
		{ id: "auth", label: "Auth", layer: "Service", type: "module" },
	],
});
const files: Record<string, string> = {
	"modules/ui.json": classFile,
	"modules/ui/Parser.json": methodFile,
};
const readRel = async (rel: string) => files[rel] ?? null;

test("parse round-trip: 루트 레벨 파싱", () => {
	const lvl = parseGraphLevelFile(rootFile);
	expect(lvl).not.toBeNull();
	expect(lvl!.childLevel).toBe("modules");
	expect(lvl!.nodes).toHaveLength(2);
	expect(lvl!.nodes[0]!.refs).toEqual([{ to: "auth", comment: "인증 요청" }]);
});

test("loadGraphTree: 3단계 트리 조립(자식·손자 중첩)", async () => {
	const tree = await loadGraphTree(rootFile, "02-design-graph.json", readRel);
	expect(tree).not.toBeNull();
	expect(tree!.file).toBe("02-design-graph.json");
	const ui = tree!.nodes.find((n) => n.id === "ui")!;
	expect(ui.children?.parentId).toBe("ui");
	expect(ui.children?.childLevel).toBe("classes");
	const parser = ui.children!.nodes.find((n) => n.id === "Parser")!;
	expect(parser.children?.childLevel).toBe("methods");
	expect(parser.children!.nodes).toHaveLength(2);
	// 자식 없는 노드는 children 없음.
	expect(tree!.nodes.find((n) => n.id === "auth")!.children).toBeUndefined();
});

test("loadGraphTree: 자식 파일 누락 시 해당 노드만 children 생략(그레이스풀)", async () => {
	const tree = await loadGraphTree(rootFile, "r.json", async () => null);
	expect(tree).not.toBeNull();
	expect(tree!.nodes.find((n) => n.id === "ui")!.children).toBeUndefined();
});

test("loadGraphTree: 루트 불량 → null", async () => {
	expect(await loadGraphTree("not json", "r.json", readRel)).toBeNull();
	expect(
		await loadGraphTree(JSON.stringify({ version: 1 }), "r.json", readRel),
	).toBeNull();
});

test("coerce rejects bad envelope / refs / ids", () => {
	expect(() => coerceGraphLevelFile(null)).toThrow();
	expect(() => coerceGraphLevelFile({ version: 2 })).toThrow();
	// version 1(구 포맷) 거부.
	expect(() => coerceGraphLevelFile({ version: 1, sections: [] })).toThrow();
	// refs: comment 필수.
	expect(() =>
		coerceGraphLevelFile({
			version: 2,
			nodes: [{ id: "a", refs: [{ to: "b" }] }],
		}),
	).toThrow();
	// 파일 내 id 중복 거부.
	expect(() =>
		coerceGraphLevelFile({ version: 2, nodes: [{ id: "a" }, { id: "a" }] }),
	).toThrow();
});

test("coerce: 노드 표시 필드는 불투명하게 보존", () => {
	const ok = coerceGraphLevelFile({
		version: 2,
		nodes: [{ id: "a", 任意: "field", refs: [] }],
	});
	expect(ok.nodes[0]).toEqual({ id: "a", 任意: "field", refs: [] });
});

test("isSafeChildPath: traversal·절대경로 차단", () => {
	expect(isSafeChildPath("modules/ui.json")).toBe(true);
	expect(isSafeChildPath("modules/ui/Parser.json")).toBe(true);
	expect(isSafeChildPath("../etc/passwd.json")).toBe(false);
	expect(isSafeChildPath("modules/../../x.json")).toBe(false);
	expect(isSafeChildPath("/abs/x.json")).toBe(false);
	expect(isSafeChildPath("C:\\abs.json")).toBe(false);
	expect(isSafeChildPath("modules\\ui.json")).toBe(false);
	expect(isSafeChildPath("modules/ui")).toBe(false);
	expect(isSafeChildPath("")).toBe(false);
	expect(isSafeChildPath(42)).toBe(false);
});

test("unsafe children path rejects whole level", () => {
	expect(() =>
		coerceGraphLevelFile({
			version: 2,
			nodes: [{ id: "a", children: "../evil.json" }],
		}),
	).toThrow(/unsafe children/);
});

test("collectGraphChildFiles: 도달 가능한 자식만(고아 제외)", async () => {
	// modules/orphan.json 은 어떤 노드의 children 에도 없음 → 제외.
	const extra: Record<string, string> = {
		...files,
		"modules/orphan.json": "{}",
	};
	const rels = await collectGraphChildFiles(rootFile, async (rel) =>
		rel in extra ? (extra[rel] ?? null) : null,
	);
	expect(rels.sort()).toEqual(["modules/ui.json", "modules/ui/Parser.json"]);
});

test("collectGraphChildFiles: 루트 불량 → 빈 배열", async () => {
	expect(await collectGraphChildFiles("bad", readRel)).toEqual([]);
});

test("graphRefFile: 참조 코멘트에서 json 파일명 추출", () => {
	expect(graphRefFile("<!-- graph: 02-design-graph.json -->\n# 설계")).toBe(
		"02-design-graph.json",
	);
	expect(graphRefFile("앞문\n\n<!--graph: draft-graph.json-->\n본문")).toBe(
		"draft-graph.json",
	);
	expect(graphRefFile("# 설계\n\n참조 없음")).toBeUndefined();
	expect(graphRefFile("")).toBeUndefined();
});

test("graphRefFiles: 다중 참조를 문서 순서대로 추출(ADR-020)", () => {
	const md =
		"# 설계\n\n<!-- graph: module-deps.json -->\n본문\n\n<!--graph: data-flow.json-->\n끝";
	expect(graphRefFiles(md)).toEqual(["module-deps.json", "data-flow.json"]);
	// 중복도 그대로 나열(호출측이 유일성 검증) — 안전하지 않은 이름은 제외.
	expect(
		graphRefFiles("<!-- graph: a.json -->\n<!-- graph: a.json -->"),
	).toEqual(["a.json", "a.json"]);
	expect(graphRefFiles("<!-- graph: ../up.json -->")).toEqual([]);
	expect(graphRefFiles("<!-- graph: noext -->")).toEqual([]);
	expect(graphRefFiles("")).toEqual([]);
});

test("isSafeGraphName: .json 끝 단일 파일명만 허용", () => {
	expect(isSafeGraphName("module-deps.json")).toBe(true);
	expect(isSafeGraphName("02-design-graph.json")).toBe(true);
	expect(isSafeGraphName("noext")).toBe(false);
	expect(isSafeGraphName("..")).toBe(false);
	expect(isSafeGraphName("..x.json")).toBe(false);
	expect(isSafeGraphName("")).toBe(false);
	expect(isSafeGraphName(".json")).toBe(false);
});

test("graphDirNameFor", () => {
	expect(graphDirNameFor("draft-graph.json")).toBe("draft-graph");
	expect(graphDirNameFor("02-design-graph.json")).toBe("02-design-graph");
	expect(graphDirNameFor("module-deps.json")).toBe("module-deps");
});

// --- ADR-021: sequence·flowchart envelope ---

const seqOk = JSON.stringify({
	version: 2,
	type: "sequence",
	title: "로그인",
	participants: [
		{ id: "ui", name: "UI" },
		{ id: "auth", name: "Auth" },
	],
	body: [
		{ from: "ui", to: "auth", label: "요청" },
		{
			kind: "alt",
			label: "성공/실패",
			body: [
				{ from: "auth", to: "ui", label: "토큰", kind: "reply" },
				{
					kind: "loop",
					label: "재시도",
					body: [{ from: "ui", to: "auth", label: "다시" }],
				},
			],
		},
	],
});

const flowOk = JSON.stringify({
	version: 2,
	type: "flowchart",
	nodes: [
		{ id: "start", label: "시작", shape: "terminal" },
		{ id: "build", label: "빌드" },
		{ id: "check", label: "검사", shape: "decision" },
	],
	edges: [
		{ from: "start", to: "build" },
		{ from: "build", to: "check", label: "완료" },
	],
});

test("parseGraphSequenceFile: 유효 envelope + fragment 중첩 파싱", () => {
	const seq = parseGraphSequenceFile(seqOk);
	expect(seq?.participants).toHaveLength(2);
	expect(seq?.body).toHaveLength(2);
	const alt = seq?.body[1] as { kind: string; body: unknown[] };
	expect(alt.kind).toBe("alt");
	expect(alt.body).toHaveLength(2);
});

test("parseGraphSequenceFile: 불량 거부", () => {
	const base = JSON.parse(seqOk);
	expect(parseGraphSequenceFile("not json")).toBeNull();
	// version 불량 · type 불일치 · 참여자 없음 · 존재하지 않는 참여자 참조 · fragment kind 위반.
	expect(
		parseGraphSequenceFile(JSON.stringify({ ...base, version: 1 })),
	).toBeNull();
	expect(
		parseGraphSequenceFile(JSON.stringify({ ...base, type: "flowchart" })),
	).toBeNull();
	expect(
		parseGraphSequenceFile(JSON.stringify({ ...base, participants: [] })),
	).toBeNull();
	expect(
		parseGraphSequenceFile(
			JSON.stringify({
				...base,
				body: [{ from: "ui", to: "ghost", label: "?" }],
			}),
		),
	).toBeNull();
	expect(
		parseGraphSequenceFile(
			JSON.stringify({ ...base, body: [{ kind: "break", body: [] }] }),
		),
	).toBeNull();
	// 중복 참여자 id 거부.
	expect(
		parseGraphSequenceFile(
			JSON.stringify({
				...base,
				participants: [
					{ id: "ui", name: "A" },
					{ id: "ui", name: "B" },
				],
				body: [],
			}),
		),
	).toBeNull();
});

test("parseGraphFlowchartFile: 유효 envelope 파싱", () => {
	const flow = parseGraphFlowchartFile(flowOk);
	expect(flow?.nodes).toHaveLength(3);
	expect(flow?.edges).toHaveLength(2);
	expect(flow?.nodes[1]?.shape).toBeUndefined(); // shape 생략 허용
});

test("parseGraphFlowchartFile: 불량 거부", () => {
	const base = JSON.parse(flowOk);
	expect(parseGraphFlowchartFile("not json")).toBeNull();
	expect(
		parseGraphFlowchartFile(JSON.stringify({ ...base, type: "sequence" })),
	).toBeNull();
	// 노드 label 누락 · shape 열거형 위반 · 중복 id · 엣지의 미존재 노드 참조.
	expect(
		parseGraphFlowchartFile(
			JSON.stringify({
				...base,
				nodes: [{ id: "a" }],
				edges: [],
			}),
		),
	).toBeNull();
	expect(
		parseGraphFlowchartFile(
			JSON.stringify({
				...base,
				nodes: [{ id: "a", label: "A", shape: "hexagon" }],
				edges: [],
			}),
		),
	).toBeNull();
	expect(
		parseGraphFlowchartFile(
			JSON.stringify({
				...base,
				nodes: [
					{ id: "a", label: "A" },
					{ id: "a", label: "B" },
				],
				edges: [],
			}),
		),
	).toBeNull();
	expect(
		parseGraphFlowchartFile(
			JSON.stringify({ ...base, edges: [{ from: "start", to: "ghost" }] }),
		),
	).toBeNull();
});

test("parseAnyGraphKind: type 필드로 종류 판별 — type 없음 = 계층 트리(하위 호환)", () => {
	expect(parseAnyGraphKind(seqOk)).toBe("sequence");
	expect(parseAnyGraphKind(flowOk)).toBe("flowchart");
	expect(
		parseAnyGraphKind(JSON.stringify({ version: 2, nodes: [{ id: "a" }] })),
	).toBe("tree");
	// 유효하지 않으면 null — kind 추측 없음.
	expect(
		parseAnyGraphKind('{"version":2,"type":"sequence","participants":[]}'),
	).toBeNull();
	expect(parseAnyGraphKind('{"version":2,"type":"unknown"}')).toBeNull();
	expect(parseAnyGraphKind("bad")).toBeNull();
});
