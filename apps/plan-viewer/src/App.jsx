// FactoryNote Plan 뷰어 — 런타임 진입.
// /api/state 로 현재 단계+산출물을 받아 렌더:
//   Stage 2(그래프: 모듈·클래스) → GraphStage(다중 섹션 에디터), 그 외 → PlanPage(마크다운).
// 게이트 결정(확정/수정/정정 + 그래프 편집) 은 /api/decision 로 POST → pi 에이전트로 전달.
import { useState, useEffect } from "react";
import PlanPage from "./components/PlanPage";
import GraphStage from "./components/GraphStage";

export default function App() {
	const [state, setState] = useState(null);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/state")
			.then((r) => r.json())
			.then((s) => !cancelled && setState(s))
			.catch((e) => !cancelled && setError(String(e)));
		return () => {
			cancelled = true;
		};
	}, []);

	if (submitted) return <DoneScreen />;
	if (error) return <Center>게이트 상태 조회 실패: {error}</Center>;
	if (!state) return <Center>게이트 로딩 중…</Center>;

	const onGate = async (decision) => {
		try {
			await fetch("/api/decision", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(decision),
			});
		} catch {
			/* 서버가 결정 수신 후 종료될 수 있음 — 무시 */
		}
		setSubmitted(true);
	};

	// 회귀 대상 셀렉터용 단계 라벨(산출물 이름 + 현재 단계명).
	const stageLabels = {};
	for (const a of state.artifacts || []) stageLabels[a.stage] = a.name;
	stageLabels[state.stage] = state.stageName;

	const isGraph = state.stage === 2;
	const cur = (state.artifacts || []).find((a) => a.stage === state.stage);

	if (isGraph) {
		return (
			<GraphStage
				stage={state.stage}
				stageName={state.stageName}
				feature={state.feature}
				sections={cur?.graphSections || []}
				stageLabels={stageLabels}
				onGate={onGate}
			/>
		);
	}

	return (
		<PlanPage
			mdSource={pickMarkdown(state)}
			stage={state.stage}
			stageName={state.stageName}
			feature={state.feature}
			stageLabels={stageLabels}
			onGate={onGate}
		/>
	);
}

// 마크다운 단계(Stage 1·3)의 산출물 텍스트를 반환.
function pickMarkdown(state) {
	const arts = state.artifacts || [];
	const cur = arts.find((a) => a.stage === state.stage);
	return (
		cur?.md ||
		`# Stage ${state.stage} — ${state.stageName}\n\n> 이 단계 산출물이 아직 작성되지 않았습니다.`
	);
}

function Center({ children }) {
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

function DoneScreen() {
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
				<div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>✓</div>
				<h2>게이트 결정 전송 완료</h2>
				<p style={{ color: "#999" }}>
					pi 터미널로 돌아가 다음 진행을 확인하세요. 이 창은 닫아도 됩니다.
				</p>
			</div>
		</div>
	);
}
