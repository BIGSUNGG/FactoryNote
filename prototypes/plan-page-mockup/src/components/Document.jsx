import Block from "./Block";

// 산출물 본문 = 블록 시퀀스. 모든 블록이 hover→좌클릭 코멘트 팝오버 대상.
// h1/meta-quote는 페이지 헤더(고정), 그 아래 blocks가 편집 가능 영역.
export default function Document({
	blocks,
	comments,
	onAddComment,
	activeTargetId,
	onActivate,
}) {
	return (
		<main className="doc">
			<h1>📖 Stage 1 — 요청 이해</h1>
			<div className="meta-quote">
				<span>
					<b>Stage:</b> 1/6
				</span>
				<span>
					<b>게이트:</b> 대기
				</span>
				<span>
					<b>Design↔Feedback:</b> 라운드 2
				</span>
				<span>
					<b>우선순위:</b> 🔴 High
				</span>
			</div>

			<p style={{ color: "var(--muted)", marginBottom: "var(--s4)" }}>
				모든 블록(제목·본문·요구사항·코드·체크리스트·표·다이어그램)에 마우스를
				올려 영역이 나타나면 좌클릭해 코멘트 창을 여세요. 표 셀도 개별 코멘트
				가능. 하단 <b>수정 지시</b>로 한 번에 반영됩니다.
			</p>

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
