import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import GateBar from "./GateBar";

// Stage 3 산출물 — 모듈 의존 관계도. 노드(모듈)와 엣지(의존 A→B) 모두 상세·코멘트.
mermaid.initialize({
	startOnLoad: false,
	securityLevel: "loose",
	theme: "base",
	themeVariables: {
		primaryColor: "#ffffff",
		primaryTextColor: "#111827",
		primaryBorderColor: "#111827",
		lineColor: "#111827",
		fontFamily: "Inter, sans-serif",
		fontSize: "13px",
	},
	flowchart: { nodeSpacing: 40, rankSpacing: 50, curve: "basis" },
});

const STAGES = [
	{ n: 1, label: "요청 이해", state: "done" },
	{ n: 2, label: "시나리오", state: "done" },
	{ n: 3, label: "모듈 아키텍처", state: "current" },
	{ n: 4, label: "클래스 설계", state: "locked" },
	{ n: 5, label: "구현 계획", state: "locked" },
	{ n: 6, label: "최종 검증", state: "locked" },
];

const MODULES = {
	AuthController: {
		layer: "API",
		desc: "로그인·회원가입 HTTP 엔드포인트. 요청을 받아 AuthService로 위임.",
		deps: ["AuthService"],
	},
	AuthService: {
		layer: "Service",
		desc: "인증 로직 오케스트레이션. 해싱·토큰 발급·사용자 생성을 조율.",
		deps: ["UserService", "HashUtil", "TokenService"],
	},
	UserService: {
		layer: "Service",
		desc: "사용자 생성·조회. 저장소와 메일러를 호출.",
		deps: ["UserRepository", "Mailer"],
	},
	HashUtil: {
		layer: "Util",
		desc: "bcrypt(cost 12) 해싱. 순수 함수, 의존 없음.",
		deps: [],
	},
	TokenService: {
		layer: "Util",
		desc: "JWT 서명·검증. 만료·갱신 정책 포함.",
		deps: [],
	},
	UserRepository: {
		layer: "Repository",
		desc: "DB 접근 추상화. SQL 쿼리 캡슐화.",
		deps: ["Database"],
	},
	Mailer: { layer: "External", desc: "인증 메일 발송 (외부 SMTP).", deps: [] },
	Database: { layer: "External", desc: "PostgreSQL. 외부 시스템.", deps: [] },
};

// 의존(엣지) 데이터 — key = "From->To". 설명과 코멘트 대상.
const DEPS = {
	"AuthController->AuthService": {
		from: "AuthController",
		to: "AuthService",
		desc: "로그인/가입 요청을 인증 서비스로 위임.",
	},
	"AuthService->UserService": {
		from: "AuthService",
		to: "UserService",
		desc: "사용자 생성·조회 호출.",
	},
	"AuthService->HashUtil": {
		from: "AuthService",
		to: "HashUtil",
		desc: "비밀번호 bcrypt 해싱 위임.",
	},
	"AuthService->TokenService": {
		from: "AuthService",
		to: "TokenService",
		desc: "JWT 발급·검증 요청.",
	},
	"UserService->UserRepository": {
		from: "UserService",
		to: "UserRepository",
		desc: "DB 저장·조회 위임.",
	},
	"UserService->Mailer": {
		from: "UserService",
		to: "Mailer",
		desc: "인증 메일 발송 요청.",
	},
	"UserRepository->Database": {
		from: "UserRepository",
		to: "Database",
		desc: "SQL 실행.",
	},
};

const GRAPH = `graph TD
  AC[AuthController] --> AS[AuthService]
  AS --> US[UserService]
  AS --> HU[HashUtil]
  AS --> TS[TokenService]
  US --> UR[UserRepository]
  US --> ML[Mailer]
  UR --> DB[(Database)]`;

