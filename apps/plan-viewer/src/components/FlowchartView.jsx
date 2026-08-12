// 플로우차트 읽기 전용 SVG 렌더러(ADR-021).
// 배치는 lib/layoutFlowchart.js 순수 함수 — 여기선 렌더만. 조작 없음(블록 코멘트는 헤더로).
import { useMemo } from "react";
import { layoutFlowchart } from "../lib/layoutFlowchart.js";

function NodeShape({ node }) {
	if (node.shape === "decision") {
		const cx = node.x + node.w / 2;
		const cy = node.y + node.h / 2;
		return (
			<polygon
				className="flow-node-shape decision"
				points={`${cx},${node.y - 6} ${node.x + node.w + 10},${cy} ${cx},${node.y + node.h + 6} ${node.x - 10},${cy}`}
			/>
		);
	}
	return (
		<rect
			className={`flow-node-shape ${node.shape}`}
			x={node.x}
			y={node.y}
			width={node.w}
			height={node.h}
			rx={node.shape === "terminal" ? node.h / 2 : 6}
		/>
	);
}

export default function FlowchartView({ data }) {
	const layout = useMemo(() => layoutFlowchart(data), [data]);

	return (
		<svg
			className="flow-view"
			width={layout.width}
			height={layout.height}
			viewBox={`0 0 ${layout.width} ${layout.height}`}
			role="img"
			aria-label={data.title || "플로우차트"}
		>
			<defs>
				<marker
					id="flow-arrow"
					markerWidth="8"
					markerHeight="8"
					refX="7"
					refY="4"
					orient="auto"
				>
					<path d="M0,0 L8,4 L0,8 Z" className="flow-arrowhead" />
				</marker>
			</defs>

			{layout.edges.map((e, i) => (
				<g key={`e-${i}`} className={`flow-edge ${e.back ? "back" : ""}`}>
					<line
						x1={e.x1}
						y1={e.y1}
						x2={e.x2}
						y2={e.y2}
						markerEnd="url(#flow-arrow)"
					/>
					{e.label && (
						<text
							className="flow-edge-label"
							x={(e.x1 + e.x2) / 2 + 4}
							y={(e.y1 + e.y2) / 2}
						>
							{e.label}
						</text>
					)}
				</g>
			))}

			{layout.nodes.map((n) => (
				<g key={n.id} className={`flow-node ${n.shape}`}>
					<NodeShape node={n} />
					<text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle">
						{n.label}
					</text>
				</g>
			))}
		</svg>
	);
}
