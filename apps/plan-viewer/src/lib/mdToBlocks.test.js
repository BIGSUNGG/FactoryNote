// mdToBlocks 자체체크 — 그래프는 `<!-- graph: <파일명> -->` 참조 블록(ADR-016).
import { test, expect } from "bun:test";
import { mdToBlocks } from "./mdToBlocks.js";

test("graph 참조 코멘트 → graph block(graphFile)", () => {
	const md = "<!-- graph: 02-design-graph.json -->\n# 설계\n\n본문.\n";
	const blocks = mdToBlocks(md);
	const g = blocks.find((b) => b.type === "graph");
	expect(g).toBeTruthy();
	expect(g.graphFile).toBe("02-design-graph.json");
});

test("참조가 문서 중간에 있어도 블록 순서 보존", () => {
	const md =
		"# 구현 계획\n\n도입.\n\n<!-- graph: 03-implementation-plan-graph.json -->\n\n맺음.\n";
	const blocks = mdToBlocks(md);
	const gi = blocks.findIndex((b) => b.type === "graph");
	expect(gi).toBeGreaterThan(0);
	expect(blocks[gi].graphFile).toBe("03-implementation-plan-graph.json");
	expect(blocks.filter((b) => b.type === "paragraph")).toHaveLength(2);
});

test("다중 그래프 참조 → 각 위치에 별도 블록(ADR-020)", () => {
	const md =
		"# 설계\n\n<!-- graph: module-deps.json -->\n\n설명 A.\n\n<!-- graph: data-flow.json -->\n\n설명 B.\n";
	const blocks = mdToBlocks(md);
	const graphs = blocks.filter((b) => b.type === "graph");
	expect(graphs).toHaveLength(2);
	expect(graphs[0].graphFile).toBe("module-deps.json");
	expect(graphs[1].graphFile).toBe("data-flow.json");
	// 두 그래프 블록 사이에 본문 단락 유지 — 참조 위치 인라인 렌더링 보장.
	const seq = blocks.map((b) => b.type);
	expect(seq.indexOf("graph")).toBeLessThan(seq.lastIndexOf("graph"));
	expect(seq.slice(seq.indexOf("graph"), seq.lastIndexOf("graph"))).toContain(
		"paragraph",
	);
});

test("인라인 코드 펜스는 전부 code 블록(그래프 특례 없음)", () => {
	const md =
		"텍스트\n\n```js\nconsole.log(1)\n```\n\n```some-legacy-fence\n{}\n```\n";
	const blocks = mdToBlocks(md);
	expect(blocks.some((b) => b.type === "graph")).toBe(false);
	expect(blocks.filter((b) => b.type === "code")).toHaveLength(2);
});

test("참조 없으면 graph 블록 없음", () => {
	const blocks = mdToBlocks("# 문서\n\n본문만.");
	expect(blocks.some((b) => b.type === "graph")).toBe(false);
});
