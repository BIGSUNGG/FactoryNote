import { useState, useEffect, useRef } from "react";

// 우측 실시간 에이전트 채팅 — 게이트 열린 동안 질문/수정요청을 에이전트에 전달.
// GET /api/chat 폴링(2s)으로 대화 표시, POST /api/chat 으로 전송.
// 부분 코멘트: 상위(PlanPage)가 선택한 블록(activeBlockId)에 한정해 전송 가능.
export default function ChatSidebar({
	stage,
	activeBlockId,
	disabled = false,
}) {
	const [messages, setMessages] = useState([]);
	const [queue, setQueue] = useState([]);
	const [draft, setDraft] = useState("");
	const [scopeBlock, setScopeBlock] = useState(false);
	const endRef = useRef(null);

	const fetchChat = async () => {
		try {
			const r = await fetch("/api/chat");
			if (!r.ok) return;
			const data = await r.json();
			setMessages(data.messages || []);
			setQueue(data.queue || []);
		} catch {
			/* 무시 — 다음 폴링 */
		}
	};

	// 전송 대기 큐에서 취소(완전 삭제). 이미 넘겨졌으면 서버가 ok:false → 그냥 새로고침.
	const cancelQueued = async (id) => {
		try {
			await fetch("/api/chat/cancel", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id }),
			});
			fetchChat();
		} catch {
			/* 무시 */
		}
	};

	useEffect(() => {
		fetchChat();
		const refresh = () => fetchChat();
		// 갱신은 App 의 SSE chat 이벤트(→ fn-chat-update)와 코멘트 전송 시 발화. 폴링 없음.
		window.addEventListener("fn-chat-update", refresh);
		return () => window.removeEventListener("fn-chat-update", refresh);
	}, []);

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const send = async () => {
		const text = draft.trim();
		if (!text) return;
		const body = { text };
		if (scopeBlock && activeBlockId) body.blockId = activeBlockId;
		try {
			const r = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = await r.json().catch(() => ({}));
			// 거부(확정 요청 대기 중 등) → 잠금 안내가 큐 상태로 표시된다. draft 유지.
			if (data.ok === false) {
				fetchChat();
				return;
			}
			setDraft("");
			fetchChat();
		} catch {
			/* 무시 — 다음 폴링 */
		}
	};

	// 마지막 메시지가 user 면 에이전트 회신 대기 → "thinking..." 표시.
	// 단계 진행 요청(stage-request)은 회신 대상이 아니므로 제외.
	const lastChat = [...messages]
		.reverse()
		.find((m) => m.kind !== "stage-request");
	const thinking = !!lastChat && lastChat.role === "user";
	// 확정(단계 진행) 요청이 큐에서 대기 중 → 이후 채팅 입력 잠금 + 안내 표시.
	const stagePending = queue.some((m) => m.kind === "stage-request");
	const inputDisabled = disabled || stagePending;
	// 큐 미리보기 — 첫 줄 기준 한 줄 요약(~40자 + 말줄임). 무엇이 대기 중인지 식별용.
	const previewOf = (text) => {
		const first = (text ?? "").split("\n")[0].trim();
		return first.length > 40 ? `${first.slice(0, 40)}…` : first;
	};

	return (
		<aside className="chat-sidebar">
			<div className="chat-head">
				<h4>에이전트 채팅</h4>
				<span className="chat-stage">Stage {stage}</span>
			</div>
			<div className="chat-body">
				{messages.length === 0 ? (
					<p className="chat-empty">
						게이트가 열려 있습니다. 계획에 대해 질문하거나 수정을 요청하면
						에이전트가 답변하거나 그 자리에서 반영합니다. 최종 확정·수정·정정은
						하단 게이트 바로 합니다.
					</p>
				) : (
					messages.map((m) => {
						if (m.kind === "stage-request") {
							// pending 은 큐 영역에서만 표시(본문 미노출), fulfilled 만 본문 강조 기록.
							if (m.status === "pending") return null;
							return (
								<div key={m.id} className="chat-msg stage-request">
									<span className="chat-stage-badge">
										➡ Stage {m.targetStage} 진행 요청
									</span>
								</div>
							);
						}
						return (
							<div key={m.id} className={`chat-msg ${m.role}`}>
								<span className="chat-role">
									{m.role === "user" ? "나" : "AI"}
								</span>
								{m.blockId && <span className="chat-block">[{m.blockId}]</span>}
								{m.quote && (
									<blockquote className="chat-quote">“{m.quote}”</blockquote>
								)}
								<div className="chat-text">{m.text}</div>
							</div>
						);
					})
				)}
				{thinking && (
					<div className="chat-msg agent thinking">
						<span className="chat-role">AI</span>
						<div className="chat-text">
							thinking
							<span className="think-dots">
								<i /> <i /> <i />
							</span>
						</div>
					</div>
				)}
				<div ref={endRef} />
			</div>
			{queue.length > 0 && (
				<div className="chat-queue">
					<div className="chat-queue-head">
						전송 대기 중{" "}
						<span className="chat-queue-count">{queue.length}</span>
					</div>
					{queue.map((m) => (
						<div
							key={m.id}
							className={`chat-queued-msg${
								m.kind === "stage-request" ? " stage-request" : ""
							}`}
						>
							{m.kind === "stage-request" ? (
								<span className="chat-stage-badge">
									➡ Stage {m.targetStage} 진행 요청
								</span>
							) : (
								<>
									{/* 대기 콘텍스트 태그 + 한 줄 미리보기 — 전체 본문은 전송 후 채팅 로그에 공개. */}
									<span className="chat-queued-tag">대기</span>
									{m.blockId && (
										<span className="chat-block">[{m.blockId}]</span>
									)}
									<div className="chat-text chat-queued-preview">
										{previewOf(m.text)}
									</div>
								</>
							)}
							<button
								type="button"
								className="chat-cancel"
								onClick={() => cancelQueued(m.id)}
								disabled={disabled}
								aria-label="전송 취소"
							>
								✕
							</button>
						</div>
					))}
				</div>
			)}
			{stagePending && (
				<div className="chat-lock-notice">
					다음 단계 요청이 대기 중입니다 — 앞선 채팅 응답이 끝나면 진행됩니다.
					(채팅 입력 잠금)
				</div>
			)}
			{activeBlockId && (
				<label className="chat-scope">
					<input
						type="checkbox"
						checked={scopeBlock}
						onChange={(e) => setScopeBlock(e.target.checked)}
						disabled={disabled}
					/>
					블록 <code>{activeBlockId}</code>에 한정해 질문/수정
				</label>
			)}
			<div className="chat-input-row">
				<textarea
					value={draft}
					placeholder={
						scopeBlock && activeBlockId
							? `${activeBlockId} 블록에 질문/수정…`
							: "질문 또는 수정 요청… (Shift+Enter 줄바꿈)"
					}
					rows={2}
					disabled={inputDisabled}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							send();
						}
					}}
				/>
				<button
					type="button"
					className="chat-send"
					onClick={send}
					disabled={inputDisabled}
				>
					전송
				</button>
			</div>
		</aside>
	);
}
