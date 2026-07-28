import { useState } from "react";
import { createPortal } from "react-dom";

// 마크다운 블록 타입별 내용 렌더링. inline 포맷은 html로 변환 → dangerouslySetInnerHTML.
function BlockContent({
	block,
	comments,
	onAddComment,
	activeTargetId,
	onActivate,
}) {
	switch (block.type) {
		case "heading": {
			const Tag = `h${Math.min(Math.max(block.level || 2, 1), 6)}`;
			return (
				<Tag
					className={`block-content block-heading level-${block.level}`}
					dangerouslySetInnerHTML={{ __html: block.html }}
				/>
			);
		}
		case "paragraph":
			return (
				<p
					className="block-content block-paragraph"
					dangerouslySetInnerHTML={{ __html: block.html }}
				/>
			);
		case "list": {
			const Tag = block.ordered ? "ol" : "ul";
			return (
				<Tag className="block-content block-list">
					{block.items.map((it, idx) => (
						<li key={idx} className={it.checked != null ? "task-item" : ""}>
							{it.checked != null && (
								<input
									type="checkbox"
									checked={it.checked}
									disabled
									readOnly
									onClick={(e) => e.stopPropagation()}
								/>
							)}
							<span dangerouslySetInnerHTML={{ __html: it.html }} />
						</li>
					))}
				</Tag>
			);
		}
		case "code":
			return (
				<div className="block-content block-code">
					{block.lang && <span className="code-lang">{block.lang}</span>}
					<pre>
						<code>{block.code}</code>
					</pre>
				</div>
			);
		case "image":
			return (
				<figure className="block-content block-image">
					<img src={block.src} alt={block.alt} />
					{block.alt && <figcaption>{block.alt}</figcaption>}
				</figure>
			);
		case "quote":
			return (
				<blockquote
					className="block-content block-quote"
					dangerouslySetInnerHTML={{ __html: block.html }}
				/>
			);
		case "hr":
			return <hr className="block-content block-hr" />;
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
		default:
			return null;
	}
}

// 표 블록 — 각 셀 클릭 시 셀 코멘트 팝오버(고정 위치, 표 레이아웃 분리).
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
	const activeCell =
		activeTargetId && activeTargetId.startsWith(`${block.id}-r`)
			? activeTargetId
			: null;

	const submit = () => {
		if (!draft.trim() || !activeCell) return;
		onAddComment(activeCell, draft.trim());
		setDraft("");
		onActivate(activeCell);
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
				<span dangerouslySetInnerHTML={{ __html: content }} />
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

// 모든 블록 공통 wrapper.
// 클릭 처리는 Document가 통합(onMouseUp=드래그 영역, onClick=블록).
// Block은 표시 + 내부 팝오버(블록/셀)만 담당.
export default function Block({
	block,
	comments,
	onAddComment,
	onActivate,
	activeTargetId,
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
		onActivate(block.id);
	};

	return (
		<div
			className={`block ${pending.length ? "has-comment" : ""} ${
				hasApplied ? "applied" : ""
			}`}
			data-block-id={block.id}
			title="클릭하여 코멘트 · 드래그하여 영역 코멘트"
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

			{pending.length > 0 && (
				<div className="comment-list">
					{pending.map((c) => (
						<div key={c.id}>
							{c.quote && <div className="comment-quote">“{c.quote}”</div>}
							<div className="comment-item">💬 {c.text}</div>
						</div>
					))}
				</div>
			)}

			{hasApplied && <span className="apply-badge">✏ 수정 지시 반영됨</span>}

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
								<div key={c.id}>
									{c.quote && <div className="comment-quote">“{c.quote}”</div>}
									<div className="comment-item">💬 {c.text}</div>
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
