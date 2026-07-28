// FactoryNote plan page — 시안 A(모노톤) React 목업
// 본문은 마크다운 파일(plan.md)에서 생성. mdToBlocks로 블록 단위 코멘트 모델로 변환.
import { useState, useMemo } from "react";
import Topbar from "./components/Topbar";
import Stepper from "./components/Stepper";
import Toc from "./components/Toc";
import Document from "./components/Document";
import SidePanel from "./components/SidePanel";
import GateBar from "./components/GateBar";
import planMd from "./data/plan.md?raw";
import { mdToBlocks } from "./lib/mdToBlocks";

const stages = [
	{ n: 1, label: "요청 이해", state: "current" },
	{ n: 2, label: "시나리오", state: "locked" },
	{ n: 3, label: "모듈 설계", state: "locked" },
	{ n: 4, label: "클래스 설계", state: "locked" },
	{ n: 5, label: "구현 계획", state: "locked" },
	{ n: 6, label: "최종 검증", state: "locked" },
];

const loop = { round: 2, remaining: "1 이슈" };
const feedbackIssues = [
	{ resolved: true, text: "✓ FR-2 솔트 길이 명시 — 해결" },
	{ resolved: false, text: "⚠ NFR-1 세션 만료 정책 누락 — Design 재검토 요청" },
];

const stripHtml = (html) => html.replace(/<[^>]+>/g, "").trim();

export default function App() {
	// plan.md → 블록 시퀀스 (모든 마크다운 문법)
	const blocks = useMemo(() => mdToBlocks(planMd), []);
	// 목차는 h2/h3 헤딩에서 자동 생성
	const toc = useMemo(() => {
		const hs = blocks.filter(
			(b) => b.type === "heading" && b.level >= 2 && b.level <= 3,
		);
		return hs.map((b, idx) => ({ label: stripHtml(b.html), cur: idx === 0 }));
	}, [blocks]);

	const [comments, setComments] = useState([]);
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
