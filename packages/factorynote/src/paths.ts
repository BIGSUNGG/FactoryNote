// 한 feature의 파일 경로 계산 — .factorynote/<feature>/ 레이아웃.
// harness-agnostic: 경로를 인자로 받는다(pi 의존 0). node:path 만 사용.
import { join } from "node:path";

/** 한 feature의 런타임 디렉토리: <root>/<feature>/ (state.json + 보조 파일; 단계 산출물은 stageN/ 하위). */
export function featureDir(root: string, feature: string): string {
	return join(root, feature);
}

export function statePath(root: string, feature: string): string {
	return join(featureDir(root, feature), "state.json");
}

/** 단계 산출물 파일명 → stageN/ 서브폴더. 산출물 파일명은 `<위치 2자리>-<이름>.md` 규약이라
 * 위치를 파일명에서 직접 추론(구성 독립 — 동적 구성·레거시 동일). `stageN/` 접두 경로는
 * 그대로 통과(그래프 등 동반 파일, ADR-020). 그 외(보조 파일·draft)는 feature 루트. */
function stageSubdir(file: string): string {
	if (/^stage\d+\//.test(file)) return "";
	const m = /^(\d{2})-/.exec(file);
	if (m) return `stage${Number(m[1])}`;
	return "";
}

export function artifactPath(
	root: string,
	feature: string,
	file: string,
): string {
	return join(featureDir(root, feature), stageSubdir(file), file);
}
