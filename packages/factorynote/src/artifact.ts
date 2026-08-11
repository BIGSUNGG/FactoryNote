// 단계 산출물(마크다운·그래프 트리) 저장/읽기/승격/무효화 — NFR-2 신뢰성 담당.
// harness-agnostic: 경로를 인자로 받는다(pi 의존 0). node:fs/promises 만 사용.
import { dirname, join } from "node:path";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import {
	collectGraphChildFiles,
	graphDirNameFor,
	graphJsonNameFor,
} from "./graph.ts";
import { artifactPath, featureDir } from "./paths.ts";
import { STAGES } from "./stages.ts";
import type { ValidThrough } from "./types/index.ts";

async function ensureDir(dir: string): Promise<void> {
	await mkdir(dir, { recursive: true });
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
