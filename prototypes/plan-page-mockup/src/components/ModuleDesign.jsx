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
} from "reactflow";
import "reactflow/dist/style.css";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import GateBar from "./GateBar";

// Stage 3 — 인터랙티브 모듈 의존 에디터.
// 우클릭 컨텍스트 메뉴: 빈 공간=모듈 추가, 노드=제거, 엣지=제거/방향반전.

const STAGES = [
	{ n: 1, label: "요청 이해", state: "done" },
	{ n: 2, label: "시나리오", state: "done" },
	{ n: 3, label: "모듈 아키텍처", state: "current" },
	{ n: 4, label: "클래스 설계", state: "locked" },
	{ n: 5, label: "구현 계획", state: "locked" },
	{ n: 6, label: "최종 검증", state: "locked" },
];

const LAYERS = ["API", "Service", "Repository", "Util", "External"];

const initialNodes = [
	{
		id: "AuthController",
		type: "module",
		position: { x: 300, y: 0 },
		data: {
			label: "AuthController",
			layer: "API",
			desc: "로그인·회원가입 HTTP 엔드포인트. 요청을 받아 AuthService로 위임.",
		},
	},
	{
		id: "AuthService",
		type: "module",
		position: { x: 300, y: 110 },
		data: {
			label: "AuthService",
			layer: "Service",
			desc: "인증 로직 오케스트레이션. 해싱·토큰 발급·사용자 생성을 조율.",
		},
	},
	{
		id: "UserService",
		type: "module",
		position: { x: 160, y: 240 },
		data: {
			label: "UserService",
			layer: "Service",
			desc: "사용자 생성·조회. 저장소와 메일러를 호출.",
		},
	},
	{
		id: "HashUtil",
		type: "module",
		position: { x: 0, y: 240 },
		data: {
			label: "HashUtil",
			layer: "Util",
			desc: "bcrypt(cost 12) 해싱. 순수 함수, 의존 없음.",
		},
	},
	{
		id: "TokenService",
		type: "module",
		position: { x: 440, y: 240 },
		data: {
			label: "TokenService",
			layer: "Util",
			desc: "JWT 서명·검증. 만료·갱신 정책 포함.",
		},
	},
	{
		id: "UserRepository",
		type: "module",
		position: { x: 160, y: 370 },
		data: {
			label: "UserRepository",
			layer: "Repository",
			desc: "DB 접근 추상화. SQL 쿼리 캡슐화.",
		},
	},
	{
		id: "Mailer",
		type: "module",
		position: { x: 560, y: 240 },
		data: {
			label: "Mailer",
			layer: "External",
			desc: "인증 메일 발송 (외부 SMTP).",
		},
	},
	{
		id: "Database",
		type: "external",
		position: { x: 160, y: 500 },
		data: {
			label: "Database",
			layer: "External",
			desc: "PostgreSQL. 외부 시스템.",
		},
	},
];

const initialEdges = [
	{
		id: "AuthController->AuthService",
		source: "AuthController",
		target: "AuthService",
		data: { desc: "로그인/가입 요청을 인증 서비스로 위임." },
	},
	{
		id: "AuthService->UserService",
		source: "AuthService",
		target: "UserService",
		data: { desc: "사용자 생성·조회 호출." },
	},
	{
		id: "AuthService->HashUtil",
		source: "AuthService",
		target: "HashUtil",
		data: { desc: "비밀번호 bcrypt 해싱 위임." },
	},
	{
		id: "AuthService->TokenService",
		source: "AuthService",
		target: "TokenService",
		data: { desc: "JWT 발급·검증 요청." },
	},
	{
		id: "UserService->UserRepository",
		source: "UserService",
		target: "UserRepository",
		data: { desc: "DB 저장·조회 위임." },
	},
	{
		id: "UserService->Mailer",
		source: "UserService",
		target: "Mailer",
		data: { desc: "인증 메일 발송 요청." },
	},
	{
		id: "UserRepository->Database",
		source: "UserRepository",
		target: "Database",
		data: { desc: "SQL 실행." },
	},
];

