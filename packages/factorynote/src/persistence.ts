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
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { STAGES } from "./stages.ts";
import type { PipelineState, ValidThrough } from "./types.ts";

/** 한 feature의 런타임 디렉토리: <root>/<feature>/ (state.json + 보조 파일; 단계 산출물은 stageN/ 하위). */
export function featureDir(root: string, feature: string): string {
	return join(root, feature);
}

export function statePath(root: string, feature: string): string {
	return join(featureDir(root, feature), "state.json");
}

/** STAGES 에 등록된 단계 산출물 파일명 → stageN/ 서브폴더. 그 외(보조 파일)는 feature 루트. */
function stageSubdir(file: string): string {
	const stage = STAGES.find((s) => s.artifactFile === file);
	return stage ? `stage${stage.id}` : "";
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
	await Promise.all(
		stale.map((s) =>
			unlink(artifactPath(root, feature, s.artifactFile as string)).catch(
				(err) => {
					if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
				},
			),
		),
	);
}
