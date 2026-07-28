export default function Topbar({ stage, total }) {
	return (
		<div className="topbar">
			<div className="logo">FactoryNote</div>
			<div style={{ fontSize: 14, color: "var(--muted)" }}>/ auth-module</div>
			<div className="plan-meta">
				<span className="badge">검토 대기</span>
				<span>
					Stage {stage}/{total}
				</span>
				<span>담당: Backend</span>
			</div>
		</div>
	);
}
