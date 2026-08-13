// 좌측 사이드바 — 작성된 계획(현재 Stage 산출물)의 목차만.
// activeId(scroll-spy) 가 보고한 현재 헤딩을 강조. 보고 전(null)엔 첫 항목.
// 항목 클릭 → 본문(.doc)의 해당 블록으로 스크롤 이동.
export default function Toc({ items, activeId }) {
	const scrollTo = (id) => {
		const el = document.querySelector(`[data-block-id="${id}"]`);
		el?.scrollIntoView({ behavior: "smooth", block: "start" });
	};
	return (
		<aside className="toc">
			<h4>목차</h4>
			{items.map((it, i) => {
				const cur = activeId == null ? i === 0 : it.id === activeId;
				return (
					<a
						key={i}
						className={cur ? "cur" : ""}
						onClick={() => scrollTo(it.id)}
					>
						{it.label}
					</a>
				);
			})}
		</aside>
	);
}
