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
	// F2: 게이트 결정(확정/검토요청) 제출 후 에이전트가 다음(또는 재작성) 산출물을
	// 준비 중일 때 참. 전체 화면으로 전환하지 않고 기존 페이지를 유지한 채
	// 게이트 바의 확정 버튼이 로딩 연출하며 대기한다(전환 화면 제거).
	const [pending, setPending] = useState(false);
	// F2: 읽기 전용으로 보고 있는 이전 단계(viewStage). null = 현재 단계(편집 가능).
	const [viewStage, setViewStage] = useState(null);
	const notifiedRef = useRef(false); // 전환 알림 1회 가드(preparing→reviewing)
	// F1: 채팅 부분 코멘트용 현재 선택 블록(PlanPage 가 갱신).
	const [activeBlockId, setActiveBlockId] = useState(null);
	// 채팅 사이드바 축소 여부(세션 내만 유지 — 새로고침 시 초기화).
	const [chatCollapsed, setChatCollapsed] = useState(false);
	// ADR-026 후속: 확정(단계 진행) 요청이 큐에 대기 중인지. 채팅 응답 루프로 게이트가
	// 같은 단계로 재오픈해도(gateOpen=true) GateBar 로딩이 풀리지 않게 하는 상태.
	const [stageQueued, setStageQueued] = useState(false);

	// 큐의 stage-request 대기 여부 동기화(SSE chat 이벤트·확정 직후에 호출).
	const fetchQueue = async () => {
		try {
			const r = await fetch("/api/chat");
			if (!r.ok) return;
			const d = await r.json();
			setStageQueued((d.queue || []).some((m) => m.kind === "stage-request"));
		} catch {
			/* 무시 — 다음 이벤트에서 재동기화 */
		}
	};

	// 초기 1회 로드.
	useEffect(() => {
		fetchState();
		fetchQueue();
		// ponytail: cleanup 불필요 — 폴링 effect 가 phase 전환을 주도.
	}, []);

	// 서버 push(SSE)로 상태 동기화 — 폴링 대체. closed(게이트 마감) 에서는 닫는다.
	useEffect(() => {
		if (phase === "closed") return;
		const es = new EventSource("/api/events");
		es.addEventListener("state", fetchState);
		// 채팅 회신 push → ChatSidebar 가 fn-chat-update 로 fetchChat. 큐(확정 요청
		// 대기) 변동 시 GateBar 로딩 유지 판정도 같이 갱신한다.
		es.addEventListener("chat", () => {
			window.dispatchEvent(new Event("fn-chat-update"));
			fetchQueue();
		});
		return () => es.close();
	}, [phase]);

	// 단계 전환 시 채팅 부분코멘트 블록 선택과 읽기 전용 뷰를 초기화.
	useEffect(() => {
		setActiveBlockId(null);
		setViewStage(null);
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
			// 게이트 오픈 = 산출물 준비 완료. 진행 중(pending) 해소.
			setPending(false);
			setPhase((prev) => {
				// preparing 직후 게이트가 다시 열리면 = 다음 단계(또는 수정본) 준비됨 → 알림.
				if (prev === "preparing" && !notifiedRef.current) {
					notifiedRef.current = true;
					notifyNewStage(s);
				}
				return "reviewing";
			});
		} else {
			notifiedRef.current = false;
			// 확정 요청 실행 감지: 큐에 대기하던 단계 요청이 실행되면 단계가 진행되고 게이트가
			// 닫힌다. 채팅 루프 재오픈에서 pending 이 이미 풀렸으므로 여기서 재설정해
			// 다음 단계 게이트가 열릴 때까지 로딩을 유지한다(ADR-026 후속).
			if (state && s.stage !== state.stage) setPending(true);
			// 에이전트 작업 중(gateOpen=false).
			// 이미 검토 페이지를 보고 있다면(확정/검토요청 제출 후) 전체 화면으로
			// 전환하지 않고 페이지를 유지 — 확정 버튼 로딩 연출(onGate/pending)이 대기 상태를
			// 표현한다. 아직 검토할 페이지가 없을 때만(first/준비 진입) 준비 중 화면 유지.
			setPhase((prev) => (prev === "reviewing" ? "reviewing" : "preparing"));
		}
	}

	const onGate = async (decision) => {
		try {
			// 단계 진행(confirm, 마지막 단계 제외) → '다음 단계 요청'을 채팅과 같은 큐에 적재.
			// 대기 채팅이 있으면 그 뒤에 순서대로, 게이트가 열려 있고 앞 대기가 없으면 서버가
			// 즉시 decision 으로 resolve 한다(채널 단일화 — /api/decision 미경유).
			// 마지막 단계 confirm·수정·회귀는 기존대로 /api/decision 로 즉시 전달.
			if (decision.verdict === "confirm" && state && state.stage < 3) {
				await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						kind: "stage-request",
						targetStage: state.stage + 1,
						decision,
					}),
				});
				// 적재 직후 큐 상태 반영(SSE chat 이벤트 대기 없이 즉시 로딩 유지).
				await fetchQueue();
			} else {
				await fetch("/api/decision", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(decision),
				});
			}
		} catch {
			/* 무시 — 다음 폴링에서 상태 동기화 */
		}
		requestNotifyPermission();
		// F2: 결정 제출 후 전체 화면으로 전환하지 않고 기존 페이지 유지.
		// 확정 버튼이 pending 동안 로딩 연출하며, 게이트 재오픈 시 다음 단계로 전환된다.
		setPending(true);
	};

	// '검토 요청' — 현 산출물에 AI 재검토(feedback+design 수정 +1 사이클) 요청.
	// 게이트를 유지한 채 백그라운드 사이클 → 진행 중(pending) 유지 재오픈 시 갱신.
	const onReview = async () => {
		try {
			await fetch("/api/review-request", { method: "POST" });
		} catch {
			/* 무시 */
		}
		setPending(true);
	};

	if (phase === "closed") return <ClosedScreen done={!!state?.done} />;
	if (phase === "loading") return <Center>게이트 로딩 중…</Center>;
	if (phase === "preparing")
		return (
			<PreparingScreen stage={state?.stage} stageName={state?.stageName} />
		);
	if (!state) return <Center>게이트 로딩 중…</Center>;

	// reviewing: 현재 단계(또는 읽기 전용으로 선택한 이전 단계) 산출물 렌더.
	// 3단계 모두 동일 문서 경로(PlanPage) — 그래프는 계층 트리 .json 을 참조하는
	// 읽기 전용 드릴다운 블록(ADR-018). state.artifacts 는 승인된 이전 단계까지 포함하므로
	// 데이터 변경 없이 뷰어 단에서 이전 단계를 읽어 보여줄 수 있다(F2).
	const curStage = viewStage ?? state.stage;
	const readOnly = viewStage !== null; // 이전 단계 보기 = 읽기 전용
	const cur = (state.artifacts || []).find((a) => a.stage === curStage);
	const stageLabels = {};
	for (const a of state.artifacts || []) stageLabels[a.stage] = a.name;
	stageLabels[state.stage] = state.stageName;
	const graphData = {};
	for (const g of cur?.graphs || [])
		graphData[g.file] = { type: g.type, data: g.data };

	const main = (
		<PlanPage
			mdSource={pickMarkdown(state, curStage)}
			prevMdSource={cur?.prevMd}
			stage={curStage}
			activeStage={state.stage} // 스테퍼 작성여부 기준(실제 서버 단계)
			stageName={state.stageName}
			feature={state.feature}
			stageLabels={stageLabels}
			onGate={onGate}
			onReview={onReview}
			onActiveBlock={setActiveBlockId}
			onSelectStage={(n) =>
				// 스테퍼로 실제 현재 단계를 클릭하면 읽기 전용 해제(viewStage=null) →
				// 배너·게이트·채팅 재활성. 그 외 단계는 읽기 전용으로 이동.
				n === state.stage ? setViewStage(null) : setViewStage(n)
			}
			graphData={graphData}
			readOnly={readOnly}
			loading={pending || stageQueued}
			loadingLabel={stageQueued ? "앞선 채팅 응답 후 진행…" : undefined}
		/>
	);

	// reviewing: 메인 산출물 + 우측 실시간 에이전트 채팅 사이드바(게이트 열린 동안).
	// 읽기 전용(이전 단계 보기)에서는 채팅 입력을 비활성화한다.
	return (
		<div className="review-shell">
			<div className={`review-main${chatCollapsed ? " chat-collapsed" : ""}`}>
				{main}
			</div>
			<ChatSidebar
				activeBlockId={activeBlockId}
				disabled={readOnly}
				collapsed={chatCollapsed}
				onToggleCollapse={() => setChatCollapsed((v) => !v)}
			/>
		</div>
	);
}

// 선택 단계 산출물 마크다운 텍스트를 반환(3단계 공통).
function pickMarkdown(state, curStage) {
	const arts = state.artifacts || [];
	const cur = arts.find((a) => a.stage === curStage);
	return (
		cur?.md ||
		`# Stage ${curStage} — ${state.stageName}\n\n> 이 단계 산출물이 아직 작성되지 않았습니다.`
	);
}
