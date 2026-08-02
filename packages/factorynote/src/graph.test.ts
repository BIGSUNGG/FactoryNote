// GraphArtifact 파싱/검증 자체체크.
import { test, expect } from "bun:test";
import {
	coerceGraphArtifact,
	emptyGraphArtifact,
	parseGraphArtifact,
} from "./graph.ts";
import type { GraphArtifact } from "./types.ts";

const sample: GraphArtifact = {
	sections: [
		{
			id: "frontend",
			title: "프론트엔드 모듈",
			nodes: [
				{
					id: "UI",
					type: "module",
					position: { x: 0, y: 0 },
					data: { label: "UI", layer: "API" },
				},
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
