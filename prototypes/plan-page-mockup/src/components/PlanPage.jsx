import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import Toc from "./Toc";
import Document from "./Document";
import SidePanel from "./SidePanel";
import GateBar from "./GateBar";
import { mdToBlocks } from "../lib/mdToBlocks";

// plan 스타일 페이지 — 마크다운 문서 + 블록/영역 코멘트. Stage 1·2·5 가 공유.
const STAGE_DEFS = [
	{ n: 1, label: "요청 이해", route: "" },
	{ n: 2, label: "시나리오", route: "scenarios" },
	{ n: 3, label: "모듈 아키텍처", route: "modules" },
	{ n: 4, label: "클래스 설계", route: "classes" },
	{ n: 5, label: "구현 계획", route: "impl" },
	{ n: 6, label: "최종 검증", route: "review" },
];
const stagesFor = (cur) =>
	STAGE_DEFS.map((s) => ({ ...s, state: s.n === cur ? "current" : "done" }));

const loop = { round: 2, remaining: "1 이슈" };
const feedbackIssues = [
	{ resolved: true, text: "✓ FR-2 솔트 길이 명시 — 해결" },
	{ resolved: false, text: "⚠ NFR-1 세션 만료 정책 누락 — Design 재검토 요청" },
];

const stripHtml = (html) => html.replace(/<[^>]+>/g, "").trim();

export default function PlanPage({ mdSource, stage, onGate }) {
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

	const addComment = (targetId, text, quote = null) => {
		setComments((c) => [
			...c,
			{
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				targetId,
				text,
				quote,
				applied: false,
			},
		]);
	};
	const applyComments = () => {
		setComments((c) => c.map((x) => ({ ...x, applied: true })));
		setActiveTargetId(null);
		setActiveRange(null);
	};
	const activate = (id) =>
		setActiveTargetId((prev) => (prev === id ? null : id));

	const onRangeComment = (blockId, sel, quote) => {
		const rect = sel.getRangeAt(0).getBoundingClientRect();
		try {
			const range = sel.getRangeAt(0);
			const mark = document.createElement("mark");
			mark.className = "comment-hl";
			range.surroundContents(mark);
		} catch {
			/* 다중 노드 범위 — 하이라이트 생략 */
		}
		sel.removeAllRanges();
		setActiveRange({ blockId, quote, rect });
		setActiveTargetId(null);
	};
	const submitRange = () => {
		if (!rangeDraft.trim() || !activeRange) return;
		addComment(activeRange.blockId, rangeDraft.trim(), activeRange.quote);
		setRangeDraft("");
		setActiveRange(null);
	};

	const pendingCount = comments.filter((c) => !c.applied).length;

	// 게이트 결정 전송 — pi 에이전트로 verdict+comments 를 POST.
	const toGateComment = (c) => {
		const o = { blockId: c.targetId, text: c.text };
		if (c.quote) o.quote = c.quote;
		return o;
	};
	const sendConfirm = () => onGate({ verdict: "confirm", comments: [] });
	const sendRevert = () => onGate({ verdict: "revert", comments: [] });
	const sendModify = () => {
		const pending = comments.filter((c) => !c.applied).map(toGateComment);
		onGate({ verdict: "modify", comments: pending });
	};

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
						<span>영역 코멘트 · {activeRange.blockId}</span>
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
			<Topbar stage={stage} total={6} />
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
				/>
				<SidePanel loop={loop} issues={feedbackIssues} comments={comments} />
			</div>
			<GateBar
				stage={stage}
				label={label}
				pendingCount={pendingCount}
				onConfirm={sendConfirm}
				onModify={sendModify}
				onRevert={sendRevert}
			/>
			{rangePopover}
		</>
	);
}
