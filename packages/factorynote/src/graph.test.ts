// GraphArtifact 파싱/검증 자체체크.
import { test, expect } from "bun:test";
import {
	applyStructureToMarkdown,
	coerceGraphArtifact,
	emptyGraphArtifact,
	parseDesignMarkdown,
	parseGraphArtifact,
	serializeDesignMarkdown,
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

test("parseDesignMarkdown: 구조 펜스 → structure, 나머지 → prose", () => {
	const md =
		"# 설계\n\n## 구조\n\n```factorynote-graph\n" +
		JSON.stringify(sample) +
		"\n```\n\n## 아키텍처 설명\n\n계층 분리.";
	const { structure, prose } = parseDesignMarkdown(md);
	expect(structure.sections).toHaveLength(2);
	expect(structure.sections[0]?.id).toBe("frontend");
	expect(prose).toContain("# 설계");
	expect(prose).toContain("계층 분리");
	expect(prose).not.toContain("factorynote-graph");
});

test("parseDesignMarkdown: 펜스 없으면 빈 구조 + 전체 md 가 prose", () => {
	const { structure, prose } = parseDesignMarkdown("# 문서\n\n본문");
	expect(structure.sections).toHaveLength(0);
	expect(prose).toBe("# 문서\n\n본문");
});

test("serializeDesignMarkdown 왕복: parse(serialize(x)) === x", () => {
	const parts = { structure: sample, prose: "# 설계\n\n## 아키텍처 설명\n\n디자인 근거." };
	const back = parseDesignMarkdown(serializeDesignMarkdown(parts));
	expect(back.structure).toEqual(sample);
	expect(back.prose).toBe(parts.prose);
});

test("applyStructureToMarkdown: 펜스만 치환, prose 보존", () => {
	const md =
		"# 설계\n\n```factorynote-graph\n" +
		JSON.stringify({
			sections: [{ id: "x", title: "X", nodes: [], edges: [] }],
		}) +
		"\n```\n\n## 아키텍처 설명\n\n중요.";
	const { structure, prose } = parseDesignMarkdown(
		applyStructureToMarkdown(md, sample),
	);
	expect(structure).toEqual(sample);
	expect(prose).toContain("# 설계");
	expect(prose).toContain("중요.");
	expect(prose).not.toContain("factorynote-graph");
});

test("applyStructureToMarkdown: 펜스 없으면 추가", () => {
	const { structure, prose } = parseDesignMarkdown(
		applyStructureToMarkdown("# 문서\n\n본문", sample),
	);
	expect(structure).toEqual(sample);
	expect(prose).toBe("# 문서\n\n본문");
});
