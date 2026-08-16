import { useEffect, useState } from "react";
import {
	MIN_THUMB,
	thumbGeom,
	scrollForTrackClick,
	dragToScroll,
} from "../lib/scrollbar";

// 커스텀 스크롤바 — .doc 의 네이티브 스크롤바를 대체(트랙+thumb, ADR-027 마커 통합).
// 휠·키보드(본문 포커스)·touch 는 .doc 네이티브 스크롤 유지(overflow 유지) —
// 여기선 thumb 드래그·트랙 클릭·트랙 키보드만 담당. 스크롤 물리 재구현 없음.
export default function DocScrollbar({ docRef, marks = [], blocks }) {
	const [s, setS] = useState({ top: 0, client: 0, total: 0 });

	// .doc 스크롤·리사이즈·콘텐츠 변경 시 지오메트리 동기화.
	useEffect(() => {
		const doc = docRef.current;
		if (!doc) return;
		const sync = () =>
			setS({
				top: doc.scrollTop,
				client: doc.clientHeight,
				total: doc.scrollHeight,
			});
		sync();
		doc.addEventListener("scroll", sync, { passive: true });
		const ro =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
		ro?.observe(doc);
		return () => {
			doc.removeEventListener("scroll", sync);
			ro?.disconnect();
		};
	}, [docRef, blocks]);

	const g = thumbGeom(s);
	if (!g) return null;

	const doc = () => docRef.current;

	// thumb 드래그 — 시작 시점 scrollTop 에 이동량 환산 누적(윈도우 리스너).
	const startDrag = (e) => {
		e.preventDefault();
		e.stopPropagation();
		const el = doc();
		if (!el) return;
		const startY = e.clientY;
		const startTop = el.scrollTop;
		const move = (ev) => {
			el.scrollTop = startTop + dragToScroll(ev.clientY - startY, g, s);
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};

	// 트랙 클릭 — thumb 중심이 클릭 지점으로 점프.
	const onTrackDown = (e) => {
		const el = doc();
		if (!el) return;
		const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
		el.scrollTop = scrollForTrackClick(y, g, s);
	};

	// 트랙 키보드 — 화살표(40px)·Page(한 화면)·Home/End.
	const onKey = (e) => {
		const el = doc();
		if (!el) return;
		const delta = {
			ArrowDown: 40,
			ArrowUp: -40,
			PageDown: s.client,
			PageUp: -s.client,
		}[e.key];
		if (delta !== undefined) {
			el.scrollTop += delta;
			e.preventDefault();
		} else if (e.key === "Home") {
			el.scrollTop = 0;
			e.preventDefault();
		} else if (e.key === "End") {
			el.scrollTop = s.total;
			e.preventDefault();
		}
	};

	const pct = Math.round((s.top / (s.total - s.client)) * 100);

	return (
		<div
			className="doc-scroll"
			role="scrollbar"
			aria-controls="doc-content"
			aria-valuenow={pct}
			tabIndex={0}
			onPointerDown={onTrackDown}
			onKeyDown={onKey}
		>
			<div
				className="doc-scroll-thumb"
				style={{ top: g.top, height: g.h }}
				onPointerDown={startDrag}
			/>
			{/* ADR-027 변경 마커 — 트랙 안 세그먼트(thumb 위, 반투명이라 thumb 비침) */}
			{marks.map((m) => (
				<span
					key={m.id}
					className={`doc-rail-mark${m.added ? " added" : ""}`}
					style={{ top: m.top, height: m.h }}
				/>
			))}
		</div>
	);
}

export { MIN_THUMB };