// mermaid 그래프 렌더. 노드 클릭 → 모듈, 엣지 클릭 → 의존(DEPS 순서 매핑).
function Graph({ onSelectModule, onSelectEdge }) {
	const ref = useRef(null);
	useEffect(() => {
		let cancelled = false;
		const depKeys = Object.keys(DEPS);
		mermaid
			.render("module-graph", GRAPH)
			.then(({ svg }) => {
				if (cancelled || !ref.current) return;
				const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
				ref.current.replaceChildren(doc.documentElement);

				// 노드 — 텍스트로 모듈명 매칭
				ref.current.querySelectorAll(".node").forEach((node) => {
					const label = (node.textContent || "").trim();
					const name = Object.keys(MODULES).find((k) => label === k);
					if (name) {
						node.style.cursor = "pointer";
						node.addEventListener("click", () => onSelectModule(name));
					}
				});

				// 엣지 — path 순서 = GRAPH의 엣지 정의 순서(=DEPS keys 순서) 가정
				const paths = ref.current.querySelectorAll(
					".edgePaths path, .edges path, .flowchart-link",
				);
				paths.forEach((p, idx) => {
					const key = depKeys[idx];
					if (!key) return;
					p.style.cursor = "pointer";
					p.style.pointerEvents = "stroke";
					p.addEventListener("click", (e) => {
						e.stopPropagation();
						onSelectEdge(key);
					});
				});
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [onSelectModule, onSelectEdge]);

	return <div ref={ref} className="mermaid-wrap" />;
}

export default function ModuleDesign() {
	// selected = {type:"module"|"edge", id}
	const [selected, setSelected] = useState({
		type: "module",
		id: "AuthController",
	});
	const [comments, setComments] = useState({}); // key(module명 or "A->B") -> [text]
	const [draft, setDraft] = useState("");

	const pending = Object.values(comments).reduce((a, b) => a + b.length, 0);

	const selectModule = (name) => setSelected({ type: "module", id: name });
	const selectEdge = (key) => setSelected({ type: "edge", id: key });

	const commentKey = () =>
		selected.type === "edge" ? selected.id : selected.id;
	const list = comments[commentKey()] || [];

	const addComment = () => {
		if (!draft.trim()) return;
		const k = commentKey();
		setComments((c) => ({ ...c, [k]: [...(c[k] || []), draft.trim()] }));
		setDraft("");
	};

	return (
		<>
			<Topbar stage={3} total={6} />
			<Stepper stages={STAGES} />
			<div className="meta">
				<span className="stage-tag">Stage 3 / 6 · 산출물</span>
				<span>
					<b>산출물:</b> 모듈 구조도
				</span>
				<span>
					<b>모듈:</b> 8 · <b>의존:</b> 7
				</span>
				<span>
					<b>Design↔Feedback:</b> 라운드 1
				</span>
			</div>

			<div className="workspace">
				<div className="graph-card">
					<h3 className="card-title">📦 모듈 의존 관계도</h3>
					<Graph onSelectModule={selectModule} onSelectEdge={selectEdge} />
					<div className="legend">
						<span className="lg">
							<span className="d box" /> 모듈 (클릭 → 상세·코멘트)
						</span>
						<span className="lg">
							<span className="d cyl" /> 외부 시스템
						</span>
						<span className="lg">→ 화살표 클릭 → 의존 설명·코멘트</span>
					</div>
				</div>

				<aside className="detail">
					{selected.type === "module" ? (
						<ModulePanel
							name={selected.id}
							comments={comments}
							onSelectModule={selectModule}
							onSelectEdge={selectEdge}
						/>
					) : (
						<EdgePanel
							edge={DEPS[selected.id]}
							comments={comments}
							draft={draft}
							setDraft={setDraft}
							onAdd={addComment}
							onBack={() => selectModule(DEPS[selected.id].from)}
							count={list.length}
						/>
					)}
				</aside>
			</div>

			<GateBar
				stage={3}
				label="모듈 아키텍처"
				pendingCount={pending}
				onApply={() => setComments({})}
			/>
		</>
	);
}

// 모듈 상세 — 역할 + 관련 의존(나가는·들어오는). 의존 행 클릭 → 의존 상세.
function ModulePanel({ name, comments, onSelectModule, onSelectEdge }) {
	const m = MODULES[name];
	const outgoing = Object.entries(DEPS).filter(([, v]) => v.from === name);
	const incoming = Object.entries(DEPS).filter(([, v]) => v.to === name);

	return (
		<>
			<h4 className="card-title">모듈 상세</h4>
			<div className="mod-name">{name}</div>
			<span className="layer-pill">{m.layer}</span>
			<div className="mod-desc">{m.desc}</div>

			<h4 className="card-title" style={{ marginTop: "var(--s4)" }}>
				의존 관계
			</h4>
			{outgoing.length === 0 && incoming.length === 0 && (
				<div className="empty">이 모듈과 관련된 의존이 없습니다.</div>
			)}

			{outgoing.length > 0 && (
				<div className="dep-group">
					<div className="dep-group-label">나가는 (→)</div>
					{outgoing.map(([key, v]) => (
						<div
							key={key}
							className="dep-row"
							onClick={() => onSelectEdge(key)}
						>
							<span className="dep-arrow">→</span>
							<span
								className="dep-target"
								onClick={(e) => {
									e.stopPropagation();
									onSelectModule(v.to);
								}}
							>
								{v.to}
							</span>
							<span className="dep-desc">{v.desc}</span>
							<span className="dep-count">
								💬{(comments[key] || []).length}
							</span>
						</div>
					))}
				</div>
			)}

			{incoming.length > 0 && (
				<div className="dep-group">
					<div className="dep-group-label">들어오는 (←)</div>
					{incoming.map(([key, v]) => (
						<div
							key={key}
							className="dep-row"
							onClick={() => onSelectEdge(key)}
						>
							<span className="dep-arrow">←</span>
							<span
								className="dep-target"
								onClick={(e) => {
									e.stopPropagation();
									onSelectModule(v.from);
								}}
							>
								{v.from}
							</span>
							<span className="dep-desc">{v.desc}</span>
							<span className="dep-count">
								💬{(comments[key] || []).length}
							</span>
						</div>
					))}
				</div>
			)}
		</>
	);
}

// 의존(엣지) 상세 — from→to, 설명, 코멘트.
function EdgePanel({ edge, comments, draft, setDraft, onAdd, onBack, count }) {
	const key = `${edge.from}->${edge.to}`;
	const list = comments[key] || [];
	return (
		<>
			<h4 className="card-title">의존 상세</h4>
			<div className="edge-name">
				<span className="dep-target" onClick={() => onBack()}>
					{edge.from}
				</span>
				<span className="edge-arrow"> → </span>
				<span className="dep-target">{edge.to}</span>
			</div>
			<div className="mod-desc">{edge.desc}</div>

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
						placeholder={`${edge.from} → ${edge.to} 의존에 코멘트…`}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && onAdd()}
					/>
					<button onClick={onAdd}>추가</button>
				</div>
			</div>
		</>
	);
}
