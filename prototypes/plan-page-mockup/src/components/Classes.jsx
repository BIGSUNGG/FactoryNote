import { useCallback, useEffect, useState } from "react";
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

// Stage 4 — 클래스 구조 에디터. 모듈(그룹)이 클래스를 감싸는 계층 구조.

const STAGES = [
	{ n: 1, label: "요청 이해", state: "done", route: "" },
	{ n: 2, label: "시나리오", state: "done", route: "scenarios" },
	{ n: 3, label: "모듈 아키텍처", state: "done", route: "modules" },
	{ n: 4, label: "클래스 설계", state: "current", route: "classes" },
	{ n: 5, label: "구현 계획", state: "done", route: "impl" },
	{ n: 6, label: "최종 검증", state: "done", route: "review" },
];

// 모듈 그룹(부모) + 클래스(자식, parentNode 로 그룹에 속함)
const initialNodes = [
	// 모듈 그룹
	{
		id: "g-api",
		type: "modGroup",
		position: { x: 0, y: 0 },
		data: { label: "API" },
		style: { width: 240, height: 130 },
		selectable: false,
	},
	{
		id: "g-service",
		type: "modGroup",
		position: { x: 290, y: 0 },
		data: { label: "Service" },
		style: { width: 380, height: 250 },
		selectable: false,
	},
	{
		id: "g-util",
		type: "modGroup",
		position: { x: 0, y: 180 },
		data: { label: "Util" },
		style: { width: 560, height: 150 },
		selectable: false,
	},
	{
		id: "g-repo",
		type: "modGroup",
		position: { x: 710, y: 0 },
		data: { label: "Repository" },
		style: { width: 240, height: 130 },
		selectable: false,
	},

	// 클래스 (각 모듈 안)
	{
		id: "AuthController",
		type: "cls",
		position: { x: 30, y: 40 },
		parentNode: "g-api",
		extent: "parent",
		data: {
			name: "AuthController",
			module: "API",
			attrs: ["- router: Router"],
			methods: ["+ login(req): Token", "+ signup(req): User"],
		},
	},
	{
		id: "AuthService",
		type: "cls",
		position: { x: 30, y: 40 },
		parentNode: "g-service",
		extent: "parent",
		data: {
			name: "AuthService",
			module: "Service",
			attrs: [
				"- users: UserService",
				"- hash: HashUtil",
				"- tokens: TokenService",
			],
			methods: [
				"+ signup(email,pw): User",
				"+ login(email,pw): Token",
				"+ logout(token): void",
			],
		},
	},
	{
		id: "UserService",
		type: "cls",
		position: { x: 200, y: 50 },
		parentNode: "g-service",
		extent: "parent",
		data: {
			name: "UserService",
			module: "Service",
			attrs: ["- repo: UserRepository", "- mailer: Mailer"],
			methods: ["+ create(dto): User", "+ findById(id): User"],
		},
	},
	{
		id: "HashUtil",
		type: "cls",
		position: { x: 30, y: 30 },
		parentNode: "g-util",
		extent: "parent",
		data: {
			name: "HashUtil",
			module: "Util",
			attrs: ["- cost: 12"],
			methods: ["+ hash(pw): string", "+ verify(pw,hash): boolean"],
		},
	},
	{
		id: "TokenService",
		type: "cls",
		position: { x: 330, y: 30 },
		parentNode: "g-util",
		extent: "parent",
		data: {
			name: "TokenService",
			module: "Util",
			attrs: ["- secret: string", "- ttl: 900"],
			methods: ["+ sign(payload): string", "+ verify(token): Payload"],
		},
	},
	{
		id: "UserRepository",
		type: "cls",
		position: { x: 30, y: 40 },
		parentNode: "g-repo",
		extent: "parent",
		data: {
			name: "UserRepository",
			module: "Repository",
			attrs: ["- db: Database"],
			methods: ["+ save(user): User", "+ findByEmail(email): User"],
		},
	},
];

