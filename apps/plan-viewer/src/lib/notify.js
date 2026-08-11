// 다음 단계 ready 알림 + 권한 요청 — 데스크톱 Notification · 탭 타이틀 점멸 · 포커스.

export function notifyNewStage(s) {
	document.title = `● Stage ${s.stage} 준비됨 — FactoryNote`;
	window.focus?.();
	if ("Notification" in window && Notification.permission === "granted") {
		try {
			new Notification(`FactoryNote — Stage ${s.stage} ${s.stageName}`, {
				body: "다음 단계 산출물이 준비되었습니다. 검토하세요.",
			});
		} catch {
			/* 일부 브라우저는 생성자 호출 제한 */
		}
	}
	const reset = () => {
		document.title = "FactoryNote Plan";
		window.removeEventListener("focus", reset);
	};
	window.addEventListener("focus", reset);
}

// 사용자 제스처(결정 클릭) 타이밍에 권한 요청 — 다음 ready 알림을 위해 미리 확보.
export function requestNotifyPermission() {
	if (!("Notification" in window)) return;
	if (Notification.permission === "default") {
		try {
			Notification.requestPermission();
		} catch {
			/* 무시 */
		}
	}
}
