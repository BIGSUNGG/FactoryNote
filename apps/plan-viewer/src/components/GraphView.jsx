// 읽기 전용 자동 배치 계층 그래프 뷰(ADR-018) — 그래프 트리를 문서 속 블록으로 렌더.
// 기본은 루트 레벨(모듈 관계도). 자식이 있는 노드를 더블클릭하면 하단에 자식 레벨
// 패널이 스택으로 추가되고, 같은 노드 재더블클릭 시 선택 해제(토글). 여러 노드 선택 시
// 같은 패널에 병합 렌더(교차 참조 포함, 미선택 영역 참조는 숨김). 임의 깊이 동일 로직.
// 수동 위치 조정 없음 — 배치는 layoutGraph 만 담당(ADR-016 자동 배치 승계).
import { useMemo, useState } from "react";
import ReactFlow, { Background, Handle, Position } from "reactflow";
import "reactflow/dist/style.css";
import { layoutSection } from "../lib/layoutGraph";
import {
	levelTitle,
	mergeChildLevels,
	refsToEdges,
	toggleSelect,
} from "../lib/graphTree";

function ModuleNode({ data }) {
	return (
		<div
			className={"rf-module" + (data.selected ? " rf-selected" : "")}
			title={data.desc ?? ""}
		>
			<Handle type="target" position={Position.Top} />
			<div className="rf-mod-name">{data.label ?? data.name ?? data.id}</div>
			<div className="rf-mod-layer">{data.layer ?? ""}</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

function ExternalNode({ data }) {
	return (
		<div
			className={
				"rf-module rf-external" + (data.selected ? " rf-selected" : "")
			}
			title={data.desc ?? ""}
		>
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
		<div className={"rf-class" + (data.selected ? " rf-selected" : "")}>
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

/** 모듈/클래스 외 임의 레벨 노드(예: 메서드) — 이름 + 설명. */
function GenericNode({ data }) {
	return (
		<div
			className={"rf-generic" + (data.selected ? " rf-selected" : "")}
			title={data.desc ?? ""}
		>
			<Handle type="target" position={Position.Top} />
			<div className="rf-generic-name">
				{data.name ?? data.label ?? data.id}
			</div>
			{data.desc ? <div className="rf-generic-desc">{data.desc}</div> : null}
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

const NODE_TYPES = {
	module: ModuleNode,
	external: ExternalNode,
	modGroup: ModGroup,
	cls: ClassNode,
	class: ClassNode,
	default: GenericNode,
};

/** 레벨 1개 = 패널 1개. 선택 상태는 패널이 소유하고, 자식 패널은 재귀 스택. */
function LevelPanel({ level, depth }) {
	const [selected, setSelected] = useState([]);

	const section = useMemo(
		() => ({
			id: level.file,
			title: levelTitle(level, depth),
			nodes: level.nodes ?? [],
			edges: refsToEdges(level.nodes),
		}),
		[level, depth],
	);
	const laid = useMemo(() => layoutSection(section), [section]);
	const expandable = useMemo(
		() =>
			new Set((level.nodes ?? []).filter((n) => n.children).map((n) => n.id)),
		[level],
	);
	const nodes = useMemo(
		() =>
			laid.nodes.map((n) => ({
				...n,
				data: {
					...n.data,
					selected: selected.includes(n.id),
					expandable: expandable.has(n.id),
				},
			})),
		[laid, selected, expandable],
	);
	const merged = useMemo(
		() => mergeChildLevels(level, selected),
		[level, selected],
	);

	if (laid.nodes.length === 0)
		return <div className="empty">표시할 그래프 노드가 없습니다.</div>;

	const selectedNames = (level.nodes ?? [])
		.filter((n) => selected.includes(n.id))
		.map((n) => n.label ?? n.name ?? n.id);

	return (
		<>
			<div className="graph-card">
				<h3 className="card-title">
					{depth === 0 ? "📦" : "🔍"} {section.title}
					{selectedNames.length > 0
						? ` — 선택: ${selectedNames.join(", ")}`
						: ""}{" "}
					<span className="graph-auto-note">
						(자동 배치
						{expandable.size > 0
							? " · 노드 더블클릭 = 하위 드릴다운/선택 해제"
							: ""}
						)
					</span>
				</h3>
				<div className="rf-wrap">
					<ReactFlow
						nodes={nodes}
						edges={laid.edges}
						nodeTypes={NODE_TYPES}
						nodesDraggable={false}
						nodesConnectable={false}
						elementsSelectable={false}
						zoomOnDoubleClick={false}
						onNodeDoubleClick={(_e, node) => {
							if (expandable.has(node.id)) {
								setSelected((s) => toggleSelect(s, node.id));
							}
						}}
						fitView
						minZoom={0.2}
						proOptions={{ hideAttribution: true }}
					>
						<Background color="rgba(17,24,39,0.08)" gap={20} />
					</ReactFlow>
				</div>
			</div>
			{merged ? <LevelPanel level={merged} depth={depth + 1} /> : null}
		</>
	);
}

export default function GraphView({ tree }) {
	if (!tree || !tree.nodes || tree.nodes.length === 0)
		return <div className="empty">그래프 트리가 비어 있습니다.</div>;
	return (
		<div className="graph-view">
			<LevelPanel level={tree} depth={0} />
		</div>
	);
}
