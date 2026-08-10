// factorynote install — pi 확장을 로컬 pi(~/.pi/agent/extensions/)에 설치.
// 순수 Node(.mjs) — Windows/macOS/Linux 동일 동작. bash/WSL 의존 없음.
// pi는 jiti 로 TS 를 직접 로드하므로 컴파일 불필; @factorynote/core 는 로컬
// node_modules 패키지로 복사해 import 해석, 뷰어 dist 도 함께 배치.
import { execSync } from "node:child_process";
import {
	copyFileSync,
	cpSync,
	mkdirSync,
	rmSync,
	writeFileSync,
	existsSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const AGENT_DIR = process.env.PI_AGENT_DIR ?? join(homedir(), ".pi", "agent");
const EXT_DIR = join(AGENT_DIR, "extensions", "factorynote");

console.log(`factorynote install → ${EXT_DIR}`);

// 1) 뷰어 빌드 보장.
const viewerDistIndex = join(ROOT, "apps/plan-viewer/dist/index.html");
if (!existsSync(viewerDistIndex)) {
	console.log("  뷰어 빌드 중…");
	try {
		execSync("bun run build", {
			cwd: join(ROOT, "apps/plan-viewer"),
			stdio: "inherit",
		});
	} catch (err) {
		throw new Error(
			"뷰어 빌드 실패 — install 중단. 먼저 `bun run build:viewer` 로 원인 확인.",
			{ cause: err },
		);
	}
}

// 2) 기존 설치 정리 후 재배치.
rmSync(EXT_DIR, { recursive: true, force: true });
mkdirSync(join(EXT_DIR, "node_modules/@factorynote/core"), { recursive: true });
mkdirSync(join(EXT_DIR, "viewer"), { recursive: true });

// 확장 TS 진입점(+형제 모듈).
copyFileSync(
	join(ROOT, "apps/pi-extension/src/index.ts"),
	join(EXT_DIR, "index.ts"),
);
copyFileSync(
	join(ROOT, "apps/pi-extension/src/plan-tool.ts"),
	join(EXT_DIR, "plan-tool.ts"),
);
copyFileSync(
	join(ROOT, "apps/pi-extension/src/gate-server.ts"),
	join(EXT_DIR, "gate-server.ts"),
);

// 코어를 로컬 패키지로(@factorynote/core import 해석용). src/protocol/package.json 만.
cpSync(
	join(ROOT, "packages/factorynote/src"),
	join(EXT_DIR, "node_modules/@factorynote/core/src"),
	{ recursive: true },
);
cpSync(
	join(ROOT, "packages/factorynote/protocol"),
	join(EXT_DIR, "node_modules/@factorynote/core/protocol"),
	{ recursive: true },
);
writeFileSync(
	join(EXT_DIR, "node_modules/@factorynote/core/package.json"),
	`{
  "name": "@factorynote/core",
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts", "./protocol/*": "./protocol/*" }
}
`,
);

// 뷰어 빌드 산출물.
cpSync(join(ROOT, "apps/plan-viewer/dist"), join(EXT_DIR, "viewer/dist"), {
	recursive: true,
});

// 에이전트 정의(Design + 전문 Feedback 32개) — pi-subagents 가 ./agents 에서 발견(ADR-014).
cpSync(join(ROOT, "apps/pi-extension/agents"), join(EXT_DIR, "agents"), {
	recursive: true,
});

// 확장 메타(pi 가 index.ts 자동 발견; type:module 로 ESM 인식 보조).
// pi-subagents.agents 매니페스트 포함 — 설치된 확장에서 에이전트 발견(없으면 Unknown agent).
writeFileSync(
	join(EXT_DIR, "package.json"),
	`{
  "name": "factorynote",
  "version": "0.0.0",
  "type": "module",
  "pi-subagents": { "agents": ["./agents"] }
}
`,
);

console.log("설치 완료.");
console.log("  새 pi 세션에서: /factorynote   (plan 모드 토글)");
console.log(
	"  상태 조회 CLI : factorynote status   (또는 factorynote <feature>)",
);