const initialEdges = [
	{
		id: "AuthController->AuthService",
		source: "AuthController",
		target: "AuthService",
		data: { desc: "위임" },
	},
	{
		id: "AuthService->UserService",
		source: "AuthService",
		target: "UserService",
		data: { desc: "사용자 처리" },
	},
	{
		id: "AuthService->HashUtil",
		source: "AuthService",
		target: "HashUtil",
		data: { desc: "해싱" },
	},
	{
		id: "AuthService->TokenService",
		source: "AuthService",
		target: "TokenService",
		data: { desc: "토큰 발급" },
	},
	{
		id: "UserService->UserRepository",
		source: "UserService",
		target: "UserRepository",
		data: { desc: "저장" },
	},
];

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
			<div className="rf-modgroup-label">{data.label}</div>
		</div>
	);
}

function ClassNode({ data }) {
	return (
		<div className="rf-class" title="드래그 이동 · 클릭 상세 · 우클릭 제거">
			<Handle type="target" position={Position.Top} />
			<div className="rf-class-name">{data.name}</div>
			<div className="rf-class-module">{data.module}</div>
			<div className="rf-class-section">
				{data.attrs.map((a) => (
					<div key={a} className="rf-class-attr">
						{a}
					</div>
				))}
			</div>
			<div className="rf-class-section">
				{data.methods.map((m) => (
					<div key={m} className="rf-class-method">
						{m}
					</div>
				))}
			</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
const nodeTypes = { cls: ClassNode, modGroup: ModGroup };

export default function Classes() {
	const [nodes, setNodes] = useState(initialNodes);
	const [edges, setEdges] = useState(initialEdges);
	const [selected, setSelected] = useState({
		type: "node",
		id: "AuthController",
	});
	const [comments, setComments] = useState({});
	const [draft, setDraft] = useState("");
	const [menu, setMenu] = useState(null);

	const classNodes = nodes.filter((n) => n.type === "cls");
	const labelOf = (id) => nodes.find((n) => n.id === id)?.data.name || id;

	const onNodesChange = useCallback(
		(chs) => setNodes((ns) => applyNodeChanges(chs, ns)),
		[],
	);
	const onEdgesChange = useCallback(
		(chs) => setEdges((es) => applyEdgeChanges(chs, es)),
		[],
	);
	const onConnect = useCallback((conn) => {
		const id = `${conn.source}->${conn.target}`;
		setEdges((eds) =>
			addEdge(
				{
					id,
					source: conn.source,
					target: conn.target,
					data: { desc: "관계" },
				},
				eds,
			),
		);
		setSelected({ type: "edge", id });
	}, []);

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

	const modules = nodes.filter((n) => n.type === "modGroup");
	const moduleName = (gid) =>
		modules.find((m) => m.id === gid)?.data.label || "Service";
	// parentId 가 지정되면 해당 모듈에, 아니면 Service 그룹에 클래스 추가
	const addNode = (parentId = "g-service") => {
		const id = `c-${Date.now().toString(36)}`;
		setNodes((ns) => [
			...ns,
			{
				id,
				type: "cls",
				position: { x: 40, y: 60 },
				parentNode: parentId,
				extent: "parent",
				data: {
					name: "새 클래스",
					module: moduleName(parentId),
					attrs: [],
					methods: [],
				},
			},
		]);
		setSelected({ type: "node", id });
	};
	// 클래스를 다른 모듈로 이동(parent 변경 + module 라벨 동기화)
	const onMoveClass = (classId, groupId) => {
		const modLabel = moduleName(groupId);
		setNodes((ns) =>
			ns.map((n) =>
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
		);
	};
	const deleteNode = (id) => {
		setNodes((ns) => ns.filter((n) => n.id !== id));
		setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
		setSelected({ type: "node", id: classNodes[0]?.id });
	};
	const updateNode = (id, patch) =>
		setNodes((ns) =>
			ns.map((n) =>
				n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
			),
		);

	const selectNode = (id) => setSelected({ type: "node", id });
	const selectRel = (id) => setSelected({ type: "edge", id });
	const updateRelDesc = (id, desc) =>
		setEdges((es) =>
			es.map((e) => (e.id === id ? { ...e, data: { ...e.data, desc } } : e)),
		);
	const reverseRel = (id) => {
		const [a, b] = id.split("->");
		const nk = `${b}->${a}`;
		setEdges((es) =>
			es.map((e) =>
				e.id === id ? { ...e, id: nk, source: e.target, target: e.source } : e,
			),
		);
		setSelected({ type: "edge", id: nk });
	};
	const deleteRel = (id) => {
		setEdges((es) => es.filter((e) => e.id !== id));
		setSelected({ type: "node", id: id.split("->")[0] });
	};

	const pending = Object.values(comments).reduce((a, b) => a + b.length, 0);
	const nodeObj =
		selected.type === "node"
			? nodes.find((n) => n.id === selected.id && n.type === "cls")
			: null;
	const edgeObj =
		selected.type === "edge" ? edges.find((e) => e.id === selected.id) : null;

	const addComment = () => {
		if (!draft.trim()) return;
		setComments((c) => ({
			...c,
			[selected.id]: [...(c[selected.id] || []), draft.trim()],
		}));
		setDraft("");
	};

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
					{menu.type === "pane" && (
						<button
							className="ctx-item"
							onClick={() => {
								addNode();
								setMenu(null);
							}}
						>
							＋ 클래스 추가 (Service)
						</button>
					)}
					{menu.type === "group" && (
						<button
							className="ctx-item"
							onClick={() => {
								addNode(menu.id);
								setMenu(null);
							}}
						>
							＋ 이 모듈에 클래스 추가
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
							✕ 클래스 제거
						</button>
					)}
					{menu.type === "edge" && (
						<>
							<button
								className="ctx-item"
								onClick={() => {
									reverseRel(menu.id);
									setMenu(null);
								}}
							>
								↔ 관계 방향 반전
							</button>
							<button
								className="ctx-item danger"
								onClick={() => {
									deleteRel(menu.id);
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
			<Topbar stage={4} total={6} />
			<Stepper stages={STAGES} />
			<div className="page-meta">
				<span className="stage-tag">Stage 4 / 6 · 산출물</span>
				<span>
					<b>모듈:</b> 4 · <b>클래스:</b> {classNodes.length}
				</span>
				<span>
					<b>관계:</b> {edges.length}
				</span>
				<span>
					<b>Design↔Feedback:</b> 라운드 1
				</span>
			</div>

			<div className="workspace">
				<div className="graph-card">
					<h3 className="card-title">🔧 클래스 구조 — 모듈 계층 (편집 가능)</h3>
					<div className="rf-wrap">
						<ReactFlow
							nodes={nodes}
							edges={edges}
							onNodesChange={onNodesChange}
							onEdgesChange={onEdgesChange}
							onConnect={onConnect}
							onNodeClick={(_, n) => n.type === "cls" && selectNode(n.id)}
							onEdgeClick={(_, e) => selectRel(e.id)}
							onPaneContextMenu={(e) => openMenu(e, "pane")}
							onNodeContextMenu={(e, n) => {
								if (n.type === "cls") openMenu(e, "node", n.id);
								else if (n.type === "modGroup") openMenu(e, "group", n.id);
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
									n.type === "modGroup" ? "rgba(17,24,39,0.04)" : "#ffffff"
								}
								nodeStrokeColor={() => "#111827"}
								maskColor="rgba(17,24,39,0.04)"
							/>
						</ReactFlow>
					</div>
					<div className="legend">
						<span className="lg">◻ 모듈 박스가 클래스를 감쌈</span>
						<span className="lg">
							↕ 클래스/모듈 드래그 (모듐 이동 시 클래스가 함께)
						</span>
						<span className="lg">
							우클릭: 빈 공간=추가 · 클래스=제거 · 관계=반전/제거
						</span>
					</div>
				</div>

				<aside className="detail">
					{selected.type === "node" && nodeObj ? (
						<ClassPanel
							node={nodeObj}
							edges={edges}
							comments={comments}
							labelOf={labelOf}
							modules={modules}
							onSelectNode={selectNode}
							onSelectRel={selectRel}
							onUpdate={updateNode}
							onMove={onMoveClass}
						/>
					) : edgeObj ? (
						<RelPanel
							edge={edgeObj}
							labelOf={labelOf}
							comments={comments}
							draft={draft}
							setDraft={setDraft}
							onAdd={addComment}
							onDesc={updateRelDesc}
							onSelectNode={selectNode}
						/>
					) : null}
				</aside>
			</div>

			<GateBar
				stage={4}
				label="클래스 설계"
				pendingCount={pending}
				onApply={() => setComments({})}
			/>
			{menuEl}
		</>
	);
}

function ClassPanel({
	node,
	edges,
	comments,
	labelOf,
	modules,
	onSelectNode,
	onSelectRel,
	onUpdate,
	onMove,
}) {
	const outgoing = edges.filter((e) => e.source === node.id);
	const incoming = edges.filter((e) => e.target === node.id);
	return (
		<>
			<h4 className="card-title">클래스 상세 · 편집</h4>
			<label className="field-label">이름</label>
			<input
				className="edge-desc-input"
				value={node.data.name}
				onChange={(e) => onUpdate(node.id, { name: e.target.value })}
			/>
			<label className="field-label">모듈</label>
			<select
				className="edge-desc-input"
				value={node.parentNode}
				onChange={(e) => onMove(node.id, e.target.value)}
			>
				{modules.map((m) => (
					<option key={m.id} value={m.id}>
						{m.data.label}
					</option>
				))}
			</select>
			<label className="field-label">속성 (한 줄씩)</label>
			<textarea
				className="edge-textarea"
				rows={3}
				value={node.data.attrs.join("\n")}
				onChange={(e) =>
					onUpdate(node.id, { attrs: e.target.value.split("\n") })
				}
			/>
			<label className="field-label">메서드 (한 줄씩)</label>
			<textarea
				className="edge-textarea"
				rows={3}
				value={node.data.methods.join("\n")}
				onChange={(e) =>
					onUpdate(node.id, { methods: e.target.value.split("\n") })
				}
			/>

			<h4 className="card-title" style={{ marginTop: "var(--s4)" }}>
				관계
			</h4>
			{outgoing.length === 0 && incoming.length === 0 && (
				<div className="empty">관계 없음 (클래스 우클릭으로 제거)</div>
			)}
			{outgoing.length > 0 && (
				<div className="dep-group">
					<div className="dep-group-label">사용 (→)</div>
					{outgoing.map((e) => (
						<div
							key={e.id}
							className="dep-row"
							onClick={() => onSelectRel(e.id)}
						>
							<span className="dep-arrow">→</span>
							<span
								className="dep-target"
								onClick={(ev) => {
									ev.stopPropagation();
									onSelectNode(e.target);
								}}
							>
								{labelOf(e.target)}
							</span>
							<span className="dep-desc">{e.data.desc}</span>
							<span className="dep-count">
								💬{(comments[e.id] || []).length}
							</span>
						</div>
					))}
				</div>
			)}
			{incoming.length > 0 && (
				<div className="dep-group">
					<div className="dep-group-label">사용됨 (←)</div>
					{incoming.map((e) => (
						<div
							key={e.id}
							className="dep-row"
							onClick={() => onSelectRel(e.id)}
						>
							<span className="dep-arrow">←</span>
							<span
								className="dep-target"
								onClick={(ev) => {
									ev.stopPropagation();
									onSelectNode(e.source);
								}}
							>
								{labelOf(e.source)}
							</span>
							<span className="dep-desc">{e.data.desc}</span>
							<span className="dep-count">
								💬{(comments[e.id] || []).length}
							</span>
						</div>
					))}
				</div>
			)}
		</>
	);
}

function RelPanel({
	edge,
	labelOf,
	comments,
	draft,
	setDraft,
	onAdd,
	onDesc,
	onSelectNode,
}) {
	const [from, to] = edge.id.split("->");
	const list = comments[edge.id] || [];
	return (
		<>
			<h4 className="card-title">관계 상세 · 편집</h4>
			<div className="edge-name">
				<span className="dep-target" onClick={() => onSelectNode(from)}>
					{labelOf(from)}
				</span>
				<span className="edge-arrow"> → </span>
				<span className="dep-target" onClick={() => onSelectNode(to)}>
					{labelOf(to)}
				</span>
			</div>
			<label className="field-label">관계 설명</label>
			<input
				className="edge-desc-input"
				value={edge.data.desc}
				onChange={(e) => onDesc(edge.id, e.target.value)}
			/>
			<div className="empty" style={{ marginTop: "var(--s2)" }}>
				관계 우클릭으로 방향 반전·제거
			</div>
			<div className="mod-comments">
				<h4 className="card-title">코멘트 ({list.length})</h4>
				{list.length ? (
					list.map((t, i) => (
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
						placeholder={`${labelOf(from)} → ${labelOf(to)} 관계에 코멘트…`}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && onAdd()}
					/>
					<button onClick={onAdd}>추가</button>
				</div>
			</div>
		</>
	);
}
