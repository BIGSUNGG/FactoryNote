import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import Toc from "./Toc";
import Document from "./Document";
import SidePanel from "./SidePanel";
import GateBar from "./GateBar";
import { mdToBlocks, replaceGraphFence } from "../lib/mdToBlocks";

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

const loop = { round: 2, remaining: "1 이슈" };
const feedbackIssues = [
	{ resolved: true, text: "✓ FR-2 솔트 길이 명시 — 해결" },
	{ resolved: false, text: "⚠ NFR-1 세션 만료 정책 누락 — Design 재검토 요청" },
];

const stripHtml = (html) => html.replace(/<[^>]+>/g, "").trim();

export default function PlanPage({
	mdSource,
	stage,
	onGate,
	stageLabels = {},
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
	// 그래프 편집: { [fenceIndex]: sections }. 사용자가 인라인 에디터에서 편집한
	// 그래프만 이 맵에 들어가고, 제출 시 해당 factorynote-graph 펜스에만 직렬화된다.
	const [graphEdits, setGraphEdits] = useState({});
	const onGraphChange = (fenceIndex, sections) =>
		setGraphEdits((g) => ({ ...g, [fenceIndex]: sections }));

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

	// 게이트 결정 전송 — pi 에이전트로 verdict+comments(+편집된 md) 를 POST.
	const toGateComment = (c) => {
		const o = { blockId: c.targetId, text: c.text };
		if (c.quote) o.quote = c.quote;
		return o;
	};
	// 그래프 편집이 있으면 md 소스의 해당 펜스들만 갱신해 전체 md 를 만든다(나머지 불변).
	const buildEditedMd = () => {
		const fis = Object.keys(graphEdits);
		if (fis.length === 0) return null;
		let md = mdSource;
		for (const fi of fis) {
			md = replaceGraphFence(
				md,
				Number(fi),
				JSON.stringify({ sections: graphEdits[fi] }),
			);
		}
		return md;
	};
	const sendConfirm = () => {
		const md = buildEditedMd();
		onGate({ verdict: "confirm", comments: [], ...(md ? { md } : {}) });
	};
	const sendRevert = (target) =>
		onGate({ verdict: "revert", comments: [], revertTo: target });
	const sendModify = () => {
		const pending = comments.filter((c) => !c.applied).map(toGateComment);
		const md = buildEditedMd();
		onGate({ verdict: "modify", comments: pending, ...(md ? { md } : {}) });
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
					onGraphChange={onGraphChange}
					graphEdits={graphEdits}
				/>
				<SidePanel loop={loop} issues={feedbackIssues} comments={comments} />
			</div>
			<GateBar
				stage={stage}
				label={label}
				pendingCount={pendingCount}
				stageLabels={stageLabels}
				onConfirm={sendConfirm}
				onModify={sendModify}
				onRevert={sendRevert}
			/>
			{rangePopover}
		</>
	);
}
