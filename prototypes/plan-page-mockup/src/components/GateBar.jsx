// 하단 고정 게이트 바 — 확정/수정/정정 3액션. (목업: 클릭 동작 없음)
export default function GateBar({ stage, label }) {
	return (
		<div className="gate">
			<span className="label">
				Stage {stage} 게이트 — <b>{label}</b> 산출물 검토
			</span>
			<div className="spacer" />
			<button className="btn">← 정정 (이전 Stage)</button>
			<button className="btn secondary">✎ 수정 지시</button>
			<button className="btn primary">✓ 확정 → Stage {stage + 1}</button>
		</div>
	);
}
