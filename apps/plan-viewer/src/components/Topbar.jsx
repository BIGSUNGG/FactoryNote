// 상단 바 — 로고·기능명 + 현 파이프라인 구성(정해진 스테이지 목록).
// 구성은 /api/state.stages(동적 구성, ADR-031) 기준 — 고정 단계가 아니다.
export default function Topbar({ feature, stages = [], stage = 0 }) {
	return (
		<div className="topbar">
			<div className="logo">FactoryNote</div>
			{feature && <div className="topbar-feature">/ {feature}</div>}
			{stages.length > 0 && (
				<div className="topbar-stages" title="파이프라인 구성(디렉터 결정)">
					{stages.map((s) => (
						<span
							key={s.n}
							className={`stage-chip${s.n === stage ? " current" : ""}${s.n > stage ? " ahead" : ""}`}
						>
							<span className="num">{s.n}</span>
							{s.label}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
