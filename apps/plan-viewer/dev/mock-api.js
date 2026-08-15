// 테스트 뷰어(`bun run dev`)용 목업 게이트 API — 실제 게이트 서버(pi-extension
// gate-http/gate-server, ADR-024/026) 의미론을 순수 모듈로 모방한다.
// vite.config.js 미들웨어가 이 모듈을 주입받아 /api/* 를 응답하고, 상태 변동 시
// emit("state"|"chat") 으로 SSE push 한다. bun test 로 검증(mock-api.test.js).
//
// 실서버 대응:
//   idle 즉시 전달(=resolver 대기 중) / busy(=3초 가짜 회신 중) 큐 적재·선두 1개씩
//   드레인 / stage-request 대기 채팅 뒤 적재 → 채팅 잠금 → 선두 실행 시 단계 진행
//   ·fulfilled 기록 / cancel(already-sent 거부) / GET {messages, queue}.

/** 목업 상태·큐를 소유하는 핸들러 팩토리. opts 로 타이머/문서 주입(테스트용). */
export function createMockApi({
	feature = "auth-module",
	stageName = "요청 이해",
	artifacts = [],
	replyDelayMs = 3000,
	replies = [],
	edits = [],
	setTimeoutFn = setTimeout,
	now = () => Date.now(),
} = {}) {
	const state = {
		feature,
		stage: 1,
		stageName,
		gateOpen: true,
		done: false,
		artifacts: artifacts.map((a) => ({ ...a })),
	};
	const messages = []; // chatLog
	const queue = []; // pendingChats(가시 큐)
	const listeners = new Set(); // SSE 구독자: (type) => void
	let busy = false; // 가짜 회신 진행 중(=실서버 resolver null 구간)
	let seq = 0;
	let replyIdx = 0;
	let editIdx = 0;

	const nextId = () => `m${++seq}`;
	const emit = (type) => {
		for (const fn of listeners) fn(type);
	};
	const addLog = (msg) => {
		messages.push(msg);
		emit("chat");
	};
	/** 가짜 에이전트 회신 스케줄 + 완료 후 큐 드레인(선두 1개만). */
	const scheduleReply = () => {
		busy = true;
		setTimeoutFn(() => {
			addLog({
				id: nextId(),
				role: "agent",
				text: replies[replyIdx++ % replies.length] ?? "반영했습니다.",
				at: now(),
			});
			// 정해진 파일 수정(맨 위 배너 prepend) — 산출물 갱신 시연.
			const art = state.artifacts.find((a) => a.stage === state.stage);
			if (art && edits.length > 0)
				art.md = edits[editIdx++ % edits.length] + art.md;
			emit("state");
			busy = false;
			drainOne();
		}, replyDelayMs);
	};
	/** 큐 선두 1개 실행 — 채팅이면 즉시 전달+회신, stage-request 면 단계 진행. */
	const drainOne = () => {
		if (busy || queue.length === 0) return;
		const head = queue.shift();
		if (head.kind === "stage-request") {
			head.status = "fulfilled";
			addLog(head);
			state.stage = head.targetStage ?? state.stage + 1;
			state.stageName = head.stageName ?? state.stageName;
			emit("state"); // 단계 진행 → 뷰어 전환
		} else {
			addLog(head);
			scheduleReply();
		}
	};

	return {
		/** GET /api/state */
		getState: () => ({
			...state,
			artifacts: state.artifacts.map((a) => ({ ...a })),
		}),
		/** GET /api/chat — {messages, queue} */
		getChat: () => ({
			messages: messages.map((m) => ({ ...m })),
			queue: queue.map((m) => ({ ...m })),
		}),
		/**
		 * POST /api/chat — 텍스트 채팅 또는 단계 진행 요청(kind:"stage-request").
		 * 반환: {ok, reason?} (실서버 게이트-http 응답 형식).
		 */
		postChat: (p = {}) => {
			if (p.kind === "stage-request") {
				if (queue.some((m) => m.kind === "stage-request"))
					return { ok: false, reason: "already-pending" };
				const target = typeof p.targetStage === "number" ? p.targetStage : 0;
				const item = {
					id: nextId(),
					role: "user",
					kind: "stage-request",
					status: "pending",
					targetStage: target,
					stageName: p.stageName,
					text: `Stage ${target} 진행 요청`,
					at: now(),
				};
				queue.push(item);
				emit("chat");
				// 실서버와 동일: 게이트 열려 있고 앞 대기 없으면(유일 항목) 즉시 실행.
				if (!busy && queue[0] === item) drainOne();
				return { ok: true };
			}
			const text = typeof p.text === "string" ? p.text.trim() : "";
			if (!text) return { ok: true };
			// 확정 요청 대기 중 → 이후 채팅 거부(뷰어 입력 잠금과 이중 방어).
			if (queue.some((m) => m.kind === "stage-request"))
				return { ok: false, reason: "stage-request-pending" };
			const msg = {
				id: nextId(),
				role: "user",
				text,
				...(typeof p.blockId === "string" ? { blockId: p.blockId } : {}),
				at: now(),
			};
			if (busy) {
				queue.push(msg); // 응답 중 → 가시 큐 적재(본문은 전송 후 공개)
				emit("chat");
			} else {
				addLog(msg); // 듣는 중 → 즉시 전달
				scheduleReply();
			}
			return { ok: true };
		},
		/** POST /api/chat/cancel — 큐에서 제거(read-wins). */
		cancel: (id) => {
			const idx = queue.findIndex((m) => m.id === id);
			if (idx < 0) return { ok: false, reason: "already-sent" };
			queue.splice(idx, 1);
			emit("chat");
			return { ok: true };
		},
		/** POST /api/decision — 최종 확정·수정·회귀(데모: 마지막 단계 확정만 완료). */
		postDecision: (d = {}) => {
			if (d.verdict === "confirm" && state.stage >= 3) {
				state.done = true;
				emit("state");
			}
			return { ok: true };
		},
		/** SSE 구독. 반환: 구독 해제 함수. */
		subscribe: (fn) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		/** 테스트/디버그용 내부 상태 접근. */
		_debug: () => ({
			busy,
			stage: state.stage,
			done: state.done,
			messages,
			queue,
		}),
	};
}
