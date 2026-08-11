// 계층 그래프 트리 드릴다운 순수 로직 자체체크(ADR-018) — 토글·병합·참조 숨김.
import { test, expect } from "bun:test";
import {
	levelTitle,
	mergeChildLevels,
	refsToEdges,
	toggleSelect,
} from "./graphTree";

// 루트 레벨(모듈 2개, 각 모듈은 클래스 자식 레벨 보유).
const uiLevel = {
	file: "modules/ui.json",
	parentId: "ui",
	childLevel: "classes",
	nodes: [
		{
			id: "View",
			type: "class",
			name: "View",
			refs: [{ to: "AuthService", comment: "인증 요청" }],
		},
		{ id: "Router", type: "class", name: "Router" },
	],
};
const authLevel = {
	file: "modules/auth.json",
	parentId: "auth",
	childLevel: "classes",
	nodes: [{ id: "AuthService", type: "class", name: "AuthService" }],
};
const rootLevel = {
	file: "draft-graph.json",
	title: "모듈 관계도",
	childLevel: "modules",
	nodes: [
		{
			id: "ui",
			label: "UI",
			type: "module",
			children: uiLevel,
			refs: [{ to: "auth", comment: "인증 위임" }],
		},
		{ id: "auth", label: "Auth", type: "module", children: authLevel },
		{ id: "ext", label: "DB", type: "external" },
	],
};

test("toggleSelect: 추가 → 제거 토글, 순서 보존", () => {
	expect(toggleSelect([], "ui")).toEqual(["ui"]);
	expect(toggleSelect(["ui"], "auth")).toEqual(["ui", "auth"]);
	expect(toggleSelect(["ui", "auth"], "ui")).toEqual(["auth"]);
});

test("refsToEdges: 보이는 대상만 엣지, 미선택/미해결 참조 숨김", () => {
	// 루트 전체: ui->auth 보임, ui->ext 없음(ext 로의 참조 자체가 없음).
	const edges = refsToEdges(rootLevel.nodes);
	expect(edges).toEqual([
		{
			id: "ui->auth",
			source: "ui",
			target: "auth",
			data: { desc: "인증 위임" },
		},
	]);
	// auth 를 제외한 뷰: ui->auth 숨김.
	const edges2 = refsToEdges([rootLevel.nodes[0], rootLevel.nodes[2]]);
	expect(edges2).toEqual([]);
});

test("mergeChildLevels: 선택 없으면 null, 자식 없는 노드 선택도 null", () => {
	expect(mergeChildLevels(rootLevel, [])).toBeNull();
	expect(mergeChildLevels(rootLevel, ["ext"])).toBeNull();
});

test("mergeChildLevels: 단일 모듈 선택 → 그룹 없이 클래스만", () => {
	const merged = mergeChildLevels(rootLevel, ["ui"]);
	expect(merged).not.toBeNull();
	expect(merged.title).toBe("classes — UI");
	// 그룹 없음: nodes = 클래스 2개만.
	expect(merged.nodes.map((n) => n.id)).toEqual(["View", "Router"]);
	// 자식 패널 드릴다운 가능성 유지(클래스의 children 레벨).
	expect(merged.file).toBe("merged:ui");
});

test("mergeChildLevels: 다중 모듈 선택 → 병합 + 그룹 합성 + 크로스 참조 노출", () => {
	const merged = mergeChildLevels(rootLevel, ["ui", "auth"]);
	const ids = merged.nodes.map((n) => n.id);
	// 그룹 2 + 클래스 3.
	expect(ids).toEqual(["grp-ui", "grp-auth", "View", "Router", "AuthService"]);
	const groups = merged.nodes.filter((n) => n.type === "group");
	expect(groups.map((g) => g.label)).toEqual(["UI", "Auth"]);
	// 클래스는 소속 그룹 parentNode 를 가진다.
	expect(merged.nodes.find((n) => n.id === "View").parentNode).toBe("grp-ui");
	expect(merged.nodes.find((n) => n.id === "AuthService").parentNode).toBe(
		"grp-auth",
	);
	// 크로스 모듈 클래스 참조: View->AuthService 가 둘 다 보여 엣지로 변환.
	const edges = refsToEdges(merged.nodes);
	expect(edges).toEqual([
		{
			id: "View->AuthService",
			source: "View",
			target: "AuthService",
			data: { desc: "인증 요청" },
		},
	]);
});

test("mergeChildLevels: 크로스 참조 대상이 미선택 모듈이면 숨김", () => {
	const merged = mergeChildLevels(rootLevel, ["ui"]);
	// View->AuthService 참조가 있지만 AuthService 는 미선택 모듈(auth) 소속.
	expect(refsToEdges(merged.nodes)).toEqual([]);
});

test("mergeChildLevels: 임의 깊이 — 병합 레벨에서 재귀 드릴다운", () => {
	// 클래스 레벨에 자식(메서드) 레벨을 달고 병합 레벨에서 다시 드릴다운.
	const methodLevel = {
		file: "modules/ui/View.json",
		parentId: "View",
		childLevel: "methods",
		nodes: [{ id: "render", type: "method", label: "render()" }],
	};
	const withMethods = {
		...rootLevel,
		nodes: rootLevel.nodes.map((n) =>
			n.id === "ui"
				? {
						...n,
						children: {
							...uiLevel,
							nodes: uiLevel.nodes.map((c) =>
								c.id === "View" ? { ...c, children: methodLevel } : c,
							),
						},
					}
				: n,
		),
	};
	const classPanel = mergeChildLevels(withMethods, ["ui"]);
	const methodPanel = mergeChildLevels(classPanel, ["View"]);
	expect(methodPanel.title).toBe("methods — View");
	expect(methodPanel.nodes.map((n) => n.id)).toEqual(["render"]);
});

test("levelTitle: 루트 title 우선, 없으면 레벨명/기본값", () => {
	expect(levelTitle(rootLevel, 0)).toBe("모듈 관계도");
	expect(levelTitle({ file: "x", nodes: [] }, 0)).toBe("관계도");
	expect(levelTitle({ file: "x", childLevel: "classes", nodes: [] }, 1)).toBe(
		"classes",
	);
});
