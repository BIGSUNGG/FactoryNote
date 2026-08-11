// M3 Persistence — 얇은 코드. .factorynote/<feature>/ 의 신뢰성 담당(NFR-2).
// atomic(write-then-rename) 상태 쓰기, 손상 복구, 산출물 마크다운 저장.
// harness-agnostic: 경로를 인자로 받는다(pi 의존 0). node:* builtins만 사용(런타임 npm 의존 0).
import {
	readFile,
	writeFile,
	mkdir,
	rename,
	copyFile,
	unlink,
	rm,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	collectGraphChildFiles,
	graphDirNameFor,
	graphJsonNameFor,
} from "./graph.ts";
import { STAGES } from "./stages.ts";
import type { PipelineState, ValidThrough } from "./types.ts";

/** 한 feature의 런타임 디렉토리: <root>/<feature>/ (state.json + 보조 파일; 단계 산출물은 stageN/ 하위). */
export function featureDir(root: string, feature: string): string {
	return join(root, feature);
}

export function statePath(root: string, feature: string): string {
	return join(featureDir(root, feature), "state.json");
}

/** STAGES 에 등록된 단계 산출물 파일명(및 그 동반 그래프 트리) → stageN/ 서브폴더.
 * 그 외(보조 파일)는 feature 루트. 동반 그래프: 루트 `<base>-graph.json` +
 * 자식 파일들이 사는 `<base>-graph/` 디렉터리(ADR-018). */
function stageSubdir(file: string): string {
	const stage = STAGES.find((s) => s.artifactFile === file);
	if (stage) return `stage${stage.id}`;
	if (file.endsWith("-graph.json")) {
		const md = file.slice(0, -"-graph.json".length) + ".md";
		const owner = STAGES.find((s) => s.artifactFile === md);
		if (owner) return `stage${owner.id}`;
	}
	// 그래프 트리 경로: 첫 세그먼트(또는 이름 자체)가 `<산출물 base>-graph` 인 경우.
	const firstSeg = file.split("/")[0]!;
	if (firstSeg.endsWith("-graph")) {
		const md = firstSeg.slice(0, -"-graph".length) + ".md";
		const owner = STAGES.find((s) => s.artifactFile === md);
		if (owner) return `stage${owner.id}`;
	}
	return "";
}

export function artifactPath(
	root: string,
	feature: string,
	file: string,
): string {
	return join(featureDir(root, feature), stageSubdir(file), file);
}

async function ensureDir(dir: string): Promise<void> {
	await mkdir(dir, { recursive: true });
}

/**
 * 상태 로드. 파일 없음 → undefined(신규 파이프라인).
 * 손상(일부 기록/JSON 파싱 실패) → .corrupt-<ts> 백업 후 undefined(복구=NFR-2).
 */
export async function loadState(
	root: string,
	feature: string,
): Promise<PipelineState | undefined> {
	const path = statePath(root, feature);
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw err;
	}
	try {
		const parsed = JSON.parse(raw) as PipelineState;
		return validateState(parsed);
	} catch {
		// 손상 복구: 백업 후 신규 시작. (쓰기 권한 불가 등은 재throw 아님 — best-effort)
		const backup = `${path}.corrupt-${Date.now()}`;
		try {
			await copyFile(path, backup);
		} catch {
			/* 복구 백업 실패는 무시(원본은 그대로) */
		}
		return undefined;
	}
}

function validateState(s: unknown): PipelineState {
	if (typeof s !== "object" || s === null) throw new Error("invalid state");
	const o = s as Record<string, unknown>;
	const stage = o.stage;
	if (
		typeof o.feature !== "string" ||
		typeof stage !== "number" ||
		stage < 1 ||
		stage > 3 ||
		!Array.isArray(o.history)
	) {
		throw new Error("invalid state shape");
	}
	// FR-7 마이그레이션: 구 state.json(validThrough 누락·null·NaN 등 비정상) → 0 기본값.
	// typeof==='number' 는 NaN 을 못 걸름 → Number.isFinite 로 전부 가드.
	// Tier 1 마이그레이션: 구 state(dfPhase/dfLoop 누락) → 내부 루프 초기값.
	const withMigration: Record<string, unknown> = {
		...o,
		validThrough: Number.isFinite(o.validThrough) ? o.validThrough : 0,
		dfPhase: o.dfPhase === "feedback" ? "feedback" : "design",
		dfLoop: Number.isFinite(o.dfLoop) ? o.dfLoop : 0,
	};
	return withMigration as unknown as PipelineState;
}

