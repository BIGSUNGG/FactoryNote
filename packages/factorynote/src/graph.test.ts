// 그래프 트리(계층 그래프) 파싱/검증 + md↔json 참조 프로토콜 자체체크(ADR-018).
import { test, expect } from "bun:test";
import {
	collectGraphChildFiles,
	coerceGraphLevelFile,
	graphDirNameFor,
	graphJsonNameFor,
	graphRefFile,
	isSafeChildPath,
	loadGraphTree,
	parseGraphLevelFile,
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

test("graphJsonNameFor / graphDirNameFor", () => {
	expect(graphJsonNameFor("02-design.md")).toBe("02-design-graph.json");
	expect(graphJsonNameFor("draft.md")).toBe("draft-graph.json");
	expect(graphDirNameFor("draft-graph.json")).toBe("draft-graph");
	expect(graphDirNameFor("02-design-graph.json")).toBe("02-design-graph");
});
