// FactoryNote plan page — 시안 A(모노톤) React 목업
// 본문은 마크다운 파일(plan.md)에서 생성. 블록 단위 + 드래그 영역 코멘트 지원.
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Topbar from "./components/Topbar";
import Stepper from "./components/Stepper";
import Toc from "./components/Toc";
import Document from "./components/Document";
import SidePanel from "./components/SidePanel";
import GateBar from "./components/GateBar";
import planMd from "./data/plan.md?raw";
import { mdToBlocks } from "./lib/mdToBlocks";

const stages = [
	{ n: 1, label: "요청 이해", state: "current" },
	{ n: 2, label: "시나리오", state: "locked" },
	{ n: 3, label: "모듈 설계", state: "locked" },
	{ n: 4, label: "클래스 설계", state: "locked" },
	{ n: 5, label: "구현 계획", state: "locked" },
	{ n: 6, label: "최종 검증", state: "locked" },
];

const loop = { round: 2, remaining: "1 이슈" };
const feedbackIssues = [
	{ resolved: true, text: "✓ FR-2 솔트 길이 명시 — 해결" },
	{ resolved: false, text: "⚠ NFR-1 세션 만료 정책 누락 — Design 재검토 요청" },
];

const stripHtml = (html) => html.replace(/<[^>]+>/g, "").trim();

export default function App() {
	const blocks = useMemo(() => mdToBlocks(planMd), []);
	const toc = useMemo(() => {
		const hs = blocks.filter(
			(b) => b.type === "heading" && b.level >= 2 && b.level <= 3,
		);
		return hs.map((b, idx) => ({ label: stripHtml(b.html), cur: idx === 0 }));
	}, [blocks]);

	const [comments, setComments] = useState([]); // {id,targetId,text,quote?,applied}
	const [activeTargetId, setActiveTargetId] = useState(null); // 블록 팝오버 (단일)
	const [activeRange, setActiveRange] = useState(null); // 드래그 영역 팝오버 {blockId,quote,rect}
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

	// 드래그 영역 코멘트: 선택 텍스트를 하이라이트(mark) + 영역 팝오버 오픈
	const onRangeComment = (blockId, sel, quote) => {
		const rect = sel.getRangeAt(0).getBoundingClientRect();
		try {
			const range = sel.getRangeAt(0);
			const mark = document.createElement("mark");
			mark.className = "comment-hl";
			range.surroundContents(mark); // 단일 노드 범위만. 실패 시 하이라이트 생략.
		} catch {
			/* 여러 노드에 걸친 범위 — 하이라이트 없이 quote만 저장 */
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
			<Topbar stage={1} total={6} />
			<Stepper stages={stages} />
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
				stage={1}
				label="요청 이해"
				pendingCount={pendingCount}
				onApply={applyComments}
			/>
			{rangePopover}
		</>
	);
}