/** 상태 atomic 쓰기(write-then-rename). 게이트 판정의 권위는 이 파일(NFR-2). */
export async function saveState(
	root: string,
	state: PipelineState,
): Promise<void> {
	const dir = featureDir(root, state.feature);
	await ensureDir(dir);
	const target = statePath(root, state.feature);
	const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
	const payload = JSON.stringify(state, null, 2);
	await writeFile(tmp, payload, "utf8");
	// rename이 atomic(동일 파일시스템 내).
	await rename(tmp, target);
}

/** 단계 산출물(마크다운) 저장. 경로 반환. */
export async function writeArtifact(
	root: string,
	feature: string,
	file: string,
	markdown: string,
): Promise<string> {
	const path = artifactPath(root, feature, file);
	await ensureDir(dirname(path));
	await writeFile(path, markdown, "utf8");
	return path;
}

/** 산출물 읽기(뷰어 서빙용). 없으면 undefined. */
export async function readArtifact(
	root: string,
	feature: string,
	file: string,
): Promise<string | undefined> {
	try {
		return await readFile(artifactPath(root, feature, file), "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw err;
	}
}

/** 게이트 오픈 시 그래프 트리 승격(ADR-018): 루트에서 도달 가능한 파일만
 * 대상(stageN/)으로 복사 — 고아·잔여 파일 자연 제외. 기존 대상 트리는 삭제 후 쓴다.
 * src 루트가 없으면(그래프 없는 산출물) 아무 일도 하지 않는다. */
export async function promoteGraphTree(
	root: string,
	feature: string,
	srcRootFile: string,
	dstRootFile: string,
): Promise<void> {
	const raw = await readArtifact(root, feature, srcRootFile);
	if (raw === undefined) return;
	const srcDir = graphDirNameFor(srcRootFile);
	const dstDir = graphDirNameFor(dstRootFile);
	// 이전 사이클의 낡은 대상 트리 제거(도달 불가 잔여 파일 방지).
	await rm(artifactPath(root, feature, dstDir), {
		recursive: true,
		force: true,
	});
	await writeArtifact(root, feature, dstRootFile, raw);
	const readRel = async (rel: string): Promise<string | null> => {
		const r = await readArtifact(root, feature, `${srcDir}/${rel}`);
		return r ?? null;
	};
	const rels = await collectGraphChildFiles(raw, readRel);
	for (const rel of rels) {
		const content = await readRel(rel);
		if (content !== null) {
			await writeArtifact(root, feature, `${dstDir}/${rel}`, content);
		}
	}
}

/**
 * FR-7: afterStage 이후(id > afterStage) 산출물 best-effort 삭제(ENOENT 무시).
 * 회귀 시 대상 단계(revert target) 이후 산출물 자동 무효화 — 호출측(plan-tool)은
 * applyVerdict 후의 state.stage(=회귀 대상) 를 전달. (validThrough 아님 — 코드-주석 일치.)
 */
export async function invalidateArtifactsAfter(
	root: string,
	feature: string,
	afterStage: ValidThrough,
): Promise<void> {
	const stale = STAGES.filter(
		(s) => s.artifactFile !== null && s.id > afterStage,
	);
	const ignoreEnoent = (err: unknown) => {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
	};
	await Promise.all(
		stale.flatMap((s) => {
			const md = s.artifactFile as string;
			const json = graphJsonNameFor(md);
			return [
				unlink(artifactPath(root, feature, md)).catch(ignoreEnoent),
				// 동반 그래프 트리(루트 json + 자식 디렉터리)도 함께 무효화(ADR-018).
				unlink(artifactPath(root, feature, json)).catch(ignoreEnoent),
				rm(artifactPath(root, feature, graphDirNameFor(json)), {
					recursive: true,
					force: true,
				}).catch(ignoreEnoent),
			];
		}),
	);
}
