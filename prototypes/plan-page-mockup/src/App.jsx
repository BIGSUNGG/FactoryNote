// FactoryNote plan page — 시안 A(모노톤) React 목업
// 본문 = 블록 시퀀스. 모든 블록 + 표 셀이 코멘트 대상.
// 팝오버는 한 번에 하나만. '수정 지시'로 일괄 적용.
import { useState } from "react";
import Topbar from "./components/Topbar";
import Stepper from "./components/Stepper";
import Toc from "./components/Toc";
import Document from "./components/Document";
import SidePanel from "./components/SidePanel";
import GateBar from "./components/GateBar";

const stages = [
	{ n: 1, label: "요청 이해", state: "current" },
	{ n: 2, label: "시나리오", state: "locked" },
	{ n: 3, label: "모듈 설계", state: "locked" },
	{ n: 4, label: "클래스 설계", state: "locked" },
	{ n: 5, label: "구현 계획", state: "locked" },
	{ n: 6, label: "최종 검증", state: "locked" },
];

const toc = [
	{ label: "📋 요구사항 명세", cur: true },
	{ label: "🧩 인증 흐름", cur: false },
	{ label: "🔧 핵심 로직", cur: false },
	{ label: "✅ 구현 체크리스트", cur: false },
	{ label: "📊 처리 매트릭스", cur: false },
	{ label: "🚧 범위 경계", cur: false },
];

const blocks = [
	{ id: "h-req", type: "heading", text: "📋 요구사항 명세" },
	{
		id: "p-req",
		type: "paragraph",
		text: "사용자가 이메일/비밀번호로 가입·로그인하고, 비밀번호는 안전하게 저장된다.",
	},
	{
		id: "FR-1",
		type: "requirement",
		req: { id: "FR-1", desc: "이메일·비밀번호 회원가입", tag: "기능" },
	},
	{
		id: "FR-2",
		type: "requirement",
		req: { id: "FR-2", desc: "비밀번호는 bcrypt 해싱 후 저장", tag: "보안" },
	},
	{
		id: "FR-3",
		type: "requirement",
		req: { id: "FR-3", desc: "로그인 성공 시 JWT 세션 발급", tag: "기능" },
	},
	{
		id: "NFR-1",
		type: "requirement",
		req: { id: "NFR-1", desc: "로그인 응답 200ms 이내 (p95)", tag: "성능" },
	},
	{ id: "h-flow", type: "heading", text: "🧩 인증 흐름" },
	{
		id: "graph-seq",
		type: "graph",
		ascii:
			"Client ──login(email,pw)──▶ Server\nServer ──bcrypt.hash(pw,12)──▶ DB\nServer ──sign JWT(15m)──▶ Client",
		caption: "시퀀스: 로그인 → 해싱 → 토큰 발급",
	},
	{ id: "h-stack", type: "heading", text: "🔧 핵심 로직" },
	{
		id: "code-hash",
		type: "code",
		lang: "ts",
		code: "function hashPassword(pw: string): string {\n  return bcrypt.hashSync(pw, 12);\n}",
	},
	{ id: "h-todo", type: "heading", text: "✅ 구현 체크리스트" },
	{
		id: "todo-1",
		type: "todo",
		checked: false,
		text: "bcrypt cost=12 적용 검증",
	},
	{
		id: "todo-2",
		type: "todo",
		checked: false,
		text: "JWT 만료/갱신 정책 정의",
	},
	{
		id: "todo-3",
		type: "todo",
		checked: true,
		text: "비밀번호 평문 로깅 방지",
	},
	{ id: "h-matrix", type: "heading", text: "📊 처리 매트릭스" },
	{
		id: "tbl-matrix",
		type: "table",
		headers: ["항목", "현재", "목표"],
		rows: [
			["해싱", "미정", "bcrypt cost 12"],
			["세션", "없음", "JWT + 갱신"],
			["감사 로그", "N/A", "평문 제외"],
		],
	},
	{ id: "h-range", type: "heading", text: "🚧 범위 경계" },
	{
		id: "p-range",
		type: "paragraph",
		text: "포함: 이메일 인증, 세션 갱신. 제외: OAuth 소셜 로그인(MVP 이후), 비밀번호 찾기(별도 Stage).",
	},
];

const loop = { round: 2, remaining: "1 이슈" };
const feedbackIssues = [
	{ resolved: true, text: "✓ FR-2 솔트 길이 명시 — 해결" },
	{ resolved: false, text: "⚠ NFR-1 세션 만료 정책 누락 — Design 재검토 요청" },
];

export default function App() {
	const [comments, setComments] = useState([]);
	// 단일 팝오버: 블록 id 또는 셀 id 중 하나만 활성
	const [activeTargetId, setActiveTargetId] = useState(null);

	const addComment = (targetId, text) => {
		setComments((c) => [
			...c,
			{
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				targetId,
				text,
				applied: false,
			},
		]);
	};

	const applyComments = () => {
		setComments((c) => c.map((x) => ({ ...x, applied: true })));
		setActiveTargetId(null);
	};

	// 같은 타겟再클릭 → 닫힘, 다른 타겟 → 전환 (한 번에 하나만)
	const activate = (id) =>
		setActiveTargetId((prev) => (prev === id ? null : id));

	const pendingCount = comments.filter((c) => !c.applied).length;

	return (
		<>
			<Topbar stage={1} total={6} />
			<Stepper stages={stages} />
			<div className="layout">
				<Toc items={toc} />
				<Document
					blocks={blocks}
					comments={comments}
					onAddComment={addComment}
					activeTargetId={activeTargetId}
					onActivate={activate}
				/>
				<SidePanel loop={loop} issues={feedbackIssues} comments={comments} />
			</div>
			<GateBar
				stage={1}
				label="요청 이해"
				pendingCount={pendingCount}
				onApply={applyComments}
			/>
		</>
	);
}
