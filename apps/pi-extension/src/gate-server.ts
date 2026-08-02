// Gate server — 로컬 HTTP 서버로 뷰어를 서빙하고 사용자 게이트 결정을 받아 에이전트로 반환.
// 웹 페이지가 게이트 역할(ADR-003 옵션 경로를 주경로로). node:* builtins만 사용(런타임 의존 0).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	STAGES,
	loadState,
	parseGraphArtifact,
	readArtifact,
	type ArtifactFormat,
	type GateDecision,
	type GraphSection,
} from "@factorynote/core";

export interface ViewerState {
	feature: string;
	stage: number;
	stageName: string;
	requiresArtifact: boolean;
	done: boolean;
	designPrompt: string;
	feedbackChecklist: string[];
	artifacts: {
		stage: number;
		name: string;
		file: string;
		format: ArtifactFormat;
		md?: string;
		graphSections?: GraphSection[];
	}[];
}

async function buildViewerState(
	root: string,
	feature: string,
): Promise<ViewerState> {
	const state = (await loadState(root, feature)) ?? null;
	const stage = state?.stage ?? 1;
	const def = STAGES[stage - 1] ?? STAGES[0]!;
	const artifacts: ViewerState["artifacts"] = [];
	for (const s of STAGES) {
		if (!s.artifactFile) continue;
		// 회귀 정합성(#1): revert 로 state.stage 가 뒤로 옮겨졌다면 그 이후 단계의
		// (이제 무효한) 산출물은 뷰어에서 숨긴다. state 미지정 시 기존 동작 유지.
		if (state && s.id > state.stage) continue;
		const raw = await readArtifact(root, feature, s.artifactFile);
		if (raw === undefined) continue;
		if (s.format === "nodes-edges") {
			const ga = parseGraphArtifact(raw);
			if (ga) {
				artifacts.push({
					stage: s.id,
					name: s.name,
					file: s.artifactFile,
					format: s.format,
					graphSections: ga.sections,
				});
			}
		} else {
			artifacts.push({
				stage: s.id,
				name: s.name,
				file: s.artifactFile,
				format: s.format,
				md: raw,
			});
		}
	}
	return {
		feature,
		stage,
		stageName: def.name,
		requiresArtifact: def.producesArtifact,
		done: state?.done ?? false,
		designPrompt: def.designPrompt,
		feedbackChecklist: [...def.feedbackChecklist],
		artifacts,
	};
}

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

function safeJoin(dist: string, urlPath: string): string | null {
	const cleaned = urlPath.split("?")[0]!.replace(/^\/+/, "");
	const target = normalize(join(dist, cleaned));
	const rel = relative(dist, target);
	if (rel.startsWith("..") || rel.includes(`..${sep}`)) return null; // traversal 차단
	return target;
}

