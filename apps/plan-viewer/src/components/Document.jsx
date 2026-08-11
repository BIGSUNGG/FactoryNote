import { useRef } from "react";
import Block from "./Block";

// 산출물 본문 = 마크다운 블록 시퀀스.
// 클릭 상호작용을 Document가 통합 처리:
//  - mouseup 으로 텍스트 드래그(선택) 감지 → 영역 코멘트(onRangeComment)
//  - 그 외 클릭 → 블록 코멘트 팝오버(onActivate)
export default function Document({
	blocks,
	comments,
	onAddComment,
	onActivate,
	onRangeComment,
	activeTargetId,
	graphData,
}) {
	const skipRef = useRef(false); // 직전 mouseup 이 드래그였으면 뒤따르는 click 무시
	const mainRef = useRef(null);

	const handleMouseUp = () => {
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount || sel.isCollapsed) return;
		const text = sel.toString().trim();
		if (!text) return;
		const el = sel.anchorNode?.parentElement?.closest?.("[data-block-id]");
		if (!el) return;
		// 선택이 걸친 모든 블록 수집(멀티 블록 드래그 → 전체 범위를 에이전트 스코프로).
		const range = sel.getRangeAt(0);
		const blockIds = mainRef.current
			? [...mainRef.current.querySelectorAll("[data-block-id]")]
					.filter((b) => range.intersectsNode(b))
					.map((b) => b.dataset.blockId)
			: [el.dataset.blockId];
		onRangeComment(el.dataset.blockId, sel, text, blockIds);
		skipRef.current = true; // 다음 click(블록 팝오버) 억제
	};

	const handleClick = (e) => {
		if (skipRef.current) {
			skipRef.current = false;
			return;
		}
		const el = e.target.closest("[data-block-id]");
		if (el) onActivate(el.dataset.blockId);
	};

	return (
		<main
			ref={mainRef}
			className="doc"
			onMouseUp={handleMouseUp}
			onClick={handleClick}
		>
			{blocks.map((b) => (
				<Block
					key={b.id}
					block={b}
					comments={comments}
					onAddComment={onAddComment}
					onActivate={onActivate}
					activeTargetId={activeTargetId}
					graphData={graphData}
				/>
			))}
		</main>
	);
}
