// 하단 고정 게이트 바 — 확정 / 수정 지시 / 정정.
// '확정' 클릭 시 다음 Stage 페이지로 이동. 마지막(Stage 6)은 완료.
const ROUTES = ["", "scenarios", "modules", "classes", "impl", "review"];
// index = stage 번호. ROUTES[1]=scenarios(Stage 1 다음) … ROUTES[5]=review, ROUTES[6]=undefined(완료)

export default function GateBar({ stage, label, pendingCount, onApply }) {
	const goNext = () => {
		const next = ROUTES[stage]; // 현재 stage 의 다음 route
		if (!next) {
			alert(
				"✓ Plan 확정 완료 — 6단계 파이프라인 종료. 산출물이 작업 공간에 반영됩니다.",
			);
			return;
		}
		window.location.hash = `#/${next}`;
	};

	const isLast = stage >= 6;

	return (
		<div className="gate">
			<span className="label">
				Stage {stage} 게이트 — <b>{label}</b> 산출물 검토
			</span>
			<div className="spacer" />
			<button
				className="btn"
				onClick={() => window.history.back()}
				title="이전으로"
			>
				← 정정 (이전 Stage)
			</button>
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
			<button className="btn primary" onClick={goNext}>
				{isLast ? "✓ 최종 확정 (완료)" : `✓ 확정 → Stage ${stage + 1}`}
			</button>
		</div>
	);
}
