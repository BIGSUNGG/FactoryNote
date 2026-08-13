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
	const [draft, setDraft] = useState("");
	const [scopeBlock, setScopeBlock] = useState(false);
	const endRef = useRef(null);

	const fetchChat = async () => {
		try {
			const r = await fetch("/api/chat");
			if (!r.ok) return;
			const data = await r.json();
			setMessages(data.messages || []);
		} catch {
			/* 무시 — 다음 폴링 */
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
		setDraft("");
		try {
			await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			fetchChat();
		} catch {
			/* 무시 — 다음 폴링 */
		}
	};

	// 마지막 메시지가 user 면 에이전트 회신 대기 → "thinking..." 표시.
	// 채팅 전송·코멘트 둘 다 chatLog 를 거치므로 이 파생 규칙 하나로 커버.
	const thinking = messages.length > 0 && messages.at(-1).role === "user";

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
					messages.map((m) => (
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
					))
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
					disabled={disabled}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							send();
						}
					}}
				/>
				<button className="chat-send" onClick={send} disabled={disabled}>
					전송
				</button>
			</div>
		</aside>
	);
}
