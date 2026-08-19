// 탭 분할 레이아웃 렌더(ADR-032) — 분할 트리를 재귀 렌더하는 브라우저식 영역 뷰.
// leaf = TabBar + 탭 콘텐츠(hidden 토글) + 드래그 중 드롭 존 오버레이.
// split = 두 자식 + 드래그 리사이즈 divider. 상태는 PlanPage 가 소유.
// 드롭 판정(존 하이라이트·드롭)은 PlanPage 의 window 포인터 리스너가 담당(e.target 기반).
import TabBar from "./TabBar";

const ZONES = ["left", "right", "up", "down", "center"];

export default function SplitNode({
	node,
	renderTab,
	focusedPaneId,
	drag, // { paneId, tabId } | { graphFile } | null — 드래그 중이면 드롭 존 표시
	hoverZone, // { paneId, zone } | null — 표시 전용(판정은 PlanPage)
	onTabSelect, // (paneId, tabId)
	onTabClose, // (paneId, tabId)
	onTabDragStart, // (paneId, tabId)
	onTabContextMenu, // (event, paneId, tabId)
	onRatioChange, // (splitId, ratio)
}) {
	if (node.type === "leaf") {
		return (
			<div
				className={`split-leaf${node.id === focusedPaneId ? " focused" : ""}`}
				data-pane-id={node.id}
			>
				<TabBar
					tabs={node.tabs}
					activeId={node.activeId}
					draggingId={drag?.paneId === node.id ? drag.tabId : null}
					onSelect={(tabId) => onTabSelect(node.id, tabId)}
					onClose={(tabId) => onTabClose(node.id, tabId)}
					onContextMenu={
						onTabContextMenu
							? (e, tabId) => onTabContextMenu(e, node.id, tabId)
							: undefined
					}
					onTabDragStart={
						onTabDragStart
							? (tabId) => onTabDragStart(node.id, tabId)
							: undefined
					}
				/>
				<div className="split-leaf-body">
					{node.tabs.map((t) => (
						<div
							key={t.id}
							className={t.graphFile ? "graph-pane" : "doc-pane"}
							hidden={node.activeId !== t.id}
						>
							{renderTab(t)}
						</div>
					))}
					{/* 드래그 중 드롭 존 — 중앙=이동, 가장자리=해당 방향 분할.
					    하이라이트·드롭 판정은 PlanPage window 포인터 리스너(e.target). */}
					{drag && (
						<div className="split-zones" aria-hidden="true">
							{ZONES.map((zone) => (
								<div
									key={zone}
									data-zone={zone}
									className={`split-zone split-zone-${zone}${
										hoverZone?.paneId === node.id && hoverZone.zone === zone
											? " hover"
											: ""
									}`}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		);
	}
	// split — divider 드래그로 비율 조정(포인터 이벤트).
	const horizontal = node.dir === "h";
	const startResize = (e) => {
		e.preventDefault();
		const box = e.currentTarget.parentElement.getBoundingClientRect();
		const move = (ev) => {
			const ratio = horizontal
				? (ev.clientX - box.left) / box.width
				: (ev.clientY - box.top) / box.height;
			onRatioChange(node.id, ratio);
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};
	const [a, b] = node.children;
	// 양쪽 자식을 모두 ratio 기반 flexBasis 로 고정(grow 0) — children[1] 을
	// flexGrow:1 + 콘텐츠 기준 basis 로 키우던 비대칭 제거(ADR-032). 분할 즉시
	// 기본 50/50 이 유지되고 divider 드래그가 비율에 1:1 반영된다.
	const child = (c, isSecond) => (
		<div
			className="split-child"
			style={{
				flexBasis: isSecond
					? `${(1 - node.ratio) * 100}%`
					: `${node.ratio * 100}%`,
				flexGrow: 0,
				flexShrink: 1,
			}}
		>
			<SplitNode
				node={c}
				renderTab={renderTab}
				focusedPaneId={focusedPaneId}
				drag={drag}
				hoverZone={hoverZone}
				onTabSelect={onTabSelect}
				onTabClose={onTabClose}
				onTabDragStart={onTabDragStart}
				onTabContextMenu={onTabContextMenu}
				onRatioChange={onRatioChange}
			/>
		</div>
	);
	return (
		<div
			className={`split-node ${horizontal ? "split-h" : "split-v"}`}
			data-split-id={node.id}
		>
			{child(a, false)}
			<div
				className="split-divider"
				role="separator"
				aria-orientation={horizontal ? "vertical" : "horizontal"}
				onPointerDown={startResize}
			/>
			{child(b, true)}
		</div>
	);
}
