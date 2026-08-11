// 뷰어 dist 디렉토리 탐색 — 설치형/개발형 후보를 순서대로 확인.
import { access } from "node:fs/promises";
import { join } from "node:path";
import { moduleDir } from "./gate-server.ts";

export async function resolveViewerDistDir(cwd: string): Promise<string> {
	const extDir = moduleDir(import.meta.url); // index.ts 가 있는 디렉토리
	const candidates = [
		process.env.FACTORYNOTE_VIEWER_DIST,
		join(extDir, "viewer", "dist"), // 설치형: <ext>/viewer/dist
		join(cwd, "apps", "plan-viewer", "dist"), // 개발: 리포 내 뷰어
	];
	for (const c of candidates) {
		if (!c) continue;
		try {
			await access(join(c, "index.html"));
			return c;
		} catch {
			/* 다음 후보 */
		}
	}
	// 마지막 후보를 기본값으로 반환(에러 메시지에 활용).
	return join(cwd, "apps", "plan-viewer", "dist");
}
