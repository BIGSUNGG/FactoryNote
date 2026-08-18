// 탭 분할 레이아웃 렌더(ADR-032) — 분할 트리를 재귀 렌더하는 브라우저식 영역 뷰.
// leaf = TabBar + 탭 콘텐츠(hidden 토글) + 드래그 중 드롭 존 오버레이.
// split = 두 자식 + 드래그 리사이즈 divider. 상태는 PlanPage 가 소유.
import TabBar from "./TabBar";

const ZONES = ["left", "right", "up", "down", "center"];

export default function SplitNode({
	node,
	renderTab,
	focusedPaneId,
	drag, // { paneId, tabId } | null — 드래그 중이면 드롭 존 표시
	hoverZone, // { paneId, zone } | null
	setHoverZone,
	onDropZone, // (paneId, zone) — zone: left|right|up|down|center
	onTabSelect, // (paneId, tabId)
	onTabClose, // (paneId, tabId)
	onTabDragStart, // (paneId, tabId)
	onTabDragEnd,
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
					onTabDragEnd={onTabDragEnd}
				/>
				<div className="split-leaf-body">
					{node.tabs.map((t) => (
						<div
							key={t.id}
							className={t.id === "doc" ? "doc-pane" : "graph-pane"}
							hidden={node.activeId !== t.id}
						>
							{renderTab(t)}
						</div>
					))}
					{/* 드래그 중 드롭 존 — 중앙=이동, 가장자리=해당 방향 분할 */}
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
									onDragOver={(e) => {
										e.preventDefault();
										setHoverZone({ paneId: node.id, zone });
									}}
									onDrop={(e) => {
										e.preventDefault();
										onDropZone(node.id, zone);
									}}
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
	const child = (c, grow) => (
		<div
			className="split-child"
			style={grow ? { flexGrow: 1 } : { flexBasis: `${node.ratio * 100}%` }}
		>
			<SplitNode
				node={c}
				renderTab={renderTab}
				focusedPaneId={focusedPaneId}
				drag={drag}
				hoverZone={hoverZone}
				setHoverZone={setHoverZone}
				onDropZone={onDropZone}
				onTabSelect={onTabSelect}
				onTabClose={onTabClose}
				onTabDragStart={onTabDragStart}
				onTabDragEnd={onTabDragEnd}
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
