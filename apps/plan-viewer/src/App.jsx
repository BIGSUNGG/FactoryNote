// FactoryNote Plan 뷰어 — 런타임 진입.
// 영속 게이트 서버(기능별 1포트)를 폴링하며 단계를 따라간다:
//   - /api/state.gateOpen=true  → 해당 단계 산출물 렌더 + 게이트 컨트롤(확정/수정/정정)
//   - /api/state.gateOpen=false → "다음 준비 중…" 표시 후 1초 폴링
//   - gateOpen 이 false→true 로 전환되면 같은 탭에서 다음 단계로 교체 + 알림(Notification/타이틀 점멸)
// 게이트 결정은 /api/decision 로 POST → pi 에이전트로 전달. 서버는 플랜 완료 시 닫힌다.
import { useState, useEffect, useRef } from "react";
import PlanPage from "./components/PlanPage";
import DesignStage from "./components/DesignStage";
import ChatSidebar from "./components/ChatSidebar";

const HEARTBEAT_MS = 2000; // /api/state 폴링 주기 = 탭 생존 하트비트(서버 재오픈 판정에 사용).

export default function App() {
	const [state, setState] = useState(null); // 마지막 /api/state
	const [phase, setPhase] = useState("loading"); // loading | reviewing | preparing | closed
	const notifiedRef = useRef(false); // 전환 알림 1회 가드(preparing→reviewing)
	// F1: 채팅 부분 코멘트용 현재 선택 블록(PlanPage 가 갱신). Stage 2 는 미사용.
	const [activeBlockId, setActiveBlockId] = useState(null);

	// 초기 1회 로드.
	useEffect(() => {
		fetchState();
		// ponytail: cleanup 불필요 — 폴링 effect 가 phase 전환을 주도.
	}, []);

	// 연속 폴링 = 상태 동기화 + 탭 생존 하트비트. closed(게이트 마감) 에서는 멈춘다.
	useEffect(() => {
		if (phase === "closed") return;
		const id = setInterval(fetchState, HEARTBEAT_MS);
		return () => clearInterval(id);
	}, [phase]);

	// 단계 전환 시 채팅 부분코멘트 블록 선택을 초기화(Stage 2 는 블록 선택 미사용).
	useEffect(() => {
		setActiveBlockId(null);
	}, [state?.stage]);

	async function fetchState() {
		try {
			const r = await fetch("/api/state");
			if (!r.ok) throw new Error(`status ${r.status}`);
			applyState(await r.json());
		} catch {
			// 서버 종료(플랜 완료·프로세스 퇴장) → 마감 화면.
			setPhase("closed");
		}
	}

	function applyState(s) {
		setState(s);
		if (s.done) {
			setPhase("closed");
			return;
		}
		if (s.gateOpen) {
			setPhase((prev) => {
				// preparing 직후 게이트가 다시 열리면 = 다음 단계(또는 수정본) 준비됨 → 알림.
				if (prev === "preparing" && !notifiedRef.current) {
					notifiedRef.current = true;
					notifyNewStage(s);
				}
				return "reviewing";
			});
		} else {
			// 에이전트 작업 중(산출물 준비). 다음 오픈까지 폴링.
			notifiedRef.current = false;
			setPhase("preparing");
		}
	}

	const onGate = async (decision) => {
		try {
			await fetch("/api/decision", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(decision),
			});
		} catch {
			/* 무시 — 다음 폴링에서 상태 동기화 */
		}
		requestNotifyPermission();
		// 결정 제출 → 에이전트가 처리하는 동안 준비 중 상태로 전환해 폴링 시작.
		setPhase("preparing");
	};

	// '검토 요청' — 현 산출물에 AI 재검토(feedback+design 수정 +1 사이클) 요청.
	// 게이트를 유지한 채 백그라운드 사이클 → preparing 전환 후 재오픈 시 갱신.
	const onReview = async () => {
		try {
			await fetch("/api/review-request", { method: "POST" });
		} catch {
			/* 무시 */
		}
		setPhase("preparing");
	};

	if (phase === "closed") return <ClosedScreen done={!!state?.done} />;
	if (phase === "loading") return <Center>게이트 로딩 중…</Center>;
	if (phase === "preparing")
		return (
			<PreparingScreen stage={state?.stage} stageName={state?.stageName} />
		);
	if (!state) return <Center>게이트 로딩 중…</Center>;

	// reviewing: 현재 단계 산출물 렌더. Stage 2 는 md 단일진실 DesignStage, 나머지는 PlanPage.
	const cur = (state.artifacts || []).find((a) => a.stage === state.stage);
	const stageLabels = {};
	for (const a of state.artifacts || []) stageLabels[a.stage] = a.name;
	stageLabels[state.stage] = state.stageName;

	const main =
		state.stage === 2 ? (
			<DesignStage
				mdSource={cur?.md || ""}
				stage={state.stage}
				stageName={state.stageName}
				feature={state.feature}
				stageLabels={stageLabels}
				onGate={onGate}
				onReview={onReview}
			/>
		) : (
			<PlanPage
				mdSource={pickMarkdown(state)}
				stage={state.stage}
				stageName={state.stageName}
				feature={state.feature}
				stageLabels={stageLabels}
				onGate={onGate}
				onReview={onReview}
				onActiveBlock={setActiveBlockId}
			/>
		);

	// reviewing: 메인 산출물 + 우측 실시간 에이전트 채팅 사이드바(게이트 열린 동안).
	return (
		<div className="review-shell">
			<div className="review-main">{main}</div>
			<ChatSidebar stage={state.stage} activeBlockId={activeBlockId} />
		</div>
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

// 다음 단계 ready 알림: 데스크톱 Notification + 탭 타이틀 점멸 + 포커스(백그라운드 탭 대응).
function notifyNewStage(s) {
	document.title = `● Stage ${s.stage} 준비됨 — FactoryNote`;
	window.focus?.();
	if ("Notification" in window && Notification.permission === "granted") {
		try {
			new Notification(`FactoryNote — Stage ${s.stage} ${s.stageName}`, {
				body: "다음 단계 산출물이 준비되었습니다. 검토하세요.",
			});
		} catch {
			/* 일부 브라우저는 생성자 호출 제한 */
		}
	}
	const reset = () => {
		document.title = "FactoryNote Plan";
		window.removeEventListener("focus", reset);
	};
	window.addEventListener("focus", reset);
}

// 사용자 제스처(결정 클릭) 타이밍에 권한 요청 — 다음 ready 알림을 위해 미리 확보.
function requestNotifyPermission() {
	if (!("Notification" in window)) return;
	if (Notification.permission === "default") {
		try {
			Notification.requestPermission();
		} catch {
			/* 무시 */
		}
	}
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

function PreparingScreen({ stage, stageName }) {
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

function ClosedScreen({ done }) {
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
