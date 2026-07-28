// 우측 패널 — Design↔Feedback 루프 상태 + 이슈 + 어노테이션.
export default function SidePanel({ loop, issues }) {
	return (
		<aside className="side">
			<h4>Design ↔ Feedback 루프</h4>
			<div className="loop">
				<div className="row">
					<span>현재 라운드</span>
					<b>{loop.round}</b>
				</div>
				<div className="row">
					<span>클린 판정까지</span>
					<b>{loop.remaining}</b>
				</div>
			</div>

			<h4>Feedback 이슈</h4>
			{issues.map((it, i) => (
				<div key={i} className={`issue ${it.resolved ? "resolved" : ""}`}>
					{it.text}
				</div>
			))}

			<h4 style={{ marginTop: "var(--s4)" }}>어노테이션</h4>
			<p style={{ color: "var(--muted)" }}>아직 없음. 텍스트를 선택해 추가.</p>
		</aside>
	);
}
