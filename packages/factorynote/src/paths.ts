// 한 feature의 파일 경로 계산 — .factorynote/<feature>/ 레이아웃.
// harness-agnostic: 경로를 인자로 받는다(pi 의존 0). node:path 만 사용.
import { join } from "node:path";
import { STAGES } from "./stages.ts";

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
