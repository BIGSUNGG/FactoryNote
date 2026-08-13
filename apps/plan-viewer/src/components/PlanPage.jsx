import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import Toc from "./Toc";
import Document from "./Document";
import GateBar from "./GateBar";
import { mdToBlocks } from "../lib/mdToBlocks";

// plan 스타일 페이지 — 마크다운 문서 + 블록/영역 코멘트. Stage 1·3 이 공유.
const STAGE_DEFS = [
	{ n: 1, label: "요청 이해·시나리오", route: "" },
	{ n: 2, label: "모듈·클래스 설계", route: "design" },
	{ n: 3, label: "구현 계획", route: "impl" },
];
const stagesFor = (cur) =>
	STAGE_DEFS.map((s) => ({
		...s,
		state: s.n === cur ? "current" : s.n < cur ? "done" : "locked",
	}));

const stripHtml = (html) => html.replace(/<[^>]+>/g, "").trim();

// Range 를 <mark> 로 감싼다. 한 번에 감싸는 기법은 여러 블록/노드에 걸친 범위에서
// 에러를 던지므로, 텍스트 노드마다 잘라서 감싼다(멀티 블록 안전).
function highlightRange(range, className) {
	const root = range.commonAncestorContainer;
	const walkerRoot =
		root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
	if (!walkerRoot) return;
	const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			return range.intersectsNode(node) &&
				node.nodeValue &&
				node.nodeValue.length
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT;
		},
	});
	const targets = [];
	while (walker.nextNode()) targets.push(walker.currentNode);
	for (const node of targets) {
		let start = 0;
		let end = node.nodeValue.length;
		if (node === range.startContainer) start = range.startOffset;
		if (node === range.endContainer) end = range.endOffset;
		if (start >= end) continue;
		const slice = node.nodeValue.slice(start, end);
		if (!slice.trim()) continue;
		const mark = document.createElement("mark");
		mark.className = className;
		mark.textContent = slice;
		const tail = node.splitText(start);
		tail.splitText(end - start);
		tail.parentNode.replaceChild(mark, tail);
	}
}

export default function PlanPage({
	mdSource,
	stage,
	onGate,
	onReview,
	stageLabels = {},
	onActiveBlock,
	graphData = {},
}) {
	const label = STAGE_DEFS[stage - 1].label;
	const blocks = useMemo(() => mdToBlocks(mdSource), [mdSource]);
	const toc = useMemo(() => {
		const hs = blocks.filter(
			(b) => b.type === "heading" && b.level >= 2 && b.level <= 3,
		);
		return hs.map((b, idx) => ({ label: stripHtml(b.html), cur: idx === 0 }));
	}, [blocks]);

	const [comments, setComments] = useState([]);
	const [activeTargetId, setActiveTargetId] = useState(null);
	const [activeRange, setActiveRange] = useState(null);
	const [rangeDraft, setRangeDraft] = useState("");
	const [fontScale, setFontScale] = useState(1); // md 본문 글자 배율(−/+ 버튼)

	// 코멘트를 로컬(인라인 표시용)에 추가함과 동시에 실시간 에이전트 채팅으로 즉시 전달.
	// 게이트를 유지한 채 chatPending 루프로 에이전트에게 닿는다(ADR-009).
	const addComment = (targetId, text, quote = null, blockIds = null) => {
		setComments((c) => [
			...c,
			{
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				targetId,
				text,
				quote,
			},
		]);
		const body = { text };
		// 범위 코멘트가 여러 블록에 걸치면 전체 블록 목록을 스코프로 에이전트에게 전달.
		const scope = blockIds && blockIds.length ? blockIds.join(",") : targetId;
		if (scope) body.blockId = scope;
		if (quote) body.quote = quote;
		fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
			.then(() => window.dispatchEvent(new Event("fn-chat-update")))
			.catch(() => {});
	};
	const activate = (id) => {
		setActiveTargetId((prev) => {
			const next = prev === id ? null : id;
			// F1: 채팅 부분 코멘트를 위해 현재 선택 블록을 App 으로 끌어올린다.
			onActiveBlock?.(next);
			return next;
		});
	};

	const onRangeComment = (blockId, sel, quote, blockIds) => {
		const range = sel.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		highlightRange(range, "comment-hl"); // 멀티 노드/블록 안전 하이라이트
		sel.removeAllRanges();
		setActiveRange({ blockId, quote, rect, blockIds });
		setActiveTargetId(null);
	};
	const submitRange = () => {
		if (!rangeDraft.trim() || !activeRange) return;
		addComment(
			activeRange.blockId,
			rangeDraft.trim(),
			activeRange.quote,
			activeRange.blockIds,
		);
		setRangeDraft("");
		setActiveRange(null);
	};

	// 게이트 결정 전송 — pi 에이전트로 verdict 를 POST. 코멘트는 채팅으로 이미 전달됨.
	const sendConfirm = () => onGate({ verdict: "confirm", comments: [] });
	const sendRevert = (target) =>
		onGate({ verdict: "revert", comments: [], revertTo: target });

	const rangePopover = activeRange
		? createPortal(
				<div
					className="comment-popover comment-popover-fixed"
					style={{
						position: "fixed",
						top: activeRange.rect.bottom + 6,
						left: activeRange.rect.left,
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="popover-head">
						<span>
							영역 코멘트 ·{" "}
							{activeRange.blockIds && activeRange.blockIds.length > 1
								? activeRange.blockIds.join(", ")
								: activeRange.blockId}
						</span>
						<button onClick={() => setActiveRange(null)} title="닫기">
							✕
						</button>
					</div>
					<blockquote className="range-quote">“{activeRange.quote}”</blockquote>
					<div className="comment-input-row">
						<input
							value={rangeDraft}
							autoFocus
							placeholder="선택한 영역에 코멘트…"
							onChange={(e) => setRangeDraft(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && submitRange()}
						/>
						<button className="add-btn" onClick={submitRange}>
							추가
						</button>
					</div>
				</div>,
				document.body,
			)
		: null;

	return (
		<>
			<Topbar stage={stage} total={3} />
			<Stepper stages={stagesFor(stage)} />
			<div className="layout">
				<Toc items={toc} />
				<Document
					blocks={blocks}
					comments={comments}
					onAddComment={addComment}
					onActivate={activate}
					onRangeComment={onRangeComment}
					activeTargetId={activeTargetId}
					graphData={graphData}
					fontScale={fontScale}
				/>
			</div>
			<GateBar
				stage={stage}
				label={label}
				stageLabels={stageLabels}
				onConfirm={sendConfirm}
				onRevert={sendRevert}
				onReview={onReview}
			/>
			<div className="fs-control" role="group" aria-label="글자 크기">
				<button
					type="button"
					className="fs-btn"
					onClick={() =>
						setFontScale((v) => Math.max(0.8, Math.round((v - 0.1) * 10) / 10))
					}
					aria-label="글자 크기 작게"
					title="글자 작게"
				>
					−
				</button>
				<button
					type="button"
					className="fs-btn"
					onClick={() =>
						setFontScale((v) => Math.min(1.6, Math.round((v + 0.1) * 10) / 10))
					}
					aria-label="글자 크기 크게"
					title="글자 크게"
				>
					+
				</button>
			</div>
			{rangePopover}
		</>
	);
}
