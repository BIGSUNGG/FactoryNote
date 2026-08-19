// 단계 산출물(마크다운·그래프 트리) 저장/읽기/승격/무효화 — NFR-2 신뢰성 담당.
// harness-agnostic: 경로를 인자로 받는다(pi 의존 0). node:fs/promises 만 사용.
import { dirname } from "node:path";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import {
	collectGraphChildFiles,
	graphDirNameFor,
	graphRefAttemptCount,
	graphRefFiles,
	parseAnyGraphKind,
} from "./graph.ts";
import { designMenuForStage } from "./design-agents.ts";
import { artifactPath } from "./paths.ts";
import type { StageDefinition } from "./stages.ts";
import type { ValidThrough } from "./types/index.ts";

async function ensureDir(dir: string): Promise<void> {
	await mkdir(dir, { recursive: true });
}

/** 단계 산출물(md 문서) 파일명인가 — 변경 하이라이트(ADR-027) prev 스냅샷 대상 판정.
 * 산출물 파일명 규약 `<위치 2자리>-<이름>.md`(동적 구성·레거시 동일). 그래프 json·보조 파일은 제외. */
function isStageArtifactFile(file: string): boolean {
	return /^\d{2}-[\w-]+\.md$/.test(file);
}

const ignoreEnoent = (err: unknown): void => {
	if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
};

/** 단계 산출물(마크다운) 저장. 경로 반환.
 * 단계 산출물 덮어쓰기 시 직전 버전을 `<파일>.prev` 로 스냅샷(ADR-027 변경 하이라이트
 * 기준) — 뷰어가 prev↔현재 블록 diff 로 수정 부분을 표시한다. 게이트 확정 시 삭제. */
