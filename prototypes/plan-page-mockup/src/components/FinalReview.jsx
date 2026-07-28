import { useState } from "react";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import GateBar from "./GateBar";

// Stage 6 — 사용자 최종 검증. 산출물 간 총괄 일관성 검사 + 승인.
const STAGES = [
	{ n: 1, label: "요청 이해", state: "done", route: "" },
	{ n: 2, label: "시나리오", state: "done", route: "scenarios" },
	{ n: 3, label: "모듈 아키텍처", state: "done", route: "modules" },
	{ n: 4, label: "클래스 설계", state: "done", route: "classes" },
	{ n: 5, label: "구현 계획", state: "done", route: "impl" },
	{ n: 6, label: "최종 검증", state: "current", route: "review" },
];

// 산출물 간 정합 검사 (행×열 교차)
const PRODUCTS = ["요구사항", "시나리오", "모듈", "클래스", "구현계획"];
const MATRIX = [
	{
		from: "요구사항",
		to: "시나리오",
		check: "모든 FR이 시나리오에 반영",
		ok: true,
	},
	{
		from: "시나리오",
		to: "모듈",
		check: "시나리오 흐름이 모듈 호출로 표현 가능",
		ok: true,
	},
	{ from: "모듈", to: "클래스", check: "각 모듈이 클래스로 분해됨", ok: true },
	{
		from: "클래스",
		to: "구현계획",
		check: "모든 클래스가 Phase에 할당됨",
		ok: false,
		note: "Mailer→외부 라이브러리는 별도",
	},
	{
		from: "요구사항",
		to: "클래스",
		check: "NFR(성능 200ms)이 클래스 설계에 반영",
		ok: false,
		note: "인덱스/캐시 설명 누락",
	},
];

const CHECKLIST = [
	"보안: 비밀번호 평문 저장/로깅 없음",
	"보안: JWT 만료·갱신 정책 명시",
	"성능: 로그인 p95 200ms 달성 가능 근거",
	"범위: OAuth/비밀번호 찾기 제외 확인",
	"일관성: 식별자·용어가 산출물 간统一",
];

export default function FinalReview() {
	const [checked, setChecked] = useState({});
	const toggle = (k) => setChecked((c) => ({ ...c, [k]: !c[k] }));
	const allOk = MATRIX.every((m) => m.ok);
	const checkedCount = Object.values(checked).filter(Boolean).length;

	return (
		<>
			<Topbar stage={6} total={6} />
			<Stepper stages={STAGES} />
			<div className="page-meta">
				<span className="stage-tag">Stage 6 / 6 · 최종 게이트</span>
				<span>
					<b>정합:</b> {MATRIX.filter((m) => m.ok).length}/{MATRIX.length}
				</span>
				<span>
					<b>체크:</b> {checkedCount}/{CHECKLIST.length}
				</span>
			</div>

			<main className="doc">
				<h1 className="page-title">🔍 Stage 6 — 사용자 최종 검증</h1>
				<p className="page-lede">
					산출물을 새로 만들지 않는다. Stage 1–5 간 <b>총괄 일관성</b>을
					검사하고 전체 Plan을 확정한다(원칙 5 게이트).
				</p>

				<div className={`verdict-banner ${allOk ? "ok" : "warn"}`}>
					{allOk
						? "✓ 산출물 간 정합 — 검증 통과 가능"
						: "⚠ 정합 미달 항목 존재 — 아래 미달 행 확인"}
				</div>

				<section className="review-section">
					<h2 className="section-title">산출물 간 정합 매트릭스</h2>
					<table className="matrix-table">
						<thead>
							<tr>
								<th>From</th>
								<th>To</th>
								<th>검증 항목</th>
								<th>결과</th>
							</tr>
						</thead>
						<tbody>
							{MATRIX.map((m, i) => (
								<tr key={i} className={m.ok ? "" : "row-warn"}>
									<td>{m.from}</td>
									<td>{m.to}</td>
									<td>
										{m.check}
										{m.note && <span className="matrix-note"> — {m.note}</span>}
									</td>
									<td>{m.ok ? "✓" : "⚠"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>

				<section className="review-section">
					<h2 className="section-title">수동 체크리스트</h2>
					<ul className="phase-tasks">
						{CHECKLIST.map((c) => (
							<li key={c} className="phase-task">
								<label>
									<input
										type="checkbox"
										checked={!!checked[c]}
										onChange={() => toggle(c)}
									/>
									<span>{c}</span>
								</label>
							</li>
						))}
					</ul>
				</section>

				<section className="review-section">
					<h2 className="section-title">Plan 개요 (전체)</h2>
					<div className="product-pills">
						{PRODUCTS.map((p) => (
							<span key={p} className="product-pill">
								{p}
							</span>
						))}
					</div>
					<p className="page-lede">
						이 Plan을 확정하면 파이프라인이 완료되고 산출물이 작업 공간에
						반영된다.
					</p>
				</section>
			</main>

			<GateBar
				stage={6}
				label="최종 검증"
				pendingCount={0}
				onApply={() => {}}
			/>
		</>
	);
}
