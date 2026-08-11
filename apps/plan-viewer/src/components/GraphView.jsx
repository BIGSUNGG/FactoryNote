// 읽기 전용 자동 배치 그래프 뷰 — 그래프 JSON(sections)을 문서 속 블록으로 렌더(ADR-016).
// 수동 위치 조정 없음: 드래그·리사이즈·연결·편집 전부 비활성. 배치는 layoutGraph 만 담당.
// 모든 스테이지가 같은 문서 렌더 경로를 공유하므로 그래프도 블록 하나로 그린다.
import { useMemo } from "react";
import ReactFlow, { Background, Handle, Position } from "reactflow";
import "reactflow/dist/style.css";
import { layoutSection } from "../lib/layoutGraph";

function ModuleNode({ data }) {
	return (
		<div className="rf-module" title={data.desc ?? ""}>
			<Handle type="target" position={Position.Top} />
			<div className="rf-mod-name">{data.label ?? data.name ?? data.id}</div>
			<div className="rf-mod-layer">{data.layer ?? ""}</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

function ExternalNode({ data }) {
	return (
		<div className="rf-module rf-external" title={data.desc ?? ""}>
			<Handle type="target" position={Position.Top} />
			<div className="rf-mod-name">{data.label ?? data.name ?? data.id}</div>
			<div className="rf-mod-layer">{data.layer ?? "External"}</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

function ModGroup({ data }) {
	return (
		<div className="rf-modgroup">
			<div className="rf-modgroup-label">
				{data.label ?? data.name ?? data.id}
			</div>
		</div>
	);
}

function ClassNode({ data }) {
	return (
		<div className="rf-class">
			<Handle type="target" position={Position.Top} />
			<div className="rf-class-name">{data.name ?? data.label ?? data.id}</div>
			<div className="rf-class-module">{data.module ?? ""}</div>
			<div className="rf-class-section">
				{(data.attrs ?? []).map((a) => (
					<div key={a} className="rf-class-attr">
						{a}
					</div>
				))}
			</div>
			<div className="rf-class-section">
				{(data.methods ?? []).map((m) => (
					<div key={m} className="rf-class-method">
						{m}
					</div>
				))}
			</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

const NODE_TYPES_MODULE = { module: ModuleNode, external: ExternalNode };
const NODE_TYPES_CLASS = { modGroup: ModGroup, cls: ClassNode };

function SectionView({ section }) {
	const laid = useMemo(() => layoutSection(section), [section]);
	if (laid.nodes.length === 0)
		return <div className="empty">표시할 그래프 노드가 없습니다.</div>;
	return (
		<div className="graph-card">
			<h3 className="card-title">
				{laid.isClass ? "🔧 클래스 구조" : "📦 모듈 의존 관계도"} — {laid.title}{" "}
				<span className="graph-auto-note">(관계 기반 자동 배치)</span>
			</h3>
			<div className="rf-wrap">
				<ReactFlow
					nodes={laid.nodes}
					edges={laid.edges}
					nodeTypes={laid.isClass ? NODE_TYPES_CLASS : NODE_TYPES_MODULE}
					nodesDraggable={false}
					nodesConnectable={false}
					elementsSelectable={false}
					zoomOnDoubleClick={false}
					fitView
					minZoom={0.2}
					proOptions={{ hideAttribution: true }}
				>
					<Background color="rgba(17,24,39,0.08)" gap={20} />
				</ReactFlow>
			</div>
		</div>
	);
}

export default function GraphView({ sections }) {
	if (!sections || sections.length === 0)
		return <div className="empty">그래프 섹션이 비어 있습니다.</div>;
	return (
		<div className="graph-view">
			{sections.map((s, i) => (
				<SectionView key={s.id ?? i} section={s} />
			))}
		</div>
	);
}
