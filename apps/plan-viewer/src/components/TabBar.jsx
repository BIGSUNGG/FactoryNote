// 문서 뷰어 탭 바(ADR-031 · ADR-032): 영역 상단의 브라우저 스타일 탭.
// 고정 탭(pinned: md 문서)은 닫기 버튼이 렌더되지 않는다.
// 분할(ADR-032): 포인터 임계값 드래그(armDrag) + onContextMenu 우클릭 메뉴.
import { armDrag } from "../lib/armDrag";

export default function TabBar({
	tabs,
	activeId,
	onSelect,
	onClose,
	onContextMenu,
	onTabDragStart,
	draggingId,
}) {
	return (
		<div className="viewer-tabs" role="tablist" aria-label="문서 뷰어 탭">
			{tabs.map((t) => (
				<div
					key={t.id}
					role="tab"
					aria-selected={t.id === activeId}
					className={`viewer-tab${t.id === activeId ? " active" : ""}${
						t.pinned ? " pinned" : ""
					}${t.id === draggingId ? " dragging" : ""}`}
					title={t.label}
					onPointerDown={
						onTabDragStart
							? (e) => {
									if (e.target.closest(".viewer-tab-close")) return;
									if (e.button !== 0) return;
									armDrag(e, () => onTabDragStart(t.id));
								}
							: undefined
					}
					onClick={() => onSelect(t.id)}
					onContextMenu={
						onContextMenu ? (e) => onContextMenu(e, t.id) : undefined
					}
				>
					<span className="viewer-tab-label">{t.label}</span>
					{!t.pinned && (
						<button
							type="button"
							className="viewer-tab-close"
							aria-label={`${t.label} 탭 닫기`}
							onClick={(e) => {
								e.stopPropagation(); // 탭 선택으로 버블 금지
								onClose(t.id);
							}}
						>
							✕
						</button>
					)}
				</div>
			))}
		</div>
	);
}
