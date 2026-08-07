// designMd.js 파싱/직렬화 회귀 가드 — Stage 2 md 단일진실(F2) + 포맷 편차 무경화.
import { test, expect } from "bun:test";
import {
	parseDesignMarkdown,
	serializeDesignMarkdown,
	applyStructureToMarkdown,
} from "./designMd.js";
import { normalizeSections, sectionIsClass } from "./graphNormalize.js";

test("factorynote-graph fence parses sections + prose 분리", () => {
	const md =
		"# S2\n\n## 구조\n\n```factorynote-graph\n" +
		JSON.stringify({
			sections: [{ id: "m", title: "모듈", nodes: [], edges: [] }],
		}) +
		"\n```\n\n## 설명\n계층.\n";
	const r = parseDesignMarkdown(md);
	expect(r.structure.sections.length).toBe(1);
	expect(r.structure.sections[0].id).toBe("m");
	expect(r.prose).toContain("계층");
	expect(r.prose).not.toContain("factorynote-graph");
});

test("후행 쉼표/단행 주석이 섞인 JSON 도 무경화 파싱", () => {
	const md =
		"```factorynote-graph\n" +
		'{\n  // 주석\n  "sections": [\n    { "id": "m", "title": "M", "nodes": [], "edges": [], }\n  ]\n}\n' +
		"```";
	expect(parseDesignMarkdown(md).structure.sections.length).toBe(1);
});

test("factorynote-graph 펜스가 없으면 ```json 펜스로 fallback", () => {
	const md =
		"## 구조\n\n```json\n" +
		JSON.stringify({
			sections: [{ id: "m", title: "M", nodes: [], edges: [] }],
		}) +
		"\n```\n\n설명.";
	expect(parseDesignMarkdown(md).structure.sections.length).toBe(1);
});

test("펜스 전무 → 빈 구조, prose = 전체 md", () => {
	const md = "# S2\n\n설명만 있는 산출물.";
	const r = parseDesignMarkdown(md);
	expect(r.structure.sections.length).toBe(0);
	expect(r.prose).toContain("설명만");
});

test("serialize → parse 왕복 일관성", () => {
	const structure = {
		sections: [{ id: "m", title: "M", nodes: [], edges: [] }],
	};
	const md = serializeDesignMarkdown({ structure, prose: "설명" });
	const back = parseDesignMarkdown(md);
	expect(back.structure.sections[0].id).toBe("m");
	expect(back.prose).toContain("설명");
});

test("applyStructureToMarkdown 가 prose 보존하며 구조만 치환", () => {
	const orig =
		"# S2\n\n## 구조\n\n```factorynote-graph\n" +
		JSON.stringify({
			sections: [{ id: "old", title: "O", nodes: [], edges: [] }],
		}) +
		"\n```\n\n## 설명\n보존되어야.\n";
	const next = applyStructureToMarkdown(orig, {
		sections: [{ id: "new", title: "N", nodes: [], edges: [] }],
	});
	const r = parseDesignMarkdown(next);
	expect(r.structure.sections[0].id).toBe("new");
	expect(r.prose).toContain("보존되어야");
});

test("designPrompt 형태(bare 모듈 노드) md → parse+normalize → react-flow 렌더 가능 노드", () => {
	// designPrompt 가 에이전트에게 지시하는 그대로의 모듈 섹션(data 래핑 없는 bare 노드).
	const md =
		"# S2\n\n## 구조\n\n```factorynote-graph\n" +
		JSON.stringify({
			sections: [
				{
					id: "modules",
					title: "모듈 관계도",
					nodes: [
						{ id: "API", label: "API Gateway", layer: "API", desc: "진입" },
						{ id: "SVC", label: "서비스", layer: "Service", desc: "비즈니스" },
					],
					edges: [
						{
							id: "API->SVC",
							source: "API",
							target: "SVC",
							data: { desc: "호출" },
						},
					],
				},
			],
		}) +
		"\n```\n\n## 설명\n계층.\n";
	const parsed = parseDesignMarkdown(md);
	const secs = normalizeSections(parsed.structure.sections);
	expect(secs.length).toBe(1);
	expect(sectionIsClass(secs[0])).toBe(false);
	const n0 = secs[0].nodes[0];
	expect(n0.id).toBe("API");
	expect(n0.type).toBe("module"); // NODE_TYPES_3 레지스트리 키
	expect(n0.position).toBeTruthy();
	expect(n0.data.label).toBe("API Gateway");
	expect(secs[0].edges[0].source).toBe("API");
	expect(secs[0].edges[0].target).toBe("SVC");
});

test("sections 래퍼 없는 bare 섹션 객체도 1개 섹션으로 수용", () => {
	// 에이전트가 흔히 저지르는 실수: {sections:[...]} 래퍼 없이 섹션 객체만 넣는 경우.
	const md =
		"```factorynote-graph\n" +
		JSON.stringify({
			id: "modules",
			title: "모듈 관계도",
			nodes: [],
			edges: [],
		}) +
		"\n```";
	const r = parseDesignMarkdown(md);
	expect(r.structure.sections.length).toBe(1);
	expect(r.structure.sections[0].id).toBe("modules");
});