function openBrowser(url: string): void {
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

export interface RunGateOptions {
	root: string;
	feature: string;
	viewerDistDir: string;
	signal?: AbortSignal;
	open?: boolean;
	/** 게이트 자동 만료(ms). 0 또는 미지정=끄기(무한대기, 기존 동작). 좀비 게이트 방지(#4). */
	timeoutMs?: number;
	/** 서버가 준비되면 URL 을 알림(테스트/디버그용). */
	onReady?: (url: string) => void;
}

/**
 * 게이트 서버 구동 → 브라우저 오픈 → 사용자 결정 대기 → 종료.
 * 결정(POST /api/decision) 도착 또는 signal 중단 시 서버 닫고 결정 반환.
 */
export async function runGate(opts: RunGateOptions): Promise<GateDecision> {
	const {
		root,
		feature,
		viewerDistDir,
		signal,
		open = true,
		timeoutMs = 0,
		onReady,
	} = opts;

	let resolveDecision: ((d: GateDecision) => void) | null = null;
	const decided = new Promise<GateDecision>((resolve) => {
		resolveDecision = resolve;
	});
	// 결정 resolve 는 1회만(POST/abort/timeout 중복 발생 시 좀비 호출 방지, #4).
	let settled = false;
	const settle = (d: GateDecision): void => {
		if (settled) return;
		settled = true;
		resolveDecision?.(d);
	};

	const server = createServer(async (req, res) => {
		const url = req.url ?? "/";
		res.setHeader("Cache-Control", "no-store");
		try {
			if (url === "/api/state") {
				const payload = await buildViewerState(root, feature);
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(payload));
				return;
			}
			if (url === "/api/decision" && req.method === "POST") {
				const body = await readBody(req);
				const parsed = JSON.parse(body) as GateDecision;
				const decision: GateDecision = {
					verdict: parsed.verdict,
					comments: Array.isArray(parsed.comments) ? parsed.comments : [],
					...(Array.isArray(parsed.graphSections)
						? { graphSections: parsed.graphSections }
						: {}),
					// FR-7: 회귀 대상 단계(revertTo) 뷰어→엔진으로 전달(drop 되면 다단계 회귀 무력화).
					...(typeof parsed.revertTo === "number"
						? { revertTo: parsed.revertTo }
						: {}),
				};
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true }), () => settle(decision));
				return;
			}
			// 정적 자원(SPA). /assets/* → dist 파일, 그 외 → index.html.
			const filePath = safeJoin(viewerDistDir, url);
			const fallback = join(viewerDistDir, "index.html");
			const target =
				filePath && (await canRead(filePath)) ? filePath : fallback;
			if (!(await canRead(target))) {
				res.writeHead(404);
				res.end("not found");
				return;
			}
			const data = await readFile(target);
			const ext = target.slice(target.lastIndexOf("."));
			res.writeHead(200, {
				"Content-Type": MIME[ext] ?? "application/octet-stream",
			});
			res.end(data);
		} catch {
			res.writeHead(500);
			res.end("server error");
		}
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const addr = server.address();
	const port = typeof addr === "object" && addr ? addr.port : 0;
	const url = `http://127.0.0.1:${port}`;
	if (open) openBrowser(url);
	onReady?.(url);

	const onAbort = () => {
		settle({
			verdict: "modify",
			comments: [{ text: "(게이트 중단됨)" }],
		});
	};
	signal?.addEventListener("abort", onAbort, { once: true });

	// #4 게이트 타임아웃: 사용자 결정 없이 만료 시 자동 modify 복귀(좀비 게이트 방지).
	const timer =
		timeoutMs > 0
			? setTimeout(() => {
					settle({
						verdict: "modify",
						comments: [{ text: "(게이트 시간 초과 — 자동 복귀)" }],
					});
				}, timeoutMs)
			: null;

	const result = await decided;
	signal?.removeEventListener("abort", onAbort);
	if (timer) clearTimeout(timer);
	// 클라이언트가 최종 응답 바이트를 읽어가도록 잠시 대기 후 종료.
	// ponytail: 30ms flush 여유 — 크로즈 전 응답 잘림 방지. 게이트 종료 지연 무시 가능.
	await new Promise((r) => setTimeout(r, 30));
	server.closeAllConnections?.();
	server.close();
	return result;
}

async function canRead(path: string): Promise<boolean> {
	try {
		await readFile(path);
		return true;
	} catch {
		return false;
	}
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		req.on("data", (chunk: Buffer) => {
			data += chunk.toString();
		});
		req.on("end", () => resolve(data));
		req.on("error", reject);
	});
}

/** 뷰어 dist 디렉토리 후보를 순서대로 탐색. */
export function resolveViewerDist(candidates: string[]): string | null {
	// 동기 존재 여부는 호출측에서 비동기로 확인; 여기선 후보만 정리.
	for (const c of candidates) {
		if (c) return c;
	}
	return null;
}

/** ESM 모듈 경로에서 디렉토리 추출(jiti 환경에서 import.meta.url 사용). */
export function moduleDir(importMetaUrl: string): string {
	return join(fileURLToPath(importMetaUrl), "..");
}
