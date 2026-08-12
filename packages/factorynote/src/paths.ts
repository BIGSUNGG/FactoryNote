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

/** STAGES 에 등록된 단계 산출물 파일명 → stageN/ 서브폴더.
 * `stageN/` 접두 경로는 그대로 통과 — 그래프 등 동반 파일은 이름에서 단계를 추론하지 않고
 * 호출측이 단계 접두를 붙여 명시 전달(ADR-020 에이전트 자유 네이밍). 그 외(보조 파일·draft)는 feature 루트. */
function stageSubdir(file: string): string {
	if (/^stage\d+\//.test(file)) return "";
	const stage = STAGES.find((s) => s.artifactFile === file);
	if (stage) return `stage${stage.id}`;
	return "";
}

export function artifactPath(
	root: string,
	feature: string,
	file: string,
): string {
	return join(featureDir(root, feature), stageSubdir(file), file);
}
