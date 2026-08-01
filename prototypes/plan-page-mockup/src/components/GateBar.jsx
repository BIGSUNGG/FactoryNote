// 하단 고정 게이트 바 — 확정(confirm) / 수정 지시(modify) / 정정(revert).
// 각 버튼은 onGate({verdict, comments}) 로 실제 결정을 POST 한다(목업 hash-nav 제거).
export default function GateBar({
	stage,
	label,
	pendingCount,
	onConfirm,
	onModify,
	onRevert,
}) {
	const isLast = stage >= 6;

	return (
		<div className="gate">
			<span className="label">
				Stage {stage} 게이트 — <b>{label}</b> 산출물 검토
			</span>
			<div className="spacer" />
			<button className="btn" onClick={onRevert} title="이전 단계로 회귀">
				← 정정 (이전 Stage)
			</button>
			<button
				className="btn secondary"
				onClick={onModify}
				disabled={pendingCount === 0}
				title={
					pendingCount === 0
						? "먼저 항목에 수정 코멘트를 남기세요"
						: "쌓인 코멘트를 수정 지시로 전송"
				}
			>
				✎ 수정 지시{pendingCount > 0 ? ` (${pendingCount})` : ""}
			</button>
			<button className="btn primary" onClick={onConfirm}>
				{isLast ? "✓ 최종 확정 (완료)" : `✓ 확정 → Stage ${stage + 1}`}
			</button>
		</div>
	);
}
