// 브라우저 오픈 + 모듈 경로 유틸(테스트 주입 가능).
import { exec } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function openBrowser(url: string): void {
	// 방어: 게이트 서버가 생성한 localhost http URL 만 허용(명령 주입 차단).
	if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) return;
	const cmd =
		process.platform === "win32"
			? `start "" "${url}"`
			: process.platform === "darwin"
				? `open "${url}"`
				: `xdg-open "${url}"`;
	exec(cmd, () => {
		/* 열기 실패는 무시 — 사용자가 URL을 직접 열 수 있음 */
	});
}

export { openBrowser };

/** ESM 모듈 경로에서 디렉토리 추출(jiti 환경에서 import.meta.url 사용). */
export function moduleDir(importMetaUrl: string): string {
	return join(fileURLToPath(importMetaUrl), "..");
}

/** 뷰어 dist 디렉토리 후보를 순서대로 탐색. */
export function resolveViewerDist(candidates: string[]): string | null {
	// 동기 존재 여부는 호출측에서 비동기로 확인; 여기선 후보만 정리.
	for (const c of candidates) {
		if (c) return c;
	}
	return null;
}
