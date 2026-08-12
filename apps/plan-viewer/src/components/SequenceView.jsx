// 시퀀스 다이어그램 읽기 전용 SVG 렌더러(ADR-021).
// 배치는 lib/layoutSequence.js 순수 함수 — 여기선 렌더만. 조작 없음(블록 코멘트는 헤더로).
import { useMemo } from "react";
import { layoutSequence, SEQ_METRICS } from "../lib/layoutSequence.js";

export default function SequenceView({ data }) {
	const layout = useMemo(() => layoutSequence(data), [data]);
	const m = SEQ_METRICS;
	const lifelineTop = m.pad + m.headH;

	return (
		<svg
			className="seq-view"
			width={layout.width}
			height={layout.height}
			viewBox={`0 0 ${layout.width} ${layout.height}`}
			role="img"
			aria-label={data.title || "시퀀스 다이어그램"}
		>
			<defs>
				<marker
					id="seq-arrow"
					markerWidth="8"
					markerHeight="8"
					refX="7"
					refY="4"
					orient="auto"
				>
					<path d="M0,0 L8,4 L0,8 Z" className="seq-arrowhead" />
				</marker>
			</defs>

			{layout.fragments.map((f, i) => (
				<g key={`frag-${i}`} className={`seq-fragment depth-${f.depth}`}>
					<rect x={f.x} y={f.y} width={f.w} height={f.h} rx="3" />
					<path
						className="seq-fragment-tab"
						d={`M${f.x},${f.y} h${Math.min(70, f.w)} v16 h-10 l-6,6 h-${Math.min(54, Math.max(0, f.w - 16))} Z`}
					/>
					<text x={f.x + 6} y={f.y + 12} className="seq-fragment-label">
						{f.kind}
						{f.label ? ` ${f.label}` : ""}
					</text>
				</g>
			))}

			{layout.participants.map((p) => (
				<g key={p.id} className="seq-participant">
					<line
						className="seq-lifeline"
						x1={p.x}
						y1={lifelineTop}
						x2={p.x}
						y2={layout.height - m.pad}
					/>
					<rect
						x={p.x - m.colW / 2 + 8}
						y={m.pad}
						width={m.colW - 16}
						height={m.headH}
						rx="6"
					/>
					<text x={p.x} y={m.pad + m.headH / 2 + 4} textAnchor="middle">
						{p.name}
					</text>
				</g>
			))}

			{layout.messages.map((msg, i) =>
				msg.self ? (
					<path
						key={`m-${i}`}
						className={`seq-message ${msg.kind}`}
						d={`M${msg.x1},${msg.y - 8} h36 v16 h-36`}
						markerEnd="url(#seq-arrow)"
						fill="none"
					/>
				) : (
					<line
						key={`m-${i}`}
						className={`seq-message ${msg.kind}`}
						x1={msg.x1}
						y1={msg.y}
						x2={msg.x2}
						y2={msg.y}
						markerEnd="url(#seq-arrow)"
					/>
				),
			)}
			{layout.messages.map((msg, i) => (
				<text
					key={`ml-${i}`}
					className="seq-message-label"
					x={msg.self ? msg.x1 + 40 : (msg.x1 + msg.x2) / 2}
					y={msg.y - 5}
					textAnchor={msg.self ? "start" : "middle"}
				>
					{msg.label}
				</text>
			))}
		</svg>
	);
}
