import React from "react";

// 6단계 스텝퍼. 단계 클릭 시 해당 Stage 페이지로 전환(잠긴 단계는 제외).
export default function Stepper({ stages }) {
	const go = (s) => {
		window.location.hash = s.route ? `#/${s.route}` : "#/";
	};
	return (
		<div className="stepper">
			{stages.map((s, i) => (
				<React.Fragment key={s.n}>
					<div
						className={`step ${s.state}`}
						onClick={() => go(s)}
						title={
							s.state === "locked"
								? "잠김 — 이전 Stage 확정 필요"
								: `${s.label} 보기`
						}
						style={{ cursor: "pointer" }}
					>
						<span className="num">{s.n}</span> {s.label}
					</div>
					{i < stages.length - 1 && <div className="step-sep" />}
				</React.Fragment>
			))}
		</div>
	);
}