function ModuleNode({ data }) {
	return (
		<div className="rf-module" title="드래그 이동 · 클릭 상세 · 우클릭 제거">
			<Handle type="target" position={Position.Top} />
			<div className="rf-mod-name">{data.label}</div>
			<div className="rf-mod-layer">{data.layer}</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
function ExternalNode({ data }) {
	return (
		<div className="rf-module rf-external" title="외부 시스템 · 우클릭 제거">
			<Handle type="target" position={Position.Top} />
			<div className="rf-mod-name">{data.label}</div>
			<div className="rf-mod-layer">{data.layer}</div>
		</div>
	);
}
const nodeTypes = { module: ModuleNode, external: ExternalNode };

export default function ModuleDesign() {
	const [nodes, setNodes] = useState(initialNodes);
	const [edges, setEdges] = useState(initialEdges);
	const [selected, setSelected] = useState({
		type: "module",
		id: "AuthController",
	});
	const [comments, setComments] = useState({});
	const [draft, setDraft] = useState("");
	// 우클릭 컨텍스트 메뉴: {x,y,type:"pane"|"node"|"edge", id?}
	const [menu, setMenu] = useState(null);

	const labelOf = (id) => nodes.find((n) => n.id === id)?.data.label || id;

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
					data: { desc: "새 의존 — 설명 입력" },
				},
				eds,
			),
		);
		setSelected({ type: "edge", id });
	}, []);

	// 컨텍스트 메뉴 핸들러
	const openMenu = (e, type, id) => {
		e.preventDefault();
		console.log("[ctx] open", type, id);
		setMenu({ x: e.clientX, y: e.clientY, type, id });
	};
	// 메뉴 외부 클릭 / 다른 우클릭 / ESC 로 닫기 — 현재 이벤트 사이클 뒤(다음 tick)에 등록
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

	const addNode = () => {
		const id = `m-${Date.now().toString(36)}`;
		setNodes((ns) => [
			...ns,
			{
				id,
				type: "module",
				position: {
					x: 220 + Math.random() * 200,
					y: 160 + Math.random() * 160,
				},
				data: { label: "새 모듈", layer: "Service", desc: "설명 입력" },
			},
		]);
		setSelected({ type: "module", id });
	};
	const deleteNode = (id) => {
		setNodes((ns) => ns.filter((n) => n.id !== id));
		setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
		setSelected({ type: "module", id: nodes[0]?.id });
	};
	const updateNode = (id, patch) =>
		setNodes((ns) =>
			ns.map((n) =>
				n.id === id
					? {
							...n,
							data: { ...n.data, ...patch },
							type: patch.layer === "External" ? "external" : "module",
						}
					: n,
			),
		);

	const selectModule = (name) => setSelected({ type: "module", id: name });
	const selectEdge = (key) => setSelected({ type: "edge", id: key });
	const updateEdgeDesc = (key, desc) =>
		setEdges((es) =>
			es.map((e) => (e.id === key ? { ...e, data: { ...e.data, desc } } : e)),
		);
	const reverseEdge = (key) => {
		const [from, to] = key.split("->");
		const newKey = `${to}->${from}`;
		setEdges((es) =>
			es.map((e) =>
				e.id === key
					? { ...e, id: newKey, source: e.target, target: e.source }
					: e,
			),
		);
		setSelected({ type: "edge", id: newKey });
	};
	const deleteEdge = (key) => {
		const [from] = key.split("->");
		setEdges((es) => es.filter((e) => e.id !== key));
		setSelected({ type: "module", id: from });
	};

	const pending = Object.values(comments).reduce((a, b) => a + b.length, 0);
	const nodeObj =
		selected.type === "module" ? nodes.find((n) => n.id === selected.id) : null;
	const edgeObj =
		selected.type === "edge" ? edges.find((e) => e.id === selected.id) : null;
	const list = comments[selected.id] || [];

	const addComment = () => {
		if (!draft.trim()) return;
		setComments((c) => ({
			...c,
			[selected.id]: [...(c[selected.id] || []), draft.trim()],
		}));
		setDraft("");
	};

	// 컨텍스트 메뉴 바디
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
							＋ 모듈 추가
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
							✕ 모듈 제거
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
								↔ 의존 방향 반전
							</button>
							<button
								className="ctx-item danger"
								onClick={() => {
									deleteEdge(menu.id);
									setMenu(null);
								}}
							>
								✕ 의존 제거
							</button>
						</>
					)}
				</div>,
				document.body,
			)
		: null;

	return (
		<>
			<Topbar stage={3} total={6} />
			<Stepper stages={STAGES} />
			<div className="meta">
				<span className="stage-tag">Stage 3 / 6 · 산출물</span>
				<span>
					<b>모듈:</b> {nodes.length} · <b>의존:</b> {edges.length}
				</span>
				<span>
					<b>Design↔Feedback:</b> 라운드 1
				</span>
			</div>

			<div className="workspace">
				<div className="graph-card">
					<h3 className="card-title">📦 모듈 의존 관계도 (편집 가능)</h3>
					<div className="rf-wrap">
						<ReactFlow
							nodes={nodes}
							edges={edges}
							onNodesChange={onNodesChange}
							onEdgesChange={onEdgesChange}
							onConnect={onConnect}
							onNodeClick={(_, n) => selectModule(n.id)}
							onEdgeClick={(_, e) => selectEdge(e.id)}
							onPaneContextMenu={(e) => openMenu(e, "pane")}
							onNodeContextMenu={(e, n) => openMenu(e, "node", n.id)}
							onEdgeContextMenu={(e, ed) => openMenu(e, "edge", ed.id)}
							nodeTypes={nodeTypes}
							fitView
							deleteKeyCode={null}
						>
							<Background color="rgba(17,24,39,0.08)" gap={20} />
							<Controls showInteractive={false} />
							<MiniMap
								nodeColor={() => "#ffffff"}
								nodeStrokeColor={() => "#111827"}
								maskColor="rgba(17,24,39,0.04)"
							/>
						</ReactFlow>
					</div>
					<div className="legend">
						<span className="lg">↕ 노드 드래그</span>
						<span className="lg">하단 ● → 상단 ● = 의존 추가</span>
						<span className="lg">
							우클릭: 빈 공간=추가 · 노드=제거 · 엣지=반전/제거
						</span>
					</div>
				</div>

				<aside className="detail">
					{selected.type === "module" && nodeObj ? (
						<ModulePanel
							node={nodeObj}
							edges={edges}
							comments={comments}
							labelOf={labelOf}
							onSelectModule={selectModule}
							onSelectEdge={selectEdge}
							onUpdate={updateNode}
						/>
					) : edgeObj ? (
						<EdgePanel
							edge={edgeObj}
							labelOf={labelOf}
							comments={comments}
							draft={draft}
							setDraft={setDraft}
							onAdd={addComment}
							onDesc={updateEdgeDesc}
							onSelectModule={selectModule}
							count={list.length}
						/>
					) : null}
				</aside>
			</div>

			<GateBar
				stage={3}
				label="모듈 아키텍처"
				pendingCount={pending}
				onApply={() => setComments({})}
			/>
			{menuEl}
		</>
	);
}