export async function writeArtifact(
	root: string,
	feature: string,
	file: string,
	markdown: string,
): Promise<string> {
	const path = artifactPath(root, feature, file);
	await ensureDir(dirname(path));
	if (isStageArtifactFile(file)) {
		try {
			const prev = await readFile(path, "utf8");
			await writeFile(`${path}.prev`, prev, "utf8");
		} catch (err) {
			ignoreEnoent(err); // 최초 작성 — prev 없음(뷰어는 하이라이트 생략)
		}
	}
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

/** 단계 산출물의 직전 버전(.prev) 읽기(ADR-027 변경 하이라이트). 없으면 undefined.
 * artifactPath 에 `.prev` 를 붙인 실제 경로 사용 — 파일명 기반 단계 추론 우회. */
export async function readArtifactPrev(
	root: string,
	feature: string,
	file: string,
): Promise<string | undefined> {
	try {
		return await readFile(`${artifactPath(root, feature, file)}.prev`, "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw err;
	}
}

/** 단계 산출물의 .prev 삭제(ADR-027) — 게이트 확정 시 하이라이트 기준 리셋.
 * ENOENT 무시(이미 없음). */
export async function clearArtifactPrev(
	root: string,
	feature: string,
	file: string,
): Promise<void> {
	await unlink(`${artifactPath(root, feature, file)}.prev`).catch(ignoreEnoent);
}

/** 게이트 오픈 시 그래프 트리 승격(ADR-018): 루트에서 도달 가능한 파일만
 * 대상(stageN/)으로 복사 — 고아·잔여 파일 자연 제외. 기존 대상 트리는 삭제 후 쓴다.
 * 먼저 전체 내용을 메모리에 수집하고 나서 대상 디렉터리를 지우고 쓴다 — src·dst 동일 안전.
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
	const readRel = async (rel: string): Promise<string | null> => {
		const r = await readArtifact(root, feature, `${srcDir}/${rel}`);
		return r ?? null;
	};
	// 쓰기 전 도달 가능한 자식 내용 전체 수집(rm 이후에도 src 읽기 가능해야 해서).
	const rels = await collectGraphChildFiles(raw, readRel);
	const contents: [string, string][] = [];
	for (const rel of rels) {
		const content = await readRel(rel);
		if (content !== null) contents.push([rel, content]);
	}
	// 이전 사이클의 낡은 대상 트리 제거(도달 불가 잔여 파일 방지).
	await rm(artifactPath(root, feature, dstDir), {
		recursive: true,
		force: true,
	});
	await writeArtifact(root, feature, dstRootFile, raw);
	for (const [rel, content] of contents) {
		await writeArtifact(root, feature, `${dstDir}/${rel}`, content);
	}
}

/** 그래프 필수 단계(Stage 2) 산출물 검증 — md 참조 코멘트 1개 이상(ADR-020 다중 허용) +
 * 각 루트 json 존재·version:2 파싱·이름 유일. 미충족 시 이슈 문자열(재작성 지시용), 충족 시 null. */
export async function checkRequiredGraph(
	root: string,
	feature: string,
	mdFile: string,
): Promise<string | null> {
	const md = await readArtifact(root, feature, mdFile);
	if (md === undefined) return "draft 산출물 파일이 없다";
	const refs = graphRefFiles(md);
	if (refs.length === 0) {
		// 참조 시도는 있으나 규약 위반(예: 경로 포함·.json 아님) — 원인 구분 메시지.
		if (graphRefAttemptCount(md) > 0)
			return "`<!-- graph: ... -->` 참조 코멘트가 규약과 다르다 — 루트 json **파일명만** 허용한다(경로·폴더 구분자 금지, `.json`으로 끝나야 함, 예: `<!-- graph: module-deps.json -->`)";
		return "md 에 `<!-- graph: <루트 json 파일명> -->` 참조 코멘트가 없다 — 이 단계는 계층 그래프 트리가 필수다";
	}
	const seen = new Set<string>();
	for (const ref of refs) {
		if (seen.has(ref))
			return `그래프 이름(${ref})이 중복된다 — 그래프마다 유일한 이름을 지어라`;
		seen.add(ref);
		const raw = await readArtifact(root, feature, ref);
		if (raw === undefined)
			return `참조 그래프 파일(${ref})이 없다 — 루트 json 을 draft 와 같은 폴더에 저장하라`;
		if (!parseAnyGraphKind(raw))
			return `참조 그래프 파일(${ref})이 유효한 그래프 파일이 아니다 — envelope 규약을 확인하라(계층 트리·sequence·flowchart)`;
	}
	return null;
}

/**
 * FR-7: afterStage 이후(id > afterStage) 산출물 best-effort 삭제(ENOENT 무시).
 * 회귀 시 대상 단계(revert target) 이후 산출물 자동 무효화 — 호출측(plan-gate)은
 * applyVerdict 후의 state.stage(=회귀 대상) 와 현 구성의 단계 인스턴스를 전달.
 */
export async function invalidateArtifactsAfter(
	root: string,
	feature: string,
	afterStage: ValidThrough,
	defs: readonly StageDefinition[],
): Promise<void> {
	const stale = defs.filter(
		(s) => s.artifactFile !== null && s.id > afterStage,
	);
	for (const s of stale) {
		const md = s.artifactFile as string;
		// 무효화 전 md 를 읽어 그래프 이름(에이전트 자유 네이밍) 수집 — 이름 추론 불가(ADR-020).
		let raw: string | undefined;
		try {
			raw = await readArtifact(root, feature, md);
		} catch {
			raw = undefined;
		}
		const refs = raw !== undefined ? graphRefFiles(raw) : [];
		const targets: Promise<void>[] = [
			unlink(artifactPath(root, feature, md)).catch(ignoreEnoent),
			// 동반 .prev(변경 하이라이트 기준, ADR-027) 도 함께 무효화.
			unlink(`${artifactPath(root, feature, md)}.prev`).catch(ignoreEnoent),
		];
		// 위성 design 문서(draft.<role>.md, ADR-031) 도 단계 무효화에 포함 —
		// 이름은 designMenuForStage(단계별 역할 메뉴) 로 결정론적으로 구한다.
		for (const role of designMenuForStage(s.id)) {
			targets.push(
				unlink(artifactPath(root, feature, `draft.${role.name}.md`)).catch(
					ignoreEnoent,
				),
			);
		}
		for (const ref of refs) {
			targets.push(
				// 동반 그래프 트리(루트 json + 자식 디렉터리) 무효화(ADR-018).
				unlink(artifactPath(root, feature, `stage${s.id}/${ref}`)).catch(
					ignoreEnoent,
				),
				rm(
					artifactPath(root, feature, `stage${s.id}/${graphDirNameFor(ref)}`),
					{ recursive: true, force: true },
				).catch(() => {}),
			);
		}
		await Promise.all(targets);
	}
}
