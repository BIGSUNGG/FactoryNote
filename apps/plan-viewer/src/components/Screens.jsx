// 전환 화면 컴포넌트 — 로딩/준비 중/마감 상태.
// App.jsx 가 phase 전환에 따라 렌더한다.

export function Center({ children }) {
	return (
		<div
			style={{
				minHeight: "100vh",
				display: "grid",
				placeItems: "center",
				fontFamily: "system-ui, sans-serif",
				color: "#555",
			}}
		>
			{children}
		</div>
	);
}

export function PreparingScreen({ stage, stageName }) {
	return (
		<div
			style={{
				minHeight: "100vh",
				display: "grid",
				placeItems: "center",
				fontFamily: "system-ui, sans-serif",
				background: "#0b0b0c",
				color: "#eee",
				textAlign: "center",
			}}
		>
			<div>
				<div style={{ fontSize: "2.25rem", marginBottom: "0.5rem" }}>✓</div>
				<h2>이전 단계 확정</h2>
				<p style={{ color: "#999" }}>
					Stage {stage}({stageName}) 준비 중… 이 탭을 닫지 마세요. 준비되면
					자동으로 표시됩니다.
				</p>
			</div>
		</div>
	);
}

export function ClosedScreen({ done }) {
	return (
		<div
			style={{
				minHeight: "100vh",
				display: "grid",
				placeItems: "center",
				fontFamily: "system-ui, sans-serif",
				background: "#0b0b0c",
				color: "#eee",
				textAlign: "center",
			}}
		>
			<div>
				<div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
					{done ? "✓" : "—"}
				</div>
				<h2>{done ? "계획 완료" : "게이트 마감"}</h2>
				<p style={{ color: "#999" }}>
					{done
						? "모든 단계가 승인되었습니다. pi 터미널로 돌아가 구현을 시작하세요."
						: "이 게이트는 닫혔습니다. pi 터미널에서 진행 상태를 확인하세요."}
				</p>
			</div>
		</div>
	);
}
