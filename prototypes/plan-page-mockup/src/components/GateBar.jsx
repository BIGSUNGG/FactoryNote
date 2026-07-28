// 하단 고정 게이트 바 — 확정 / 수정 지시 / 정정.
// '수정 지시'는 pending 코멘트가 있을 때만 활성화, 클릭 시 일괄 적용.
export default function GateBar({ stage, label, pendingCount, onApply }) {
	return (
		<div className="gate">
			<span className="label">
				Stage {stage} 게이트 — <b>{label}</b> 산출물 검토
			</span>
			<div className="spacer" />
			<button className="btn">← 정정 (이전 Stage)</button>
			<button
				className="btn secondary"
				onClick={onApply}
				disabled={pendingCount === 0}
				title={
					pendingCount === 0
						? "먼저 항목에 수정 코멘트를 남기세요"
						: "쌓인 코멘트를 한 번에 반영"
				}
			>
				✎ 수정 지시{pendingCount > 0 ? ` (${pendingCount})` : ""}
			</button>
			<button className="btn primary">✓ 확정 → Stage {stage + 1}</button>
		</div>
	);
}
