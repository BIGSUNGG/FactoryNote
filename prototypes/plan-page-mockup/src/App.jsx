// FactoryNote plan page — 시안 A(모노톤) React 목업
// 더미 데이터를 컴포넌트에 주입. 게이트/루프는 정적 목업(상호작용 없음).
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
	{ label: "🚧 범위 경계", cur: false },
];

const requirements = [
	{ id: "FR-1", desc: "이메일·비밀번호 회원가입", tag: "기능" },
	{ id: "FR-2", desc: "비밀번호는 bcrypt 해싱 후 저장", tag: "보안" },
	{ id: "FR-3", desc: "로그인 성공 시 JWT 세션 발급", tag: "기능" },
	{ id: "NFR-1", desc: "로그인 응답 200ms 이내 (p95)", tag: "성능" },
];

const scope = {
	include: "이메일 인증, 세션 갱신",
	exclude: "OAuth 소셜 로그인(MVP 이후), 비밀번호 찾기(별도 Stage)",
};

const loop = { round: 2, remaining: "1 이슈" };
const issues = [
	{ resolved: true, text: "✓ FR-2 솔트 길이 명시 — 해결" },
	{ resolved: false, text: "⚠ NFR-1 세션 만료 정책 누락 — Design 재검토 요청" },
];

export default function App() {
	return (
		<>
			<Topbar stage={1} total={6} />
			<Stepper stages={stages} />
			<div className="layout">
				<Toc items={toc} />
				<Document reqs={requirements} scope={scope} />
				<SidePanel loop={loop} issues={issues} />
			</div>
			<GateBar stage={1} label="요청 이해" />
		</>
	);
}
