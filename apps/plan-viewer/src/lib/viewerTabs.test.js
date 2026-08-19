// 문서 뷰어 탭 순수 로직 자체체크(ADR-031): 열기/중복 포커스/닫기/고정 탭 보호/포커스 이동.
import { expect, test } from "bun:test";
import {
	DOC_TAB,
	docTabId,
	docTabs,
	graphTabId,
	openGraphTab,
	closeTab,
	nextActive,
} from "./viewerTabs.js";

test("초기 = 고정 문서 탭 1개, 그래프 탭 열기로 추가", () => {
	expect(DOC_TAB.pinned).toBe(true);
	const tabs = openGraphTab([DOC_TAB], "a.json");
	expect(tabs.map((t) => t.id)).toEqual(["doc", "graph:a.json"]);
	expect(tabs[1].graphFile).toBe("a.json");
});

test("같은 그래프 재열기 = 복제 없이 기존 탭 그대로(포커스는 호출 측)", () => {
	const t1 = openGraphTab([DOC_TAB], "a.json");
	const t2 = openGraphTab(t1, "a.json");
	expect(t2).toBe(t1); // 원본 그대로 → 탭 복제 없음(그래프 파일당 1개)
	expect(t2.filter((t) => t.id === graphTabId("a.json"))).toHaveLength(1);
});

test("고정 문서 탭은 닫기 불가 — 닫기 시도해도 목록 그대로", () => {
	const tabs = openGraphTab([DOC_TAB], "a.json");
	expect(closeTab(tabs, DOC_TAB.id)).toBe(tabs);
	expect(closeTab(tabs, "nonexistent")).toBe(tabs);
});

test("docTabs — 주 탭 + 위성 문서 탭 파일 1:1, 라벨=파일명, 모두 고정", () => {
	const tabs = docTabs("draft.md", [
		{ file: "draft.requirements-scope.md", md: "# a" },
		{ file: "draft.scenario-acceptance.md", md: "# b" },
	]);
	expect(tabs.map((t) => t.id)).toEqual([
		"doc",
		docTabId("draft.requirements-scope.md"),
		docTabId("draft.scenario-acceptance.md"),
	]);
	expect(tabs.map((t) => t.label)).toEqual([
		"draft.md",
		"draft.requirements-scope.md",
		"draft.scenario-acceptance.md",
	]);
	expect(tabs.every((t) => t.pinned)).toBe(true);
	expect(tabs[1].docFile).toBe("draft.requirements-scope.md");
	// 위성 없음 = 주 탭 1개, 라벨 미지정 = 기본 "문서"
	expect(docTabs().map((t) => t.id)).toEqual(["doc"]);
	expect(docTabs()[0].label).toBe("문서");
});

test("그래프 탭 닫기 + 닫은 탭이 활성이면 이웃 탭으로 포커스 이동", () => {
	const tabs = openGraphTab(openGraphTab([DOC_TAB], "a.json"), "b.json");
	const closed = closeTab(tabs, graphTabId("b.json"));
	expect(closed.map((t) => t.id)).toEqual(["doc", "graph:a.json"]);
	// 닫은 탭이 활성이었으면 → 좌측 이웃
	expect(nextActive(tabs, graphTabId("b.json"), graphTabId("b.json"))).toBe(
		"graph:a.json",
	);
	// 다른 탭이 활성이면 → 포커스 유지
	expect(nextActive(tabs, graphTabId("b.json"), "doc")).toBe("doc");
	// 가운데 탭 닫기 → 우측 이웃 우선
	expect(nextActive(tabs, graphTabId("a.json"), graphTabId("a.json"))).toBe(
		"graph:b.json",
	);
});
