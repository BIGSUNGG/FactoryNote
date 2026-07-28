import { useState } from "react";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import GateBar from "./GateBar";

// Stage 5 — 구현 계획. Phase별 체크리스트 + 의존성.
const STAGES = [
	{ n: 1, label: "요청 이해", state: "done", route: "" },
	{ n: 2, label: "시나리오", state: "done", route: "scenarios" },
	{ n: 3, label: "모듈 아키텍처", state: "done", route: "modules" },
	{ n: 4, label: "클래스 설계", state: "done", route: "classes" },
	{ n: 5, label: "구현 계획", state: "current", route: "impl" },
	{ n: 6, label: "최종 검증", state: "locked", route: "review" },
];

const PHASES = [
	{
		name: "Phase 1 — 기반",
		deps: [],
		tasks: [
			"HashUtil (bcrypt cost 12)",
			"TokenService (JWT sign/verify)",
			"에러 타입 정의",
		],
	},
	{
		name: "Phase 2 — 저장/사용자",
		deps: ["Phase 1"],
		tasks: [
			"UserRepository + DB 마이그레이션",
			"UserService (create/findById)",
			"Mailer 연동",
		],
	},
	{
		name: "Phase 3 — 인증 오케스트레이션",
		deps: ["Phase 2"],
		tasks: [
			"AuthService (signup/login/logout)",
			"토큰 갱신 흐름",
			"rate-limit 미들웨어",
		],
	},
	{
		name: "Phase 4 — 엔드포인트",
		deps: ["Phase 3"],
		tasks: ["AuthController 라우트", "요청 검증 DTO", "OpenAPI 문서"],
	},
];

export default function ImplementationPlan() {
	const [done, setDone] = useState({}); // task -> bool
	const toggle = (t) => setDone((d) => ({ ...d, [t]: !d[t] }));
	const total = PHASES.reduce((a, p) => a + p.tasks.length, 0);
	const completed = Object.values(done).filter(Boolean).length;

	return (
		<>
			<Topbar stage={5} total={6} />
			<Stepper stages={STAGES} />
			<div className="page-meta">
				<span className="stage-tag">Stage 5 / 6 · 산출물</span>
				<span>
					<b>진행:</b> {completed}/{total}
				</span>
				<span>
					<b>Phase:</b> {PHASES.length}
				</span>
				<span>
					<b>Design↔Feedback:</b> 라운드 1
				</span>
			</div>

			<main className="doc">
				<h1 className="page-title">✅ Stage 5 — 구현 계획</h1>
				<p className="page-lede">
					설계를 바탕으로 구현 순서·의존성·마일스톤을 정한다. 아래 체크는 구현
					진행 시뮬레이션(목업).
				</p>

				<div className="progress-bar">
					<div
						className="progress-fill"
						style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
					/>
				</div>

				{PHASES.map((p) => (
					<section key={p.name} className="phase-card">
						<header className="phase-head">
							<h2>{p.name}</h2>
							{p.deps.length > 0 && (
								<span className="phase-dep">⤳ {p.deps.join(", ")}</span>
							)}
						</header>
						<ul className="phase-tasks">
							{p.tasks.map((t) => (
								<li key={t} className="phase-task">
									<label>
										<input
											type="checkbox"
											checked={!!done[t]}
											onChange={() => toggle(t)}
										/>
										<span className={done[t] ? "task-done" : ""}>{t}</span>
									</label>
								</li>
							))}
						</ul>
					</section>
				))}
			</main>

			<GateBar
				stage={5}
				label="구현 계획"
				pendingCount={0}
				onApply={() => {}}
			/>
		</>
	);
}
