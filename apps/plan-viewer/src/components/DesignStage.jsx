// Stage 2(모듈·클래스 설계) — md 단일진실 에디터. F2.
// mdSource 의 ```factorynote-graph 펜스(구조) → react-flow 그래프(편집 가능),
// 나머지 prose → 하단 아키텍처 설명. 그래프 편집은 게이트 제출 시 md 구조 펜스로
// 역동기화(applyStructureToMarkdown)해 artifactMd 로 전송 → 에이전트 채택.
// 직접 편집 → 채택(5대 원칙 — 게이트 거쳐 채택). F1 채팅으로 구조/설명 모두 수정.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactFlow, {
	Background,
	Controls,
	MiniMap,
	applyNodeChanges,
	applyEdgeChanges,
	addEdge,
	Handle,
	Position,
	NodeResizer,
} from "reactflow";
import "reactflow/dist/style.css";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import GateBar from "./GateBar";
import {
	gridPos,
	normalizeSections,
	sectionIsClass,
} from "../lib/graphNormalize";
import { parseDesignMarkdown, applyStructureToMarkdown } from "../lib/designMd";
import { mdToBlocks } from "../lib/mdToBlocks";

const LAYERS = ["API", "Service", "Repository", "Util", "External"];
const STAGE_DEFS = [
	{ n: 1, label: "요청 이해·시나리오" },
	{ n: 2, label: "모듈·클래스 설계" },
	{ n: 3, label: "구현 계획" },
];
const stagesFor = (cur) =>
	STAGE_DEFS.map((s) => ({
		...s,
		state: s.n === cur ? "current" : s.n < cur ? "done" : "locked",
	}));

