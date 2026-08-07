// mdToBlocks 자체체크 — factorynote-graph 펜스 인식 + md↔그래프 왕복 직렬화.
import { test, expect } from "bun:test";
import { mdToBlocks, replaceGraphFence } from "./mdToBlocks.js";

const fence = (body) => "```factorynote-graph\n" + body + "\n```";

test("factorynote-graph fence → graph block with sections + fenceIndex", () => {
	const md =
		"# 설계\n\n본문.\n\n" +
		fence(
			JSON.stringify({
				sections: [{ id: "m", title: "모듈", nodes: [{ id: "A" }], edges: [] }],
			}),
		) +
		"\n";
	const blocks = mdToBlocks(md);
	const g = blocks.find((b) => b.type === "graph");
	expect(g).toBeTruthy();
	expect(g.fenceIndex).toBe(0);
	expect(Array.isArray(g.sections)).toBe(true);
	expect(g.sections[0]?.id).toBe("m");
	// 일반 코드 펜스는 여전히 code 블록.
	const md2 = "텍스트\n\n```js\nconsole.log(1)\n```\n";
	expect(mdToBlocks(md2).some((b) => b.type === "code")).toBe(true);
	expect(mdToBlocks(md2).some((b) => b.type === "graph")).toBe(false);
});

test("multiple graph fences get increasing fenceIndex", () => {
	const md =
		fence(
			JSON.stringify({
				sections: [{ id: "a", title: "A", nodes: [], edges: [] }],
			}),
		) +
		"\n\n중간 본문\n\n" +
		fence(
			JSON.stringify({
				sections: [{ id: "b", title: "B", nodes: [], edges: [] }],
			}),
		) +
		"\n";
	const graphs = mdToBlocks(md).filter((b) => b.type === "graph");
	expect(graphs).toHaveLength(2);
	expect(graphs[0].fenceIndex).toBe(0);
	expect(graphs[1].fenceIndex).toBe(1);
	expect(graphs[0].sections[0].id).toBe("a");
	expect(graphs[1].sections[0].id).toBe("b");
});

test("malformed graph fence falls back to code block (no crash)", () => {
	const md = "```factorynote-graph\nnot json\n```\n";
	const blocks = mdToBlocks(md);
	expect(blocks.some((b) => b.type === "graph")).toBe(false);
	expect(blocks.some((b) => b.type === "code")).toBe(true);
});

test("replaceGraphFence updates only the target fence, preserves the rest (idempotent)", () => {
	const f0 = JSON.stringify({
		sections: [{ id: "m", title: "모듈", nodes: [{ id: "A" }], edges: [] }],
	});
	const f1 = JSON.stringify({
		sections: [{ id: "c", title: "클래스", nodes: [], edges: [] }],
	});
	const md = `# 설계\n\n본문 설명입니다.\n\n${fence(f0)}\n\n또 다른 문단.\n\n${fence(f1)}\n`;

	const edited = JSON.stringify({
		sections: [
			{
				id: "m",
				title: "모듈(편집)",
				nodes: [{ id: "A" }, { id: "B" }],
				edges: [],
			},
		],
	});
	const md2 = replaceGraphFence(md, 0, edited);

	// fence 0 만 변경되고 fence 1 + 나머지 서사는 바이트 불변.
	expect(md2).toContain('"모듈(편집)"');
	expect(md2).toContain('"클래스"');
	expect(md2).toContain("본문 설명입니다.");
	expect(md2).toContain("또 다른 문단.");
	// fence 1 의 원본 JSON 이 그대로 보존되어야 한다.
	expect(md2).toContain(f1);

	// 재파싱 시 fence 0 의 편집 결과가 정합하게 읽힌다(왕복 정합).
	const re = mdToBlocks(md2).find(
		(b) => b.type === "graph" && b.fenceIndex === 0,
	);
	expect(re.sections[0].title).toBe("모듈(편집)");
	expect(re.sections[0].nodes).toHaveLength(2);
});

test("replaceGraphFence out-of-range index returns original md unchanged", () => {
	const md =
		fence(
			JSON.stringify({
				sections: [{ id: "x", title: "X", nodes: [], edges: [] }],
			}),
		) + "\n";
	const edited = JSON.stringify({ sections: [] });
	expect(replaceGraphFence(md, 9, edited)).toBe(md);
});
