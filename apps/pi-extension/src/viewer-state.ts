// 뷰어 대시보드 상태 조립 — /api/state 가 서빙하는 페이로드.
// 회귀 정합성(#1): state.stage 이후 단계의 (무효한) 산출물은 숨긴다. 계층 그래프 트리(ADR-018) 조립 포함.
import {
	STAGES,
	graphDirNameFor,
	graphRefFile,
	loadGraphTree,
	loadState,
	readArtifact,
} from "@factorynote/core";
import type { ArtifactFormat, GraphLevel } from "@factorynote/core";

export interface ViewerState {
	feature: string;
	stage: number;
	stageName: string;
	requiresArtifact: boolean;
	done: boolean;
	/** 현 단계 산출물이 사용자 검토 대기 중인지(에이전트가 게이트를 열었는지). 뷰어 폴링 신호. */
	gateOpen: boolean;
	designPrompt: string;
	artifacts: {
		stage: number;
		name: string;
		file: string;
		format: ArtifactFormat;
		md?: string;
		/** md 의 `<!-- graph: ... -->` 참조가 가리키는 계층 그래프 트리(ADR-018). 없으면 미포함. */
		graph?: { file: string; tree: GraphLevel };
	}[];
}

export async function buildViewerState(
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
		// 계층 그래프 트리: 루트 json + 서브디렉터리 자식 파일들을 조립해 서빙(ADR-018).
		const ref = graphRefFile(raw);
		let tree: GraphLevel | null = null;
		if (ref) {
			const rootRaw = await readArtifact(root, feature, ref).catch(
				() => undefined,
			);
			if (rootRaw !== undefined) {
				const refDir = graphDirNameFor(ref);
				tree = await loadGraphTree(rootRaw, ref, async (rel) => {
					const r = await readArtifact(root, feature, `${refDir}/${rel}`);
					return r ?? null;
				});
			}
		}
		artifacts.push({
			stage: s.id,
			name: s.name,
			file: s.artifactFile,
			format: s.format,
			md: raw,
			...(ref && tree ? { graph: { file: ref, tree } } : {}),
		});
	}
	return {
		feature,
		stage,
		stageName: def.name,
		requiresArtifact: def.producesArtifact,
		done: state?.done ?? false,
		gateOpen: state?.gateOpen ?? false,
		designPrompt: def.designPrompt,
		artifacts,
	};
}
