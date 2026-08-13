// FactoryNote Plan 뷰어 — 런타임 진입(게이트 폴링·상태 전이).
// 영속 게이트 서버(기능별 1포트)를 폴링하며 단계를 따라간다:
//   - /api/state.gateOpen=true  → 해당 단계 산출물 렌더 + 게이트 컨트롤(확정/수정/정정)
//   - /api/state.gateOpen=false → "다음 준비 중…" 표시 후 1초 폴링
//   - gateOpen 이 false→true 로 전환되면 같은 탭에서 다음 단계로 교체 + 알림(Notification/타이틀 점멸)
// 게이트 결정은 /api/decision 로 POST → pi 에이전트로 전달. 서버는 플랜 완료 시 닫힌다.
// 책임별 모듈: components/Screens(전환 화면) · lib/notify(알림 유틸) · components/PlanPage·ChatSidebar(렌더).
import { useState, useEffect, useRef } from "react";
import PlanPage from "./components/PlanPage";
import ChatSidebar from "./components/ChatSidebar";
import { Center, ClosedScreen, PreparingScreen } from "./components/Screens";
import { notifyNewStage, requestNotifyPermission } from "./lib/notify";

export default function App() {
	const [state, setState] = useState(null); // 마지막 /api/state
	const [phase, setPhase] = useState("loading"); // loading | reviewing | preparing | closed
	const notifiedRef = useRef(false); // 전환 알림 1회 가드(preparing→reviewing)
	// F1: 채팅 부분 코멘트용 현재 선택 블록(PlanPage 가 갱신).
	const [activeBlockId, setActiveBlockId] = useState(null);

	// 초기 1회 로드.
	useEffect(() => {
		fetchState();
		// ponytail: cleanup 불필요 — 폴링 effect 가 phase 전환을 주도.
	}, []);

	// 서버 push(SSE)로 상태 동기화 — 폴링 대체. closed(게이트 마감) 에서는 닫는다.
	useEffect(() => {
		if (phase === "closed") return;
		const es = new EventSource("/api/events");
		es.addEventListener("state", fetchState);
		// 채팅 회신 push → ChatSidebar 가 fn-chat-update 로 fetchChat.
		es.addEventListener("chat", () =>
			window.dispatchEvent(new Event("fn-chat-update")),
		);
		return () => es.close();
	}, [phase]);

	// 단계 전환 시 채팅 부분코멘트 블록 선택을 초기화.
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

	// reviewing: 현재 단계 산출물 렌더. 3단계 모두 동일 문서 경로(PlanPage) — 그래프는
	// 계층 트리 .json 을 참조하는 읽기 전용 드릴다운 블록(ADR-018).
	const cur = (state.artifacts || []).find((a) => a.stage === state.stage);
	const stageLabels = {};
	for (const a of state.artifacts || []) stageLabels[a.stage] = a.name;
	stageLabels[state.stage] = state.stageName;
	const graphData = {};
	for (const g of cur?.graphs || [])
		graphData[g.file] = { type: g.type, data: g.data };

	const main = (
		<PlanPage
			mdSource={pickMarkdown(state)}
			stage={state.stage}
			stageName={state.stageName}
			feature={state.feature}
			stageLabels={stageLabels}
			onGate={onGate}
			onReview={onReview}
			onActiveBlock={setActiveBlockId}
			graphData={graphData}
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

// 현 단계 산출물 마크다운 텍스트를 반환(3단계 공통).
function pickMarkdown(state) {
	const arts = state.artifacts || [];
	const cur = arts.find((a) => a.stage === state.stage);
	return (
		cur?.md ||
		`# Stage ${state.stage} — ${state.stageName}\n\n> 이 단계 산출물이 아직 작성되지 않았습니다.`
	);
}
