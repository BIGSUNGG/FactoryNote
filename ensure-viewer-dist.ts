// 뷰어 dist(gitignore 빌드 산출물)가 없거나 **소스보다 낡았으면** 빌드한다.
// - bun:test preload: gate-server/plan-tool 테스트가 dist/index.html 을 게이트 서버로
//   서빙하므로, 신규 클론(dist 없음)은 물론 소스 변경 후(dist 낡음) 에도 항상 최신이 되도록 보장.
// - repro-graph-kinds.mjs 등 수동 데모: 동일 함수로 서빙 전 최신 빌드를 보장(낡은 dist 로
//   그래프가 안 보이는 회귀 방지).
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VIEWER_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"apps",
	"plan-viewer",
);
export const VIEWER_DIST_INDEX = join(VIEWER_DIR, "dist", "index.html");

/** 순결정: dist mtime(null=없음) 이 소스 mtime 보다 오래됐는지(=재빌드 필요). 단위 테스트용. */
export function viewerDistIsStale(
	distMtimeMs: number | null,
	srcMtimeMs: number,
): boolean {
	return distMtimeMs === null || distMtimeMs < srcMtimeMs;
}

/** viewer 트리(apps/plan-viewer) 에서 node_modules·dist 제외한 파일 중 가장 최신 mtime(ms). */
function newestMtime(dir: string): number {
	let newest = 0;
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		if (ent.name === "node_modules" || ent.name === "dist") continue;
		const p = join(dir, ent.name);
		const m = ent.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs;
		if (m > newest) newest = m;
	}
	return newest;
}

/** dist 가 없거나 소스보다 낡았으면 vite 빌드. 신선하면 no-op. repro 와 bun:test preload 공용. */
export function ensureViewerDist(): void {
	const distMtime = existsSync(VIEWER_DIST_INDEX)
		? statSync(VIEWER_DIST_INDEX).mtimeMs
		: null;
	if (!viewerDistIsStale(distMtime, newestMtime(VIEWER_DIR))) return;
	try {
		execSync("bun run build", {
			cwd: VIEWER_DIR,
			stdio: "inherit",
		});
	} catch (err) {
		throw new Error(
			`뷰어 dist 빌드 실패 — 게이트 테스트/repro 가 dist/index.html 을 필요로 합니다. apps/plan-viewer 에서 \`bun install\` 후 \`bun run build\` 를 실행하세요. 원인: ${(err as Error).message}`,
		);
	}
}

// bun:test preload 로 로드 시 자동 실행(사이드이펙트).
ensureViewerDist();
