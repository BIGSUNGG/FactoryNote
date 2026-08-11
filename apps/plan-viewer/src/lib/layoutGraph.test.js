// 자동 배치 계약 자체체크 — 결정성 · 겹침 0 · 클래스 ⊂ 모듈 그룹 경계(ADR-016).
import { test, expect } from "bun:test";
import {
	CLASS_W,
	classNodeHeight,
	layoutClassSection,
	layoutModuleSection,
	layoutSection,
	MODULE_H,
	MODULE_W,
	sectionIsClass,
} from "./layoutGraph.js";

// --- 헬퍼: 사각 겹침 판정(경계 접촉은 허용 — 간격 상 겹침 아님) ---
const overlaps = (a, b) =>
	a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const moduleRects = (laid) =>
	laid.nodes.map((n) => ({
		id: n.id,
		x: n.position.x,
		y: n.position.y,
		w: MODULE_W,
		h: MODULE_H,
	}));

const moduleSection = {
	id: "mods",
	title: "모듈 관계도",
	nodes: [
		{ id: "ui", data: { label: "UI", layer: "API" } },
		{ id: "auth", data: { label: "Auth", layer: "Service" } },
		{ id: "user", data: { label: "UserSvc", layer: "Service" } },
		{ id: "repo", data: { label: "Repo", layer: "Repository" } },
		{ id: "db", data: { label: "DB", layer: "External" } },
		{ id: "cache", data: { label: "Cache", layer: "Util" } },
	],
	edges: [
		{ id: "ui->auth", source: "ui", target: "auth" },
		{ id: "ui->user", source: "ui", target: "user" },
		{ id: "auth->repo", source: "auth", target: "repo" },
		{ id: "user->repo", source: "user", target: "repo" },
		{ id: "user->cache", source: "user", target: "cache" },
		{ id: "repo->db", source: "repo", target: "db" },
	],
};

const classSection = {
	id: "classes",
	title: "클래스 구조도",
	nodes: [
		{ id: "g-auth", type: "group", label: "auth" },
		{ id: "g-user", type: "group", label: "user" },
		{
			id: "c-token",
			type: "class",
			name: "TokenService",
			parentNode: "g-auth",
			attrs: ["secret"],
			methods: ["issue()", "verify()"],
		},
		{
			id: "c-session",
			type: "class",
			name: "SessionStore",
			parentNode: "g-auth",
			attrs: [],
			methods: ["get()", "set()", "drop()"],
		},
		{
			id: "c-user",
			type: "class",
			name: "UserService",
			parentNode: "g-user",
			attrs: ["repo"],
			methods: ["find()"],
		},
		{ id: "c-orphan", type: "class", name: "Legacy", attrs: [], methods: [] },
	],
	edges: [
		{ id: "c-token->c-user", source: "c-token", target: "c-user" },
		{ id: "c-user->c-session", source: "c-user", target: "c-session" },
	],
};

test("sectionIsClass: 노드 타입으로 판별", () => {
	expect(sectionIsClass(moduleSection)).toBe(false);
	expect(sectionIsClass(classSection)).toBe(true);
	expect(sectionIsClass({ nodes: [] })).toBe(false);
});

test("모듈 배치: 노드 겹침 0 + 결정성(두 번 같은 좌표)", () => {
	const a = layoutModuleSection(moduleSection);
	const b = layoutModuleSection(moduleSection);
	expect(a.nodes.map((n) => [n.id, n.position])).toEqual(
		b.nodes.map((n) => [n.id, n.position]),
	);
	const rects = moduleRects(a);
	for (let i = 0; i < rects.length; i++)
		for (let j = i + 1; j < rects.length; j++)
			expect(overlaps(rects[i], rects[j])).toBe(false);
});

test("모듈 배치: layer 행 순서(API < Service < Repository < Util < External)", () => {
	const laid = layoutModuleSection(moduleSection);
	const y = Object.fromEntries(laid.nodes.map((n) => [n.id, n.position.y]));
	expect(y.ui).toBeLessThan(y.auth);
	expect(y.auth).toBeLessThan(y.repo);
	expect(y.repo).toBeLessThan(y.db);
	// 같은 layer(Service)는 같은 행.
	expect(y.auth).toBe(y.user);
});

test("모듈 배치: layer 없으면 관계 방향(위상) 행 — 소스가 위", () => {
	const sec = {
		id: "s",
		title: "t",
		nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
		edges: [
			{ id: "a->b", source: "a", target: "b" },
			{ id: "b->c", source: "b", target: "c" },
		],
	};
	const laid = layoutModuleSection(sec);
	const y = Object.fromEntries(laid.nodes.map((n) => [n.id, n.position.y]));
	expect(y.a).toBeLessThan(y.b);
	expect(y.b).toBeLessThan(y.c);
});

