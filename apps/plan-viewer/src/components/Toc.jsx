// 좌측 사이드바 — 작성된 계획(현재 Stage 산출물)의 목차만.
export default function Toc({ items }) {
	return (
		<aside className="toc">
			<h4>목차</h4>
			{items.map((it, i) => (
				<a key={i} className={it.cur ? "cur" : ""}>
					{it.label}
				</a>
			))}
		</aside>
	);
}
