import { useRef, useEffect, useState } from "react";
import Block from "./Block";
import DocScrollbar from "./DocScrollbar";
import { blockKey } from "../lib/blockDiff";
import { trackHeight, markGeom } from "../lib/scrollbar";
import { activeHeadingId } from "../lib/activeHeading";

// 산출물 본문 = 마크다운 블록 시퀀스.
// 클릭 상호작용을 Document가 통합 처리:
//  - mouseup 으로 텍스트 드래그(선택) 감지 → 영역 코멘트(onRangeComment)
//  - 그 외 클릭 → 블록 코멘트 팝오버(onActivate)
export default function Document({
	blocks,
	changedIds, // ADR-027 변경 하이라이트: 추가·수정된 블록 id 집합
	addedIds, // ADR-027: 순수 추가 블록(등장 연출 대상) — changedIds 부분집합
	comments,
	onAddComment,
	onActivate,
	onRangeComment,
	activeTargetId,
	graphData,
	fontScale = 1,
	headingIds = [], // 목차 추적 대상(h2/h3) 블록 id — PlanPage 가 toc 에서 전달
	onActiveHeading, // scroll-spy: 현재 최상단 헤딩 id 를 상위로 보고
	onOpenGraph, // 그래프 블록 더블클릭 → 상세 탭 열기(ADR-031)
	onGraphDragStart, // 그래프 블록 헤더 드래그 시작 → 탭 분할(ADR-032)
}) {
	const skipRef = useRef(false); // 직전 mouseup 이 드래그였으면 뒤따르는 click 무시
	const mainRef = useRef(null);
	const [railMarks, setRailMarks] = useState([]); // ADR-027 스크롤 레일 변경 마커

	// 스크롤 레일 마커(ADR-027): 변경·추가 블록의 콘텐츠 내 위치를 스크롤바 트랙
	// 비율로 환원. 블록·하이라이트·글자 배율 변경 + 리사이즈·이미지 로드 시 재계산.
	useEffect(() => {
		const doc = mainRef.current;
		if (!doc) return;
		const compute = () => {
			const total = doc.scrollHeight;
			const client = doc.clientHeight;
			if (!trackHeight(client) || !total) return setRailMarks([]);
			const cs = getComputedStyle(doc);
			const padTop = parseFloat(cs.paddingTop) || 0;
			const padBottom = parseFloat(cs.paddingBottom) || 0;
			const next = [];
			for (const b of blocks) {
				if (!changedIds?.has(b.id)) continue;
				const node = doc.querySelector(`[data-block-id="${b.id}"]`);
				if (!node) continue;
				const gm = markGeom(node.offsetTop, node.offsetHeight, {
					total,
					client,
					padTop,
					padBottom,
				});
				next.push({
					id: b.id,
					top: gm.top,
					h: gm.h,
					added: addedIds?.has(b.id),
				});
			}
			setRailMarks(next);
		};
		compute();
		window.addEventListener("resize", compute);
		doc.addEventListener("load", compute, true); // 이미지 로드 후 오프셋 재계산
		return () => {
			window.removeEventListener("resize", compute);
			doc.removeEventListener("load", compute, true);
		};
	}, [blocks, changedIds, addedIds, fontScale]);

	// scroll-spy: .doc 스크롤 시 상단 기준선(80px)을 지난 가장 마지막 h2/h3 헤딩 보고.
	// rAF 로 스로틀(스크롤 이벤트 빈도 완화), 블록/헤딩 변경·마운트·리사이즈에서 재계산.
	useEffect(() => {
		const el = mainRef.current;
		if (!el || !headingIds.length) return;
		let raf = 0;
		const compute = () => {
			raf = 0;
			const cTop = el.getBoundingClientRect().top;
			const heads = headingIds
				.map((id) => {
					const node = el.querySelector(`[data-block-id="${id}"]`);
					if (!node) return null;
					const top = node.getBoundingClientRect().top - cTop + el.scrollTop;
					return { id, top };
				})
				.filter(Boolean);
			const id = activeHeadingId(heads, el.scrollTop, 80);
			if (id) onActiveHeading?.(id);
		};
		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(compute);
		};
		compute(); // 초기 로드 직후 현재 헤딩 반영
		el.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			if (raf) cancelAnimationFrame(raf);
			el.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, [headingIds, blocks, onActiveHeading]);

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
		<div className="doc-wrap">
			<main
				ref={mainRef}
				id="doc-content"
				className="doc"
				style={{ "--fs": String(fontScale) }}
				onMouseUp={handleMouseUp}
				onClick={handleClick}
			>
				{(() => {
					// key = 콘텐츠 지문 + 출현 순서(ADR-027 연출 안정성).
					// 위치 기반 id(b0..) 는 재작성 시 같은 DOM 노드가 재사용돼 등장
					// 애니메이션이 재실행되지 않는다. 콘텐츠 키 기준으로는 새 블록만
					// 신규 마운트(연출 실행), 유지 블록은 노드를 지켜 하이라이트가
					// transition 으로 천천히 사라진다(위치 밀려남도 키 유지).
					const seen = {};
					return blocks.map((b) => {
						const k = blockKey(b);
						const occ = (seen[k] = (seen[k] ?? 0) + 1);
						return (
							<Block
								key={`${k}#${occ}`}
								block={b}
								changed={changedIds?.has(b.id)}
								added={addedIds?.has(b.id)}
								comments={comments}
								onAddComment={onAddComment}
								onActivate={onActivate}
								activeTargetId={activeTargetId}
								graphData={graphData}
								onOpenGraph={onOpenGraph}
								onGraphDragStart={onGraphDragStart}
							/>
						);
					});
				})()}
			</main>
			{/* 커스텀 스크롤바 — 네이티브 바 대체, ADR-027 마커 트랙 내 통합 */}
			<DocScrollbar docRef={mainRef} marks={railMarks} blocks={blocks} />
		</div>
	);
}
