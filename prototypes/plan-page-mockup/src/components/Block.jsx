import { useState } from "react";
import { createPortal } from "react-dom";

// 블록 타입별 내용 렌더링
function BlockContent({
	block,
	comments,
	onAddComment,
	activeTargetId,
	onActivate,
}) {
	switch (block.type) {
		case "heading":
			return <h2 className="block-content block-heading">{block.text}</h2>;
		case "paragraph":
			return <p className="block-content block-paragraph">{block.text}</p>;
		case "requirement":
			return (
				<div className="block-content req">
					<span className="id">{block.req.id}</span>
					<span>{block.req.desc}</span>
					<span className="tag">{block.req.tag}</span>
				</div>
			);
		case "code":
			return (
				<div className="block-content block-code">
					<span className="code-lang">{block.lang}</span>
					<pre>
						<code>{block.code}</code>
					</pre>
				</div>
			);
		case "todo":
			// 체크박스 클릭만 부모 전파 차단(토글 보존). 빈 영역 클릭은 팝오버로.
			return (
				<label className="block-content todo-row">
					<input
						type="checkbox"
						defaultChecked={block.checked}
						disabled
						onClick={(e) => e.stopPropagation()}
					/>
					<span>{block.text}</span>
				</label>
			);
		case "table":
			return (
				<TableBlock
					block={block}
					comments={comments}
					onAddComment={onAddComment}
					activeTargetId={activeTargetId}
					onActivate={onActivate}
				/>
			);
		case "graph":
			return (
				<div className="block-content graph-box">
					<pre className="graph-ascii">{block.ascii}</pre>
					<div className="graph-caption">{block.caption}</div>
				</div>
			);
		default:
			return null;
	}
}

// 표 블록 — 각 셀 클릭 시 셀 코멘트 팝오버. 활성 셀은 activeTargetId로 단일 관리.
// 셀 팝업은 createPortal(document.body) + fixed 로 표 DOM 밖에 렌더 → 표 레이아웃 영향 0.
function TableBlock({
	block,
	comments,
	onAddComment,
	activeTargetId,
	onActivate,
}) {
	const [draft, setDraft] = useState("");
	const [cellRect, setCellRect] = useState(null);

	const cellId = (r, c) => `${block.id}-r${r}-c${c}`;
	// 이 표에 속한 셀 id인지
	const activeCell =
		activeTargetId && activeTargetId.startsWith(`${block.id}-r`)
			? activeTargetId
			: null;

	const submit = () => {
		if (!draft.trim() || !activeCell) return;
		onAddComment(activeCell, draft.trim());
		setDraft("");
		onActivate(activeCell); // 제출 후 닫기
	};

	const renderCell = (r) => (content, c) => {
		const id = cellId(r, c);
		const cs = comments.filter((x) => x.targetId === id);
		const pending = cs.filter((x) => !x.applied);
		const Tag = r === -1 ? "th" : "td";
		return (
			<Tag
				key={c}
				className={`tcell ${pending.length ? "has-comment" : ""} ${
					activeCell === id ? "active" : ""
				}`}
				onClick={(e) => {
					e.stopPropagation();
					setCellRect(e.currentTarget.getBoundingClientRect());
					onActivate(id);
					setDraft("");
				}}
				title="셀 코멘트 달기"
			>
				{content}
				{cs.length > 0 && (
					<span className="tcell-mark" title={`${cs.length}개 코멘트`}>
						💬{pending.length}
					</span>
				)}
			</Tag>
		);
	};

	const activePending = activeCell
		? comments.filter((x) => x.targetId === activeCell && !x.applied)
		: [];

	// 셀 팝업: document.body 에 fixed 로 렌더 (표 레이아웃 분리)
	const cellPopover =
		activeCell && cellRect ? (
			<div
				className="comment-popover comment-popover-fixed"
				style={{
					position: "fixed",
					top: cellRect.bottom + 6,
					left: cellRect.left,
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="popover-head">
					<span>셀 코멘트 · {activeCell}</span>
					<button onClick={() => onActivate(activeCell)} title="닫기">
						✕
					</button>
				</div>
				{activePending.length > 0 && (
					<div className="comment-list">
						{activePending.map((c) => (
							<div key={c.id} className="comment-item">
								💬 {c.text}
							</div>
						))}
					</div>
				)}
				<div className="comment-input-row">
					<input
						value={draft}
						autoFocus
						placeholder={`${activeCell} 셀에 코멘트…`}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && submit()}
					/>
					<button className="add-btn" onClick={submit}>
						추가
					</button>
				</div>
			</div>
		) : null;

	return (
		<div className="block-content block-table">
			<table>
				<thead>
					<tr>{block.headers.map(renderCell(-1))}</tr>
				</thead>
				<tbody>
					{block.rows.map((row, r) => (
						<tr key={r}>{row.map(renderCell(r))}</tr>
					))}
				</tbody>
			</table>

			{createPortal(cellPopover, document.body)}
		</div>
	);
}

// 모든 블록의 공통 wrapper.
// hover 시 영역 강조 → 좌클릭 시 코멘트 팝오버(창). 팝오버는 전역 단일(activeTargetId).
export default function Block({
	block,
	comments,
	onAddComment,
	activeTargetId,
	onActivate,
}) {
	const [draft, setDraft] = useState("");

	const open = activeTargetId === block.id;
	const cs = comments.filter((c) => c.targetId === block.id);
	const pending = cs.filter((c) => !c.applied);
	const hasApplied = cs.some((c) => c.applied);

	const submit = () => {
		if (!draft.trim()) return;
		onAddComment(block.id, draft.trim());
		setDraft("");
		onActivate(block.id); // 닫기
	};

	return (
		<div
			className={`block ${pending.length ? "has-comment" : ""} ${
				hasApplied ? "applied" : ""
			}`}
			onClick={() => {
				onActivate(block.id);
				setDraft("");
			}}
			title="클릭하여 코멘트"
		>
			{cs.length > 0 && (
				<span className="comment-count" title={`${pending.length}개 코멘트`}>
					💬{pending.length}
				</span>
			)}

			<BlockContent
				block={block}
				comments={comments}
				onAddComment={onAddComment}
				activeTargetId={activeTargetId}
				onActivate={onActivate}
			/>

			{open && (
				<div className="comment-popover" onClick={(e) => e.stopPropagation()}>
					<div className="popover-head">
						<span>코멘트 · {block.id}</span>
						<button onClick={() => onActivate(block.id)} title="닫기">
							✕
						</button>
					</div>
					{pending.length > 0 && (
						<div className="comment-list">
							{pending.map((c) => (
								<div key={c.id} className="comment-item">
									💬 {c.text}
								</div>
							))}
						</div>
					)}
					<div className="comment-input-row">
						<input
							value={draft}
							autoFocus
							placeholder={`${block.id}에 코멘트…`}
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && submit()}
						/>
						<button className="add-btn" onClick={submit}>
							추가
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