// --- 노드 렌더 컴포넌트(GraphStage 와 동일) ---
function ModuleNode({ data }) {
	return (
		<div className="rf-module" title="드래그 · 클릭 상세 · 우클릭 제거">
			<Handle type="target" position={Position.Top} />
			<div className="rf-mod-name">{data.label ?? data.name ?? data.id}</div>
			<div className="rf-mod-layer">{data.layer ?? ""}</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
function ExternalNode({ data }) {
	return (
		<div className="rf-module rf-external" title="외부 · 우클릭 제거">
			<Handle type="target" position={Position.Top} />
			<div className="rf-mod-name">{data.label ?? data.name ?? data.id}</div>
			<div className="rf-mod-layer">{data.layer ?? "External"}</div>
		</div>
	);
}
function ModGroup({ data }) {
	return (
		<div className="rf-modgroup">
			<NodeResizer
				minWidth={140}
				minHeight={90}
				isVisible
				lineColor="#111827"
				handleStyle={{
					background: "#111827",
					border: "none",
					width: 8,
					height: 8,
					borderRadius: 2,
				}}
			/>
			<div className="rf-modgroup-label">
				{data.label ?? data.name ?? data.id}
			</div>
		</div>
	);
}
function ClassNode({ data }) {
	return (
		<div className="rf-class" title="드래그 · 클릭 상세 · 우클릭 제거">
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
const NODE_TYPES_3 = { module: ModuleNode, external: ExternalNode };
const NODE_TYPES_4 = { modGroup: ModGroup, cls: ClassNode };

export default function DesignStage({
	mdSource,
	stage,
	stageName,
	feature,
	onGate,
	onReview,
	stageLabels = {},
}) {
	const [sections, setSections] = useState(() =>
		normalizeSections(parseDesignMarkdown(mdSource).structure.sections),
	);
	const prose = useMemo(() => parseDesignMarkdown(mdSource).prose, [mdSource]);
	// 산출물 원본에서 구조를 찾았는지(에이전트가 ```factorynote-graph 를 썼는지).
	// 못 찾았으면 빈 그래프의 원인을 사용자에게 안내(자가진단).
	const sourceHadStructure = useMemo(
		() => parseDesignMarkdown(mdSource).structure.sections.length > 0,
		[mdSource],
	);
	// 구조 미검색 시 원인 진단(사용자가 파일을 열지 않아도 화면에서 식별 가능).
	const structureDiag = useMemo(() => {
		const src = mdSource ?? "";
		let reason;
		if (/```mermaid/.test(src))
			reason =
				"에이전트가 mermaid 다이어그램을 생성(JSON 구조 아님) — ```factorynote-graph JSON 재작성 요청";
		else if (/```json/.test(src))
			reason = "```json 펜스가 있으나 {sections:[...]} 형태가 아님";
		else if (/```[a-zA-Z]/.test(src))
			reason = "알 수 없는 코드펜스(포맷 불일치)";
		else reason = "구조 펜스 전무(에이전트가 prose만 작성했을 가능성)";
		return { reason, preview: src.slice(0, 240).trim() };
	}, [mdSource]);
	const [activeId, setActiveId] = useState(() => sections[0]?.id ?? null);
	const active = sections.find((s) => s.id === activeId) ?? sections[0] ?? null;
	const isClass = active ? sectionIsClass(active) : false;
	const [selected, setSelected] = useState({ type: "node", id: null });
	const [comments, setComments] = useState({});
	const [draft, setDraft] = useState("");
	const [menu, setMenu] = useState(null);

	// 에이전트가 채팅으로 산출물을 고치면 mdSource 가 갱신 → 구조를 다시 파싱(동기화).
	useEffect(() => {
		setSections(
			normalizeSections(parseDesignMarkdown(mdSource).structure.sections),
		);
	}, [mdSource]);

	useEffect(() => {
		if (sections.length === 0) {
			const id = `sec-${Date.now().toString(36)}`;
			setSections([{ id, title: "섹션 1", nodes: [], edges: [] }]);
			setActiveId(id);
		}
	}, [sections.length]);

	const labelOf = useCallback(
		(id) => {
			const n = active?.nodes.find((x) => x.id === id);
			return n?.data?.label ?? n?.data?.name ?? id;
		},
		[active],
	);

	const addSection = () => {
		const id = `sec-${Date.now().toString(36)}`;
		setSections((ss) => [
			...ss,
			{ id, title: `섹션 ${ss.length + 1}`, nodes: [], edges: [] },
		]);
		setActiveId(id);
	};
	const renameSection = (id, title) =>
		setSections((ss) => ss.map((s) => (s.id === id ? { ...s, title } : s)));
	const deleteSection = (id) =>
		setSections((ss) => {
			const next = ss.filter((s) => s.id !== id);
			if (activeId === id) setActiveId(next[0]?.id ?? null);
			return next;
		});

	const patchActive = (fn) =>
		setSections((ss) => ss.map((s) => (s.id === active?.id ? fn(s) : s)));
	const onNodesChange = useCallback(
		(chs) =>
			patchActive((s) => ({ ...s, nodes: applyNodeChanges(chs, s.nodes) })),
		[active?.id],
	);
	const onEdgesChange = useCallback(
		(chs) =>
			patchActive((s) => ({ ...s, edges: applyEdgeChanges(chs, s.edges) })),
		[active?.id],
	);
	const onConnect = useCallback(
		(conn) =>
			patchActive((s) => ({
				...s,
				edges: addEdge(
					{
						id: `${conn.source}->${conn.target}`,
						source: conn.source,
						target: conn.target,
						data: { desc: "새 관계 — 설명 입력" },
					},
					s.edges,
				),
			})),
		[active?.id],
	);

	const addNode = (parentId) => {
		const id = `${isClass ? "c" : "m"}-${Date.now().toString(36)}`;
		patchActive((s) => {
			let node;
			if (isClass) {
				const groups = s.nodes.filter((n) => n.type === "modGroup");
				const parent = parentId ?? groups[0]?.id;
				node = parent
					? {
							id,
							type: "cls",
							position: { x: 30, y: 40 },
							parentNode: parent,
							extent: "parent",
							data: {
								id,
								name: "새 클래스",
								module: "",
								attrs: [],
								methods: [],
							},
						}
					: {
							id,
							type: "cls",
							position: gridPos(s.nodes.length),
							data: {
								id,
								name: "새 클래스",
								module: "",
								attrs: [],
								methods: [],
							},
						};
			} else {
				node = {
					id,
					type: "module",
					position: gridPos(s.nodes.length),
					data: { id, label: "새 모듈", layer: "Service", desc: "" },
				};
			}
			return { ...s, nodes: [...s.nodes, node] };
		});
		setSelected({ type: "node", id });
	};
	const deleteNode = (id) => {
		patchActive((s) => ({
			...s,
			nodes: s.nodes.filter((n) => n.id !== id),
			edges: s.edges.filter((e) => e.source !== id && e.target !== id),
		}));
		setSelected({ type: "node", id: null });
	};
	const updateNode = (id, patch) =>
		patchActive((s) => ({
			...s,
			nodes: s.nodes.map((n) => {
				if (n.id !== id) return n;
				const data = { ...n.data, ...patch };
				let type = n.type;
				if (!isClass) type = data.layer === "External" ? "external" : "module";
				return { ...n, data, type };
			}),
		}));
	const moveClass = (classId, groupId) =>
		patchActive((s) => {
			const g = s.nodes.find((n) => n.id === groupId);
			const modLabel = g?.data?.label ?? g?.data?.name ?? "";
			return {
				...s,
				nodes: s.nodes.map((n) =>
					n.id === classId
						? {
								...n,
								parentNode: groupId,
								extent: "parent",
								position: { x: 30, y: 50 },
								data: { ...n.data, module: modLabel },
							}
						: n,
				),
			};
		});
	const updateEdgeDesc = (key, desc) =>
		patchActive((s) => ({
			...s,
			edges: s.edges.map((e) =>
				e.id === key ? { ...e, data: { ...e.data, desc } } : e,
			),
		}));
	const reverseEdge = (key) => {
		const [from, to] = key.split("->");
		const nk = `${to}->${from}`;
		patchActive((s) => ({
			...s,
			edges: s.edges.map((e) =>
				e.id === key ? { ...e, id: nk, source: e.target, target: e.source } : e,
			),
		}));
		setSelected({ type: "edge", id: nk });
	};
	const deleteEdge = (key) => {
		patchActive((s) => ({ ...s, edges: s.edges.filter((e) => e.id !== key) }));
		setSelected({ type: "node", id: null });
	};

	const openMenu = (e, type, id) => {
		e.preventDefault();
		setMenu({ x: e.clientX, y: e.clientY, type, id });
	};
	useEffect(() => {
		if (!menu) return;
		const close = () => setMenu(null);
		const onKey = (e) => e.key === "Escape" && close();
		const t = setTimeout(() => {
			window.addEventListener("click", close);
			window.addEventListener("contextmenu", close);
			window.addEventListener("keydown", onKey);
		}, 0);
		return () => {
			clearTimeout(t);
			window.removeEventListener("click", close);
			window.removeEventListener("contextmenu", close);
			window.removeEventListener("keydown", onKey);
		};
	}, [menu]);

	const ckey = (targetId) => `${active?.id}::${targetId}`;
	const addComment = () => {
		if (!draft.trim() || !selected.id) return;
		const k = ckey(selected.id);
		const text = draft.trim();
		setComments((c) => ({ ...c, [k]: [...(c[k] || []), text] }));
		// 코멘트 → 실시간 에이전트 채팅으로 즉시 전달(게이트 유지, chatPending 루프).
		fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, blockId: k }),
		})
			.then(() => window.dispatchEvent(new Event("fn-chat-update")))
			.catch(() => {});
		setDraft("");
	};

	// 게이트 제출: 편집된 구조를 md 구조 펜스로 역동기화해 artifactMd 로 전송(직접편집→채택).
	const serialized = () =>
		sections.map((s) => ({
			id: s.id,
			title: s.title,
			nodes: s.nodes,
			edges: s.edges,
		}));
	const submit = (verdict, revertTo) =>
		onGate({
			verdict,
			comments: [],
			artifactMd: applyStructureToMarkdown(mdSource ?? "", {
				sections: serialized(),
			}),
			...(revertTo ? { revertTo } : {}),
		});

	const nodeTypes = isClass ? NODE_TYPES_4 : NODE_TYPES_3;
	const selectedNode =
		selected.type === "node"
			? active?.nodes.find((n) => n.id === selected.id)
			: null;
	const selectedEdge =
		selected.type === "edge"
			? active?.edges.find((e) => e.id === selected.id)
			: null;
	const commentList = selected.id ? comments[ckey(selected.id)] || [] : [];

	const menuEl = menu
		? createPortal(
				<div
					className="ctx-menu"
					style={{ position: "fixed", top: menu.y, left: menu.x }}
					onClick={(e) => e.stopPropagation()}
					onContextMenu={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
				>
					{(menu.type === "pane" || menu.type === "group") && (
						<button
							className="ctx-item"
							onClick={() => {
								addNode(menu.type === "group" ? menu.id : undefined);
								setMenu(null);
							}}
						>
							＋ {isClass ? "클래스" : "모듈"} 추가
							{menu.type === "group" ? " (이 모듈에)" : ""}
						</button>
					)}
					{menu.type === "node" && (
						<button
							className="ctx-item danger"
							onClick={() => {
								deleteNode(menu.id);
								setMenu(null);
							}}
						>
							✕ {isClass ? "클래스" : "모듈"} 제거
						</button>
					)}
					{menu.type === "edge" && (
						<>
							<button
								className="ctx-item"
								onClick={() => {
									reverseEdge(menu.id);
									setMenu(null);
								}}
							>
								↔ 방향 반전
							</button>
							<button
								className="ctx-item danger"
								onClick={() => {
									deleteEdge(menu.id);
									setMenu(null);
								}}
							>
								✕ 관계 제거
							</button>
						</>
					)}
				</div>,
				document.body,
			)
		: null;

	return (
		<>
			<Topbar stage={stage} total={3} />
			<Stepper stages={stagesFor(stage)} />
			<div className="meta">
				<span className="stage-tag">
					Stage {stage} / 3 · {stageName}
				</span>
				<span>
					<b>섹션:</b> {sections.length} · <b>노드:</b>{" "}
					{active?.nodes.length ?? 0} · <b>관계:</b> {active?.edges.length ?? 0}
				</span>
				<span>
					<b>기능:</b> {feature}
				</span>
			</div>

			<div className="section-bar">
				{sections.map((s) => (
					<button
						key={s.id}
						className={`sec-tab ${s.id === active?.id ? "active" : ""}`}
						onClick={() => {
							setActiveId(s.id);
							setSelected({ type: "node", id: null });
						}}
						title={s.title}
					>
						<input
							className="sec-title-input"
							value={s.title}
							onChange={(e) => renameSection(s.id, e.target.value)}
							onClick={(e) => e.stopPropagation()}
						/>
						{sections.length > 1 && (
							<span
								className="sec-del"
								title="섹션 삭제"
								onClick={(e) => {
									e.stopPropagation();
									deleteSection(s.id);
								}}
							>
								✕
							</span>
						)}
					</button>
				))}
				<button className="sec-add" onClick={addSection} title="섹션 추가">
					＋ 섹션
				</button>
			</div>

			<div className="workspace">
				<div className="graph-card">
					{active ? (
						<>
							<h3 className="card-title">
								{isClass ? "🔧 클래스 구조" : "📦 모듈 의존 관계도"} (편집 가능)
								— {active.title}
							</h3>
							{!sourceHadStructure && (active?.nodes.length ?? 0) === 0 && (
								<div
									style={{
										padding: "10px 14px",
										marginBottom: 8,
										border: "1px solid #f59e0b",
										background: "#fffbeb",
										color: "#92400e",
										borderRadius: 8,
										fontSize: 13,
										lineHeight: 1.5,
									}}
								>
									⚠️ 구조 블록(<code>```factorynote-graph</code>)을 찾지
									못했습니다 — 그래프를 그릴 구조가 없습니다.
									<br />
									<b>진단:</b> {structureDiag.reason}. 우측 채팅으로
									“```factorynote-graph JSON 으로 모듈·클래스 구조를
									작성해줘”라고 요청하거나, 아래 빈 캔버스에서 우클릭으로 직접
									노드를 추가할 수 있습니다.
									<details style={{ marginTop: 6 }}>
										<summary style={{ cursor: "pointer" }}>
											에이전트 산출물 미리보기 (원인 확인용)
										</summary>
										<pre
											style={{
												marginTop: 6,
												padding: 8,
												background: "#fff",
												border: "1px solid #fcd34d",
												borderRadius: 6,
												fontSize: 11,
												whiteSpace: "pre-wrap",
												wordBreak: "break-word",
												maxHeight: 160,
												overflow: "auto",
											}}
										>
											{structureDiag.preview || "(빈 산출물)"}
										</pre>
									</details>
								</div>
							)}
							<div className="rf-wrap">
								<ReactFlow
									nodes={active.nodes}
									edges={active.edges}
									onNodesChange={onNodesChange}
									onEdgesChange={onEdgesChange}
									onConnect={onConnect}
									onNodeClick={(_, n) => {
										if (isClass ? n.type === "cls" : true)
											setSelected({ type: "node", id: n.id });
									}}
									onEdgeClick={(_, e) =>
										setSelected({ type: "edge", id: e.id })
									}
									onPaneContextMenu={(e) => openMenu(e, "pane")}
									onNodeContextMenu={(e, n) => {
										if (isClass && n.type === "modGroup")
											openMenu(e, "group", n.id);
										else openMenu(e, "node", n.id);
									}}
									onEdgeContextMenu={(e, ed) => openMenu(e, "edge", ed.id)}
									nodeTypes={nodeTypes}
									fitView
									deleteKeyCode={null}
								>
									<Background color="rgba(17,24,39,0.08)" gap={20} />
									<Controls showInteractive={false} />
									<MiniMap
										nodeColor={(n) =>
											n.type === "modGroup" || n.type === "external"
												? "rgba(17,24,39,0.06)"
												: "#ffffff"
										}
										nodeStrokeColor={() => "#111827"}
										maskColor="rgba(17,24,39,0.04)"
									/>
								</ReactFlow>
							</div>
							<div className="legend">
								<span className="lg">↕ 노드 드래그</span>
								<span className="lg">하단 ● → 상단 ● = 관계 추가</span>
								<span className="lg">
									우클릭: 빈공간=추가 · 노드=제거 · 엣지=반전/제거
								</span>
							</div>
						</>
					) : (
						<div className="empty">섹션을 선택하거나 추가하세요.</div>
					)}
				</div>

				<aside className="detail">
					{selectedNode ? (
						isClass ? (
							<ClassPanel
								node={selectedNode}
								edges={active?.edges ?? []}
								groups={(active?.nodes ?? []).filter(
									(n) => n.type === "modGroup",
								)}
								labelOf={labelOf}
								comments={commentList}
								draft={draft}
								setDraft={setDraft}
								onAdd={addComment}
								onUpdate={updateNode}
								onMove={moveClass}
								onSelectEdge={(k) => setSelected({ type: "edge", id: k })}
							/>
						) : (
							<ModulePanel
								node={selectedNode}
								edges={active?.edges ?? []}
								labelOf={labelOf}
								comments={commentList}
								draft={draft}
								setDraft={setDraft}
								onAdd={addComment}
								onUpdate={updateNode}
								onSelectEdge={(k) => setSelected({ type: "edge", id: k })}
							/>
						)
					) : selectedEdge ? (
						<EdgePanel
							edge={selectedEdge}
							labelOf={labelOf}
							comments={commentList}
							draft={draft}
							setDraft={setDraft}
							onAdd={addComment}
							onDesc={updateEdgeDesc}
						/>
					) : (
						<div className="empty">
							노드/엣지를 클릭해 상세·편집. 노드·관계에 코멘트를 남기면 우측
							채팅으로 즉시 전달됩니다.
						</div>
					)}
				</aside>
			</div>

			<ProseView prose={prose} />

			<GateBar
				stage={stage}
				label={stageName}
				stageLabels={stageLabels}
				onConfirm={() => submit("confirm")}
				onRevert={(t) => submit("revert", t)}
				onReview={onReview}
			/>
			{menuEl}
		</>
	);
}

// --- 하단 아키텍처 설명(prose) 렌더 ---
function ProseView({ prose }) {
	const blocks = useMemo(() => mdToBlocks(prose), [prose]);
	if (!prose || blocks.length === 0) return null;
	return (
		<section className="design-prose">
			<div className="prose-doc">
				{blocks.map((b) => (
					<BlockView key={b.id} b={b} />
				))}
			</div>
		</section>
	);
}

function BlockView({ b }) {
	if (b.type === "heading") {
		const Tag = `h${Math.min(Math.max(b.level, 1), 6)}`;
		return <Tag dangerouslySetInnerHTML={{ __html: b.html }} />;
	}
	if (b.type === "paragraph")
		return <p dangerouslySetInnerHTML={{ __html: b.html }} />;
	if (b.type === "quote")
		return <blockquote dangerouslySetInnerHTML={{ __html: b.html }} />;
	if (b.type === "hr") return <hr />;
	if (b.type === "code")
		return (
			<pre>
				<code>{b.code}</code>
			</pre>
		);
	if (b.type === "list") {
		const items = b.items.map((it, i) => (
			<li
				key={i}
				className={it.checked != null ? "task" : undefined}
				dangerouslySetInnerHTML={{ __html: it.html }}
			/>
		));
		return b.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
	}
	if (b.type === "table") {
		return (
			<table>
				<thead>
					<tr>
						{b.headers.map((h, i) => (
							<th key={i} dangerouslySetInnerHTML={{ __html: h }} />
						))}
					</tr>
				</thead>
				<tbody>
					{b.rows.map((r, ri) => (
						<tr key={ri}>
							{r.map((c, ci) => (
								<td key={ci} dangerouslySetInnerHTML={{ __html: c }} />
							))}
						</tr>
					))}
				</tbody>
			</table>
		);
	}
	if (b.type === "image") return <img src={b.src} alt={b.alt} />;
	return null;
}

// --- 상세 패널(GraphStage 과 동일) ---
function DepRows({ edges, nodeId, labelOf, onSelectEdge, dir }) {
	const list =
		dir === "out"
			? edges.filter((e) => e.source === nodeId)
			: edges.filter((e) => e.target === nodeId);
	if (list.length === 0) return null;
	return (
		<div className="dep-group">
			<div className="dep-group-label">
				{dir === "out" ? "나가는 (→)" : "들어오는 (←)"}
			</div>
			{list.map((e) => {
				const other = dir === "out" ? e.target : e.source;
				return (
					<div
						key={e.id}
						className="dep-row"
						onClick={() => onSelectEdge(e.id)}
					>
						<span className="dep-arrow">{dir === "out" ? "→" : "←"}</span>
						<span className="dep-target">{labelOf(other)}</span>
						<span className="dep-desc">{e.data?.desc}</span>
					</div>
				);
			})}
		</div>
	);
}

function ModulePanel({
	node,
	edges,
	labelOf,
	comments,
	draft,
	setDraft,
	onAdd,
	onUpdate,
	onSelectEdge,
}) {
	return (
		<>
			<h4 className="card-title">모듈 상세 · 편집</h4>
			<label className="field-label">이름</label>
			<input
				className="edge-desc-input"
				value={node.data.label ?? ""}
				onChange={(e) => onUpdate(node.id, { label: e.target.value })}
			/>
			<label className="field-label">계층</label>
			<select
				className="edge-desc-input"
				value={node.data.layer ?? "Service"}
				onChange={(e) => onUpdate(node.id, { layer: e.target.value })}
			>
				{LAYERS.map((l) => (
					<option key={l} value={l}>
						{l}
					</option>
				))}
			</select>
			<label className="field-label">역할</label>
			<input
				className="edge-desc-input"
				value={node.data.desc ?? ""}
				onChange={(e) => onUpdate(node.id, { desc: e.target.value })}
			/>
			<h4 className="card-title" style={{ marginTop: "var(--s4)" }}>
				의존 관계
			</h4>
			<DepRows
				edges={edges}
				nodeId={node.id}
				labelOf={labelOf}
				onSelectEdge={onSelectEdge}
				dir="out"
			/>
			<DepRows
				edges={edges}
				nodeId={node.id}
				labelOf={labelOf}
				onSelectEdge={onSelectEdge}
				dir="in"
			/>
			<CommentBox
				comments={comments}
				draft={draft}
				setDraft={setDraft}
				onAdd={onAdd}
				placeholder={`${node.data.label ?? node.id} 에 코멘트…`}
			/>
		</>
	);
}

function ClassPanel({
	node,
	edges,
	groups,
	labelOf,
	comments,
	draft,
	setDraft,
	onAdd,
	onUpdate,
	onMove,
	onSelectEdge,
}) {
	return (
		<>
			<h4 className="card-title">클래스 상세 · 편집</h4>
			<label className="field-label">이름</label>
			<input
				className="edge-desc-input"
				value={node.data.name ?? ""}
				onChange={(e) => onUpdate(node.id, { name: e.target.value })}
			/>
			<label className="field-label">모듈(그룹)</label>
			<select
				className="edge-desc-input"
				value={node.parentNode ?? ""}
				onChange={(e) => onMove(node.id, e.target.value)}
			>
				{groups.map((g) => (
					<option key={g.id} value={g.id}>
						{g.data?.label ?? g.data?.name ?? g.id}
					</option>
				))}
			</select>
			<label className="field-label">속성 (한 줄씩)</label>
			<textarea
				className="edge-textarea"
				rows={3}
				value={(node.data.attrs ?? []).join("\n")}
				onChange={(e) =>
					onUpdate(node.id, { attrs: e.target.value.split("\n") })
				}
			/>
			<label className="field-label">메서드 (한 줄씩)</label>
			<textarea
				className="edge-textarea"
				rows={3}
				value={(node.data.methods ?? []).join("\n")}
				onChange={(e) =>
					onUpdate(node.id, { methods: e.target.value.split("\n") })
				}
			/>
			<h4 className="card-title" style={{ marginTop: "var(--s4)" }}>
				관계
			</h4>
			<DepRows
				edges={edges}
				nodeId={node.id}
				labelOf={labelOf}
				onSelectEdge={onSelectEdge}
				dir="out"
			/>
			<DepRows
				edges={edges}
				nodeId={node.id}
				labelOf={labelOf}
				onSelectEdge={onSelectEdge}
				dir="in"
			/>
			<CommentBox
				comments={comments}
				draft={draft}
				setDraft={setDraft}
				onAdd={onAdd}
				placeholder={`${node.data.name ?? node.id} 에 코멘트…`}
			/>
		</>
	);
}

function EdgePanel({
	edge,
	labelOf,
	comments,
	draft,
	setDraft,
	onAdd,
	onDesc,
}) {
	const [from, to] = edge.id.split("->");
	return (
		<>
			<h4 className="card-title">관계 상세 · 편집</h4>
			<div className="edge-name">
				<span className="dep-target">{labelOf(from)}</span>
				<span className="edge-arrow"> → </span>
				<span className="dep-target">{labelOf(to)}</span>
			</div>
			<label className="field-label">관계 설명</label>
			<input
				className="edge-desc-input"
				value={edge.data?.desc ?? ""}
				onChange={(e) => onDesc(edge.id, e.target.value)}
			/>
			<div className="empty" style={{ marginTop: "var(--s2)" }}>
				엣지 우클릭으로 방향 반전·제거
			</div>
			<CommentBox
				comments={comments}
				draft={draft}
				setDraft={setDraft}
				onAdd={onAdd}
				placeholder={`${labelOf(from)} → ${labelOf(to)} 관계에 코멘트…`}
			/>
		</>
	);
}

function CommentBox({ comments, draft, setDraft, onAdd, placeholder }) {
	return (
		<div className="mod-comments" style={{ marginTop: "var(--s4)" }}>
			<h4 className="card-title">코멘트 ({comments.length})</h4>
			{comments.length ? (
				comments.map((t, i) => (
					<div key={i} className="comment-item">
						💬 {t}
					</div>
				))
			) : (
				<div className="empty">아직 없음</div>
			)}
			<div className="comment-input-row">
				<input
					value={draft}
					placeholder={placeholder}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && onAdd()}
				/>
				<button onClick={onAdd}>추가</button>
			</div>
		</div>
	);
}
