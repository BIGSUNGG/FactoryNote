// 포인터 임계값 드래그 개시(ADR-032) — HTML5 DnD 대신 포인터 이벤트 기반.
// 웹뷰·임베디드 브라우저에서 HTML5 드래그 세션이 개시되지 않는 문제를 회피한다.
// 4px 초과 이동 시에만 start() 호출 → 클릭(탭 선택·블록 코멘트)은 그대로 동작.
export function armDrag(e, start) {
	const x = e.clientX;
	const y = e.clientY;
	const cleanup = () => {
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerup", up);
	};
	const move = (ev) => {
		if (Math.hypot(ev.clientX - x, ev.clientY - y) > 4) {
			cleanup();
			start();
		}
	};
	const up = () => cleanup();
	window.addEventListener("pointermove", move);
	window.addEventListener("pointerup", up);
}
