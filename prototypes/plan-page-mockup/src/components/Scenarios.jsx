import Topbar from "./Topbar";
import Stepper from "./Stepper";
import GateBar from "./GateBar";

// Stage 2 — 정상 동작 시나리오. 각 시나리오의 단계 플로우.
const STAGES = [
	{ n: 1, label: "요청 이해", state: "done", route: "" },
	{ n: 2, label: "시나리오", state: "current", route: "scenarios" },
	{ n: 3, label: "모듈 아키텍처", state: "locked", route: "modules" },
	{ n: 4, label: "클래스 설계", state: "locked", route: "classes" },
	{ n: 5, label: "구현 계획", state: "locked", route: "impl" },
	{ n: 6, label: "최종 검증", state: "locked", route: "review" },
];

const SCENARIOS = [
	{
		id: "S1",
		title: "회원가입",
		actor: "사용자",
		steps: [
			"이메일·비밀번호 입력",
			"AuthService.signup() 호출",
			"비밀번호 bcrypt 해싱(cost 12)",
			"DB 저장",
			"인증 메일 발송",
		],
	},
	{
		id: "S2",
		title: "로그인",
		actor: "사용자",
		steps: [
			"이메일·비밀번호 입력",
			"UserService로 사용자 조회",
			"HashUtil로 비밀번호 검증",
			"TokenService로 JWT 발급(수명 15m)",
			"클라이언트에 토큰 반환",
		],
	},
	{
		id: "S3",
		title: "토큰 갱신",
		actor: "시스템",
		steps: [
			"만료 임박 토큰 감지",
			"TokenService.verifyRefresh()",
			"새 access 토큰 발급",
			"클라이언트 갱신",
		],
	},
	{
		id: "S4",
		title: "인증 실패",
		actor: "사용자",
		steps: [
			"잘못된 비밀번호 입력",
			"해시 불일치",
			"401 응답 + rate-limit 카운트",
		],
	},
	{
		id: "S5",
		title: "로그아웃",
		actor: "사용자",
		steps: ["토큰 폐기 요청", "세션 종료", "클라이언트 토큰 삭제"],
	},
];

export default function Scenarios() {
	return (
		<>
			<Topbar stage={2} total={6} />
			<Stepper stages={STAGES} />
			<div className="page-meta">
				<span className="stage-tag">Stage 2 / 6 · 산출물</span>
				<span>
					<b>시나리오:</b> {SCENARIOS.length}
				</span>
				<span>
					<b>Design↔Feedback:</b> 라운드 1
				</span>
			</div>

			<main className="doc">
				<h1 className="page-title">📖 Stage 2 — 정상 동작 시나리오</h1>
				<p className="page-lede">
					요구사항이 충족될 때 시스템이 어떻게 동작해야 하는지를 단계 시나리오로
					묘사한다.
				</p>

				{SCENARIOS.map((s) => (
					<section key={s.id} className="scenario-card">
						<header className="scenario-head">
							<span className="scenario-id">{s.id}</span>
							<h2>{s.title}</h2>
							<span className="scenario-actor">👤 {s.actor}</span>
						</header>
						<ol className="scenario-steps">
							{s.steps.map((step, i) => (
								<li key={i}>{step}</li>
							))}
						</ol>
					</section>
				))}
			</main>

			<GateBar stage={2} label="시나리오" pendingCount={0} onApply={() => {}} />
		</>
	);
}
