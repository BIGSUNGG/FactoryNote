import Block from "./Block";

// 산출물 본문 = 마크다운 블록 시퀀스. 타이틀·메타도 plan.md에서 온다(고정 헤더 없음).
// 모든 블록이 hover→좌클릭 코멘트 팝오버 대상.
export default function Document({
	blocks,
	comments,
	onAddComment,
	activeTargetId,
	onActivate,
}) {
	return (
		<main className="doc">
			{blocks.map((b) => (
				<Block
					key={b.id}
					block={b}
					comments={comments}
					onAddComment={onAddComment}
					activeTargetId={activeTargetId}
					onActivate={onActivate}
				/>
			))}
		</main>
	);
}
