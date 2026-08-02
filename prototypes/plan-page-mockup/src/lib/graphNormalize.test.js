// graphNormalize 자체체크 — Stage 4 클래스 렌더링 회귀 가드.
// (에이전트 designPrompt 대로 온 type:"class" 노드가 레지스트리 키 cls 로 정규화되어
//  ClassNode 로 렌더 + 선택 가능해야. 이전엔 "class" 가 그대로 남아 깨졌다.)
import { test, expect } from "bun:test";
import {
	gridPos,
	normalizeEdge,
	normalizeNode,
	normalizeSections,
} from "./graphNormalize.js";

// GraphStage.jsx 의 NODE_TYPES_4 / NODE_TYPES_3 키와 동일해야(렌더링 가능).
const NODE_TYPES_4 = new Set(["modGroup", "cls"]);
const NODE_TYPES_3 = new Set(["module", "external"]);

test("Stage 4: agent class node (type:class) → registered cls + parent + data", () => {
	const agent = {
		id: "UserService",
		type: "class",
		name: "UserService",
		module: "Service",
		attrs: ["- repo: Repo"],
		methods: ["+ find()"],
		parentNode: "g-service",
	};
	const n = normalizeNode(agent, 0, 4);
	expect(n.type).toBe("cls");
	expect(NODE_TYPES_4.has(n.type)).toBe(true); // 레지스트리에 있어야 렌더됨
	expect(n.parentNode).toBe("g-service");
	expect(n.extent).toBe("parent");
	expect(n.data.name).toBe("UserService");
	expect(n.data.attrs).toEqual(["- repo: Repo"]);
});

test("Stage 4: agent group node (type:group) → modGroup + not selectable + style", () => {
	const n = normalizeNode(
		{ id: "g-api", type: "group", label: "API", width: 200, height: 120 },
		0,
		4,
	);
	expect(n.type).toBe("modGroup");
	expect(NODE_TYPES_4.has(n.type)).toBe(true);
	expect(n.selectable).toBe(false);
	expect(n.style.width).toBe(200);
});

test("Stage 4: class node without explicit type → cls default", () => {
	const n = normalizeNode(
		{ id: "c1", data: { name: "X", type: "class", parentNode: "g" } },
		0,
		4,
	);
	expect(n.type).toBe("cls");
});

test("Stage 3: module inferred from layer; both registered", () => {
	const ext = normalizeNode({ id: "DB", layer: "External" }, 0, 3);
	expect(ext.type).toBe("external");
	expect(NODE_TYPES_3.has(ext.type)).toBe(true);
	const mod = normalizeNode({ id: "Auth", layer: "Service", desc: "x" }, 1, 3);
	expect(mod.type).toBe("module");
	expect(NODE_TYPES_3.has(mod.type)).toBe(true);
});

test("position: assigned (grid) when missing, preserved when present", () => {
	const auto = normalizeNode({ id: "a", layer: "API" }, 0, 3);
	expect(auto.position).toEqual(gridPos(0));
	const fixed = normalizeNode(
		{ id: "b", layer: "API", position: { x: 9, y: 8 } },
		1,
		3,
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

test("normalizeSections: full Stage-4 multi-section agent JSON", () => {
	const sections = normalizeSections(
		[
			{
				id: "fe",
				title: "프론트",
				nodes: [
					{ id: "UI", type: "class", parentNode: "g" },
					{ id: "g", type: "group" },
				],
				edges: [],
			},
		],
		4,
	);
	expect(sections[0].nodes[0].type).toBe("cls");
	expect(sections[0].nodes[1].type).toBe("modGroup");
});