test("모듈 배치: 사이클이 있어도 결정적·겹침 0", () => {
	const sec = {
		id: "s",
		title: "t",
		nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
		edges: [
			{ id: "a->b", source: "a", target: "b" },
			{ id: "b->a", source: "b", target: "a" },
			{ id: "b->c", source: "b", target: "c" },
		],
	};
	const laid = layoutModuleSection(sec);
	const rects = moduleRects(laid);
	for (let i = 0; i < rects.length; i++)
		for (let j = i + 1; j < rects.length; j++)
			expect(overlaps(rects[i], rects[j])).toBe(false);
});

test("클래스 배치: 모든 클래스가 소속 모듈 그룹 경계 내부", () => {
	const laid = layoutClassSection(classSection);
	const groups = Object.fromEntries(
		laid.nodes
			.filter((n) => n.type === "modGroup")
			.map((g) => [
				g.id,
				{
					x: g.position.x,
					y: g.position.y,
					w: g.style.width,
					h: g.style.height,
				},
			]),
	);
	const raw = Object.fromEntries(
		classSection.nodes
			.filter((n) => (n.type ?? n.data?.type) === "class")
			.map((c) => [c.id, c]),
	);
	for (const n of laid.nodes.filter((n) => n.type === "cls")) {
		const parent = n.parentNode;
		if (!parent) {
			// 고아 클래스는 절대 좌표 — 유령 부모 없음만 확인.
			expect(raw[n.id].parentNode).toBeFalsy();
			continue;
		}
		const g = groups[parent];
		expect(g).toBeTruthy();
		const h = classNodeHeight(n.data);
		// 상대 좌표 → 절대 좌표로 환산 후 포함 검사.
		expect(n.position.x).toBeGreaterThanOrEqual(0);
		expect(n.position.y).toBeGreaterThanOrEqual(0);
		expect(n.position.x + CLASS_W).toBeLessThanOrEqual(g.w);
		expect(n.position.y + h).toBeLessThanOrEqual(g.h);
	}
});

test("클래스 배치: 그룹·클래스 전역 겹침 0(그룹↔그룹, 그룹↔고아)", () => {
	const laid = layoutClassSection(classSection);
	const rects = [];
	for (const n of laid.nodes) {
		if (n.type === "modGroup") {
			rects.push({
				id: n.id,
				x: n.position.x,
				y: n.position.y,
				w: n.style.width,
				h: n.style.height,
			});
		} else if (!n.parentNode) {
			rects.push({
				id: n.id,
				x: n.position.x,
				y: n.position.y,
				w: CLASS_W,
				h: classNodeHeight(n.data),
			});
		}
	}
	for (let i = 0; i < rects.length; i++)
		for (let j = i + 1; j < rects.length; j++)
			expect(overlaps(rects[i], rects[j])).toBe(false);
});

test("클래스 배치: 부모 그룹이 자식보다 먼저 나열(react-flow 요구)", () => {
	const laid = layoutClassSection(classSection);
	const idx = Object.fromEntries(laid.nodes.map((n, i) => [n.id, i]));
	for (const n of laid.nodes.filter((n) => n.parentNode)) {
		expect(idx[n.parentNode]).toBeLessThan(idx[n.id]);
	}
});

test("layoutSection: envelope 섹션 → 렌더 노드/엣지(빈 섹션 안전)", () => {
	const mod = layoutSection(moduleSection);
	expect(mod.isClass).toBe(false);
	expect(mod.nodes).toHaveLength(6);
	expect(mod.edges[0].markerEnd.type).toBe("arrowclosed");
	const cls = layoutSection(classSection);
	expect(cls.isClass).toBe(true);
	const empty = layoutSection({
		id: "e",
		title: "빈 섹션",
		nodes: [],
		edges: [],
	});
	expect(empty.nodes).toHaveLength(0);
	expect(empty.edges).toHaveLength(0);
});

test("position 입력이 있어도 무시 — 자동 배치가 유일한 좌표 출처", () => {
	const polluted = {
		...moduleSection,
		nodes: moduleSection.nodes.map((n, i) => ({
			...n,
			position: { x: 9999 * i, y: -500 },
			width: 1,
			height: 1,
		})),
	};
	const clean = layoutModuleSection(moduleSection);
	const laid = layoutModuleSection(polluted);
	expect(laid.nodes.map((n) => [n.id, n.position])).toEqual(
		clean.nodes.map((n) => [n.id, n.position]),
	);
});
