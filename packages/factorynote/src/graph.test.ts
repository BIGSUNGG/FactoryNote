// GraphArtifact 파싱/검증 + md↔json 참조 프로토콜 자체체크.
import { test, expect } from "bun:test";
import {
	coerceGraphArtifact,
	emptyGraphArtifact,
	graphJsonNameFor,
	graphRefFile,
	parseGraphArtifact,
} from "./graph.ts";
import type { GraphArtifact } from "./types.ts";

const sample: GraphArtifact = {
	sections: [
		{
			id: "frontend",
			title: "프론트엔드 모듈",
			nodes: [
				{ id: "UI", type: "module", data: { label: "UI", layer: "API" } },
			],
			edges: [
				{ id: "UI->API", source: "UI", target: "API", data: { desc: "호출" } },
			],
		},
		{
			id: "backend",
			title: "백엔드 모듈",
			nodes: [
				{ id: "API", type: "module", data: { label: "API", layer: "API" } },
				{
					id: "DB",
					type: "external",
					data: { label: "DB", layer: "External" },
				},
			],
			edges: [],
		},
	],
};

test("emptyGraphArtifact", () => {
	expect(emptyGraphArtifact()).toEqual({ sections: [] });
});

test("parse round-trip preserves multi-section structure", () => {
	const back = parseGraphArtifact(JSON.stringify(sample));
	expect(back).not.toBeNull();
	expect(back!.sections).toHaveLength(2);
	expect(back!.sections[0]?.id).toBe("frontend");
	expect(back!.sections[1]?.title).toBe("백엔드 모듈");
	expect(back!.sections[0]?.nodes[0]?.data).toEqual({
		label: "UI",
		layer: "API",
	});
});

test("parse returns null on invalid JSON / shape", () => {
	expect(parseGraphArtifact("not json")).toBeNull();
	expect(parseGraphArtifact(JSON.stringify({ sections: "x" }))).toBeNull();
});

test("coerce rejects bad envelope", () => {
	expect(() => coerceGraphArtifact(null)).toThrow();
	expect(() => coerceGraphArtifact({})).toThrow();
	expect(() => coerceGraphArtifact({ sections: "x" })).toThrow();
	expect(() => coerceGraphArtifact({ sections: [{ id: 1 }] })).toThrow();
});

test("coerce accepts nodes/edges internals opaquely", () => {
	const ok = coerceGraphArtifact({
		sections: [{ id: "s", title: "S", nodes: [{ 任意: "field" }], edges: [] }],
	});
	expect(ok.sections[0]?.nodes[0]).toEqual({ 任意: "field" });
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

test("graphJsonNameFor: md 파일명 → 동반 json 파일명", () => {
	expect(graphJsonNameFor("02-design.md")).toBe("02-design-graph.json");
	expect(graphJsonNameFor("draft.md")).toBe("draft-graph.json");
	expect(graphJsonNameFor("03-implementation-plan.md")).toBe(
		"03-implementation-plan-graph.json",
	);
});
