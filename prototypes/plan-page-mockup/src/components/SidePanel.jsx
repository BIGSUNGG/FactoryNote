// 우측 패널 — 사용자 검토 코멘트 큐 + Design↔Feedback 루프 + 어노테이션.
export default function SidePanel({ loop, issues, comments }) {
	const pending = comments.filter((c) => !c.applied);

	return (
		<aside className="side">
			<h4>
				내 검토 코멘트
				{pending.length > 0 && (
					<span className="count"> ({pending.length})</span>
				)}
			</h4>

			{pending.length === 0 ? (
				<p style={{ color: "var(--muted)", marginBottom: "var(--s4)" }}>
					항목의 💬 버튼으로 코멘트를 남기면 여기에 쌓입니다. 하단{" "}
					<b>수정 지시</b>로 한 번에 반영됩니다.
				</p>
			) : (
				<div className="review-comments">
					{pending.map((c) => (
						<div key={c.id} className="review-comment">
							<span className="rc-target">{c.targetId}</span>
							{c.text}
						</div>
					))}
				</div>
			)}

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
