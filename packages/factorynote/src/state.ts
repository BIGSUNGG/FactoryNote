// 파이프라인 영속 상태 — atomic(write-then-rename) 쓰기 + 손상 복구(NFR-2).
// harness-agnostic: 경로를 인자로 받는다(pi 의존 0). node:fs/promises 만 사용.
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { featureDir, statePath } from "./paths.ts";
import { isStageKind, LEGACY_KINDS } from "./stages.ts";
import type { PipelineState, StageKind } from "./types/index.ts";

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
	// 동적 구성 마이그레이션: 구 state.json(stages 누락 = 고정 3단계) → 레거시 3종 구성.
	// stages 가 있어도 미등록 종류 포함 시 손상 취급(복구 경로) — 카탈로그가 단일 진실.
	const rawStages = Array.isArray(o.stages)
		? (o.stages as unknown[])
		: [...LEGACY_KINDS];
	if (
		typeof o.feature !== "string" ||
		typeof stage !== "number" ||
		rawStages.length === 0 ||
		!rawStages.every(isStageKind) ||
		stage < 1 ||
		stage > rawStages.length ||
		!Array.isArray(o.history)
	) {
		throw new Error("invalid state shape");
	}
	// FR-7 마이그레이션: 구 state.json(validThrough 누락·null·NaN 등 비정상) → 0 기본값.
	// typeof==='number' 는 NaN 을 못 걸름 → Number.isFinite 로 전부 가드.
	// Tier 1 마이그레이션: 구 state(dfPhase/dfLoop 누락) → 내부 루프 초기값.
	const validThrough = Number.isFinite(o.validThrough)
		? Math.min(Math.max(o.validThrough as number, 0), rawStages.length)
		: 0;
	const withMigration: Record<string, unknown> = {
		...o,
		stages: rawStages as StageKind[],
		validThrough,
		dfPhase: o.dfPhase === "feedback" ? "feedback" : "design",
		dfLoop: Number.isFinite(o.dfLoop) ? o.dfLoop : 0,
	};
	if (!Number.isFinite(o.maxStages)) delete withMigration.maxStages;
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
