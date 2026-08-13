import React from "react";

// 3단계 스텝퍼. 단계 클릭 시 해당 Stage 로 전환(F2 읽기 전용 이전 단계 보기 지원).
// onSelect(stage) 가 주어지면 클릭→부모(App)의 setViewStage 로 읽기 전용 이전 단계/현재 단계 전환.
// onSelect 가 없으면 기존 해시 라우팅(레거시)으로 동작.
export default function Stepper({ stages, onSelect }) {
	const go = (n) => {
		if (!onSelect) {
			const s = stages.find((x) => x.n === n);
			window.location.hash = s && s.route ? `#/${s.route}` : "#/";
			return;
		}
		onSelect(n);
	};
	return (
		<div className="stepper">
			{stages.map((s, i) => (
				<React.Fragment key={s.n}>
					<div
						className={`step ${s.state}`}
						onClick={() => go(s.n)}
						title={
							s.state === "locked"
								? "잠김 — 이전 Stage 확정 필요"
								: s.state === "view"
									? "이전 단계 읽기 전용 보기"
									: `${s.label} 보기`
						}
						style={{ cursor: s.state === "locked" ? "not-allowed" : "pointer" }}
					>
						<span className="num">{s.n}</span> {s.label}
					</div>
					{i < stages.length - 1 && <div className="step-sep" />}
				</React.Fragment>
			))}
		</div>
	);
}
