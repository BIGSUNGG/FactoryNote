// bun:test preload — 뷰어 dist(gitignore 빌드 산출물)가 없으면 빌드한다.
// gate-server/plan-tool 테스트가 dist/index.html 을 게이트 서버로 서빙하므로,
// 신규 클론 등 dist 가 없는 환경에서도 `bun test` 가 green 이 되도록 보장한다.
// dist 가 이미 존재하면 no-op.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = import.meta.dir;
const distIndex = join(root, "apps", "plan-viewer", "dist", "index.html");
if (!existsSync(distIndex)) {
	try {
		execSync("bun run build", {
			cwd: join(root, "apps", "plan-viewer"),
			stdio: "inherit",
		});
	} catch (err) {
		throw new Error(
			`뷰어 dist 빌드 실패 — 게이트 테스트가 dist/index.html 을 필요로 합니다. apps/plan-viewer 에서 \`bun install\` 후 \`bun run build\` 를 실행하세요. 원인: ${(err as Error).message}`,
		);
	}
}
