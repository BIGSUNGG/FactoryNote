// FactoryNote Plan 뷰어 — 런타임 진입.
// /api/state 로 현재 단계+산출물을 받아 렌더:
//   Stage 3/4(그래프) → GraphStage(다중 섹션 에디터), 그 외 → PlanPage(마크다운).
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

	const isGraph = state.stage === 3 || state.stage === 4;
	const cur = (state.artifacts || []).find((a) => a.stage === state.stage);

	if (isGraph) {
		return (
			<GraphStage
				stage={state.stage}
				stageName={state.stageName}
				feature={state.feature}
				sections={cur?.graphSections || []}
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
			onGate={onGate}
		/>
	);
}

// 그래프 산출물은 텍스트 요약으로(Stage 6 검토용). 마크다운은 그대로.
function artifactText(a) {
	if (a.graphSections) {
		const lines = a.graphSections.map(
			(s) =>
				`- 섹션 "${s.title}": 노드 ${s.nodes.length} · 관계 ${s.edges.length}`,
		);
		return `(그래프 — 섹션 ${a.graphSections.length}개)\n${lines.join("\n")}`;
	}
	return a.md ?? "(산출물 없음)";
}

function pickMarkdown(state) {
	const arts = state.artifacts || [];
	if (state.stage >= 6) {
		const body = arts
			.map((a) => `# Stage ${a.stage} — ${a.name}\n\n${artifactText(a)}`)
			.join("\n\n---\n\n");
		return body || "# 최종 검증\n\n> 승인된 산출물이 없습니다.";
	}
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
