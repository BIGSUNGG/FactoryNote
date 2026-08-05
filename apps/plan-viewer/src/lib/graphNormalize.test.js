// graphNormalize 자체체크 — 종류 판별이 노드 타입 기반(per-node) 임을 검증.
// 병합된 Stage 2 는 한 페이지에 모듈 섹션과 클래스 섹션이 섞여 있고,
// 각 노드의 type/data.type 만으로 modGroup/cls/module/external 이 정해져야 한다.
import { test, expect } from "bun:test";
import {
	gridPos,
	normalizeEdge,
	normalizeNode,
	normalizeSections,
	sectionIsClass,
} from "./graphNormalize.js";

// GraphStage.jsx 의 NODE_TYPES_4 / NODE_TYPES_3 키와 동일해야(렌더링 가능).
const NODE_TYPES_4 = new Set(["modGroup", "cls"]);
const NODE_TYPES_3 = new Set(["module", "external"]);

test("class node (type:class) → registered cls + parent + data", () => {
	const agent = {
		id: "UserService",
		type: "class",
		name: "UserService",
		module: "Service",
		attrs: ["- repo: Repo"],
		methods: ["+ find()"],
		parentNode: "g-service",
	};
	const n = normalizeNode(agent, 0);
	expect(n.type).toBe("cls");
	expect(NODE_TYPES_4.has(n.type)).toBe(true); // 레지스트리에 있어야 렌더됨
	expect(n.parentNode).toBe("g-service");
	expect(n.extent).toBe("parent");
	expect(n.data.name).toBe("UserService");
	expect(n.data.attrs).toEqual(["- repo: Repo"]);
});

test("group node (type:group) → modGroup + not selectable + style", () => {
	const n = normalizeNode(
		{ id: "g-api", type: "group", label: "API", width: 200, height: 120 },
		0,
	);
	expect(n.type).toBe("modGroup");
	expect(NODE_TYPES_4.has(n.type)).toBe(true);
	expect(n.selectable).toBe(false);
	expect(n.style.width).toBe(200);
});

test("class node without explicit type but data.type:class → cls", () => {
	const n = normalizeNode({ id: "c1", data: { name: "X", type: "class" } }, 0);
	expect(n.type).toBe("cls");
});

test("module node inferred from layer; both registered", () => {
	const ext = normalizeNode({ id: "DB", layer: "External" }, 0);
	expect(ext.type).toBe("external");
	expect(NODE_TYPES_3.has(ext.type)).toBe(true);
	const mod = normalizeNode({ id: "Auth", layer: "Service", desc: "x" }, 1);
	expect(mod.type).toBe("module");
	expect(NODE_TYPES_3.has(mod.type)).toBe(true);
});

test("position: assigned (grid) when missing, preserved when present", () => {
	const auto = normalizeNode({ id: "a", layer: "API" }, 0);
	expect(auto.position).toEqual(gridPos(0));
	const fixed = normalizeNode(
		{ id: "b", layer: "API", position: { x: 9, y: 8 } },
		1,
	);
	expect(fixed.position).toEqual({ x: 9, y: 8 });
});

test("normalizeEdge: id derived, desc coerced", () => {
	const e = normalizeEdge({ source: "A", target: "B", data: { desc: "x" } });
	expect(e.id).toBe("A->B");
	expect(e.data.desc).toBe("x");
	const e2 = normalizeEdge({ id: "k", source: "A", target: "B" });
	expect(e2.id).toBe("k");
	expect(e2.data.desc).toBe("");
});

test("normalizeSections: mixed module + class sections in one artifact", () => {
	const sections = normalizeSections([
		{
			id: "modules",
			title: "모듈 관계도",
			nodes: [
				{ id: "Auth", layer: "Service" },
				{ id: "DB", layer: "External" },
			],
			edges: [],
		},
		{
			id: "classes",
			title: "클래스 구조도",
			nodes: [
				{ id: "g", type: "group" },
				{ id: "svc", type: "class", parentNode: "g" },
			],
			edges: [],
		},
	]);
	// 모듈 섹션 → module/external
	expect(sections[0].nodes[0].type).toBe("module");
	expect(sections[0].nodes[1].type).toBe("external");
	// 클래스 섹션 → modGroup/cls
	expect(sections[1].nodes[0].type).toBe("modGroup");
	expect(sections[1].nodes[1].type).toBe("cls");
});

test("sectionIsClass: class section true, module/empty section false", () => {
	expect(sectionIsClass({ nodes: [{ type: "group" }] })).toBe(true);
	expect(sectionIsClass({ nodes: [{ type: "class" }] })).toBe(true);
	expect(sectionIsClass({ nodes: [{ type: "module" }] })).toBe(false);
	expect(sectionIsClass({ nodes: [] })).toBe(false); // 빈 섹션 = 모듈 기본
	expect(sectionIsClass({})).toBe(false);
});