function ModulePanel({
	node,
	edges,
	comments,
	labelOf,
	onSelectModule,
	onSelectEdge,
	onUpdate,
}) {
	const outgoing = edges.filter((e) => e.source === node.id);
	const incoming = edges.filter((e) => e.target === node.id);
	return (
		<>
			<h4 className="card-title">모듈 상세 · 편집</h4>
			<label className="field-label">이름</label>
			<input
				className="edge-desc-input"
				value={node.data.label}
				onChange={(e) => onUpdate(node.id, { label: e.target.value })}
			/>
			<label className="field-label">계층</label>
			<select
				className="edge-desc-input"
				value={node.data.layer}
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
				value={node.data.desc}
				onChange={(e) => onUpdate(node.id, { desc: e.target.value })}
			/>

			<h4 className="card-title" style={{ marginTop: "var(--s4)" }}>
				의존 관계
			</h4>
			{outgoing.length === 0 && incoming.length === 0 && (
				<div className="empty">
					이 모듈과 관련된 의존이 없습니다. (노드 우클릭으로 제거)
				</div>
			)}
			{outgoing.length > 0 && (
				<div className="dep-group">
					<div className="dep-group-label">나가는 (→)</div>
					{outgoing.map((e) => (
						<div
							key={e.id}
							className="dep-row"
							onClick={() => onSelectEdge(e.id)}
						>
							<span className="dep-arrow">→</span>
							<span
								className="dep-target"
								onClick={(ev) => {
									ev.stopPropagation();
									onSelectModule(e.target);
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
					<div className="dep-group-label">들어오는 (←)</div>
					{incoming.map((e) => (
						<div
							key={e.id}
							className="dep-row"
							onClick={() => onSelectEdge(e.id)}
						>
							<span className="dep-arrow">←</span>
							<span
								className="dep-target"
								onClick={(ev) => {
									ev.stopPropagation();
									onSelectModule(e.source);
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

function EdgePanel({
	edge,
	labelOf,
	comments,
	draft,
	setDraft,
	onAdd,
	onDesc,
	onSelectModule,
	count,
}) {
	const list = comments[edge.id] || [];
	const [from, to] = edge.id.split("->");
	return (
		<>
			<h4 className="card-title">의존 상세 · 편집</h4>
			<div className="edge-name">
				<span className="dep-target" onClick={() => onSelectModule(from)}>
					{labelOf(from)}
				</span>
				<span className="edge-arrow"> → </span>
				<span className="dep-target" onClick={() => onSelectModule(to)}>
					{labelOf(to)}
				</span>
			</div>
			<label className="field-label">의존 설명</label>
			<input
				className="edge-desc-input"
				value={edge.data.desc}
				onChange={(e) => onDesc(edge.id, e.target.value)}
			/>
			<div className="empty" style={{ marginTop: "var(--s2)" }}>
				엣지 우클릭으로 방향 반전·제거
			</div>

			<div className="mod-comments">
				<h4 className="card-title">코멘트 ({count})</h4>
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
						placeholder={`${labelOf(from)} → ${labelOf(to)} 의존에 코멘트…`}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && onAdd()}
					/>
					<button onClick={onAdd}>추가</button>
				</div>
			</div>
		</>
	);
}
