// 문서 뷰어 탭 바(ADR-031) — 문서 섹션 상단의 브라우저 스타일 탭.
// 고정 탭(pinned: md 문서)은 닫기 버튼이 렌더되지 않는다.
export default function TabBar({ tabs, activeId, onSelect, onClose }) {
	return (
		<div className="viewer-tabs" role="tablist" aria-label="문서 뷰어 탭">
			{tabs.map((t) => (
				<div
					key={t.id}
					role="tab"
					aria-selected={t.id === activeId}
					className={`viewer-tab${t.id === activeId ? " active" : ""}${
						t.pinned ? " pinned" : ""
					}`}
					title={t.label}
					onClick={() => onSelect(t.id)}
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
