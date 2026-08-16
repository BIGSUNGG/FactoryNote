// 브라우저 오픈 + 모듈 경로 유틸(테스트 주입 가능).
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 게이트 URL 허용 목록 — 게이트 서버가 생성한 localhost http URL 만 통과. */
const GATE_URL_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

/**
 * 플랫폼별 브라우저 오픈 커맨드 사양(순수 함수 — 스폰 없이 테스트 가능).
 * 셸을 거치지 않는 인자 배열만 반환 → URL 이 커맨드에 섞일 여지가 구조적으로 없음.
 * 허용 목록 외 URL 은 null.
 */
export function browserCommand(
	platform: NodeJS.Platform,
	url: string,
): { command: string; args: string[] } | null {
	if (!GATE_URL_RE.test(url)) return null;
	switch (platform) {
		case "win32":
			// start 는 cmd 내장 명령 — cmd /c 를 통해서만 호출. URL 은 정규식으로
			// 검증된 문자열이며 인자 배열로 전달되므로 셸 메타문자 해석이 일어나지 않는다.
			return { command: "cmd", args: ["/c", "start", "", url] };
		case "darwin":
			return { command: "open", args: [url] };
		default:
			return { command: "xdg-open", args: [url] };
	}
}

function openBrowser(url: string): void {
	const spec = browserCommand(process.platform, url);
	if (!spec) return;
	// pi-lens-ignore: opengrep:javascript.lang.security.detect-child-process.detect-child-process
	// nosemgrep: javascript.lang.security.detect-child-process.detect-child-process — URL 은 GATE_URL_RE 전일치 허용 목록 통과 후 인자 배열로 전달(shell:false), 셸 문자열 조립 경로 없음.
	const child = spawn(spec.command, spec.args, { shell: false, stdio: "ignore" });
	child.on("error", () => {
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
