import { useState } from "react";
// 하단 고정 게이트 바 — 확정(confirm) / 정정(revert). 코멘트는 실시간 채팅(/api/chat)으로
// 즉시 전달되므로 별도 전송 버튼은 없다.
// 정정 시 회귀 대상 Stage 를 선택 → decision.revertTo 로 전송(FR-7 다단계 회귀).
// 각 액션은 onGate({verdict, revertTo}) 로 실제 결정을 POST 한다.
export default function GateBar({
	stage,
	label,
	stageLabels = {},
	onConfirm,
	onRevert,
	onReview,
}) {
	const isLast = stage >= 3;
	// 회귀 대상 후보 = 현재 단계보다 앞선 Stage(1..stage-1).
	const targets = [];
	for (let s = 1; s < stage; s++) targets.push(s);
	const [revertTo, setRevertTo] = useState(Math.max(1, stage - 1));

	return (
		<div className="gate">
			<span className="label">
				Stage {stage} 게이트 — <b>{label}</b> 산출물 검토
			</span>
			<div className="spacer" />
			{targets.length > 1 && (
				<select
					className="revert-target"
					value={revertTo}
					onChange={(e) => setRevertTo(Number(e.target.value))}
					title="회귀 대상 Stage 선택"
				>
					{targets.map((s) => (
						<option key={s} value={s}>
							Stage {s}
							{stageLabels[s] ? ` — ${stageLabels[s]}` : ""}
						</option>
					))}
				</select>
			)}
			<button
				className="btn"
				onClick={() => onRevert(revertTo)}
				title="선택한 Stage로 회귀"
			>
				← 정정{targets.length > 1 ? ` → Stage ${revertTo}` : " (이전 Stage)"}
			</button>
			{onReview && (
				<button
					className="btn"
					onClick={onReview}
					title="AI가 산출물을 한 번 더 검토·수정합니다 (+1 사이클)"
				>
					🔁 검토 요청
				</button>
			)}
			<button className="btn primary" onClick={onConfirm}>
				{isLast ? "✓ 최종 확정 (완료)" : `✓ 확정 → Stage ${stage + 1}`}
			</button>
		</div>
	);
}
