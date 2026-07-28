// 메인 산출물 본문 — 요구사항 명세 + 범위 경계.
export default function Document({ reqs, scope }) {
	return (
		<main className="doc">
			<h1>📖 Stage 1 — 요청 이해</h1>
			<div className="meta-quote">
				<span>
					<b>Stage:</b> 1/6
				</span>
				<span>
					<b>게이트:</b> 대기
				</span>
				<span>
					<b>Design↔Feedback:</b> 라운드 2
				</span>
				<span>
					<b>우선순위:</b> 🔴 High
				</span>
			</div>

			<section className="sec">
				<h2>📋 요구사항 명세</h2>
				<p>
					사용자가 이메일/비밀번호로 가입·로그인하고, 비밀번호는 안전하게
					저장된다.
				</p>
				{reqs.map((r) => (
					<div key={r.id} className="req">
						<span className="id">{r.id}</span>
						<span>{r.desc}</span>
						<span className="tag">{r.tag}</span>
					</div>
				))}
			</section>

			<section className="sec">
				<h2>🚧 범위 경계</h2>
				<p>
					<b>포함:</b> {scope.include}.&nbsp; <b>제외:</b> {scope.exclude}.
				</p>
			</section>
		</main>
	);
}
