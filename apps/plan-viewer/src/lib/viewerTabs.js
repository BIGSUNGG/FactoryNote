// 문서 뷰어 탭 순수 로직(ADR-031) — 탭 목록 배열 변환만 담당. 상태·렌더는 PlanPage·TabBar.
// md 문서 탭은 고정(pinned)이라 닫기 불가. 그래프 탭 id = `graph:<파일명>` → 파일당 탭 1개.
// 다중 문서: 주 문서 탭(id "doc") + 위성 문서 탭(id `doc:<파일명>`) — 문서 파일과 탭 1:1.
export const DOC_TAB = { id: "doc", label: "문서", pinned: true };

export const graphTabId = (file) => `graph:${file}`;

/** 위성 문서 탭 id — 문서 파일당 탭 1개(그래프 탭과 같은 1:1 규약). */
export const docTabId = (file) => `doc:${file}`;

/** 문서 탭 목록 — 주 문서 탭 1개 + 위성 문서 탭(파일 1:1, 모두 고정, 라벨=파일명). */
export function docTabs(mainLabel, satellites = []) {
	return [
		{ ...DOC_TAB, label: mainLabel ?? DOC_TAB.label },
		...satellites.map((s) => ({
			id: docTabId(s.file),
			label: s.file,
			docFile: s.file,
			pinned: true,
		})),
	];
}

/** 그래프 탭 열기 — 같은 파일 탭이 이미 있으면 복제 없이 원본 그대로(포커스는 호출 측). */
export function openGraphTab(tabs, graphFile) {
	const id = graphTabId(graphFile);
	if (tabs.some((t) => t.id === id)) return tabs;
	return [...tabs, { id, label: graphFile, graphFile }];
}

/** 탭 닫기 — 고정 탭은 닫히지 않음(원본 그대로 반환). */
export function closeTab(tabs, id) {
	const t = tabs.find((x) => x.id === id);
	if (!t || t.pinned) return tabs;
	return tabs.filter((x) => x.id !== id);
}

/** 닫기 후 포커스 — 닫힌 탭이 활성이었으면 그 위치의 이웃 탭(우측 우선, 없으면 좌측). */
export function nextActive(tabs, closedId, activeId) {
	if (activeId !== closedId) return activeId;
	const i = tabs.findIndex((t) => t.id === closedId);
	const next = tabs.filter((t) => t.id !== closedId);
	return (next[Math.min(i, next.length - 1)] ?? DOC_TAB).id;
}
