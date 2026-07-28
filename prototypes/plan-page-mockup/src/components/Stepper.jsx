import React from "react";

// 6단계 파이프라인 스텝퍼. step 사이에 구분선(sep) 삽입.
export default function Stepper({ stages }) {
	return (
		<div className="stepper">
			{stages.map((s, i) => (
				<React.Fragment key={s.n}>
					<div className={`step ${s.state}`}>
						<span className="num">{s.n}</span> {s.label}
					</div>
					{i < stages.length - 1 && <div className="step-sep" />}
				</React.Fragment>
			))}
		</div>
	);
}
