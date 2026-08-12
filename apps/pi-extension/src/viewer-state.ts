// 뷰어 대시보드 상태 조립 — /api/state 가 서빙하는 페이로드.
// 회귀 정합성(#1): state.stage 이후 단계의 (무효한) 산출물은 숨긴다. 계층 그래프 트리(ADR-018) 조립 포함.
import {
	STAGES,
	graphDirNameFor,
	graphRefFiles,
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
		/** md 의 `<!-- graph: ... -->` 참조들이 가리키는 계층 그래프 트리들(ADR-018·020). 없으면 미포함. */
		graphs?: { file: string; tree: GraphLevel }[];
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
		// 계층 그래프 트리: 참조마다 루트 json + 서브디렉터리 자식 파일들을 조립해 서빙(ADR-018·020).
		// 그래프는 승격 시 stageN/ 에 에이전트 이름 그대로 저장됨 — 단계 접두로 읽기(ADR-020).
		const graphs: { file: string; tree: GraphLevel }[] = [];
		for (const ref of graphRefFiles(raw)) {
			const staged = `stage${s.id}/${ref}`;
			const rootRaw = await readArtifact(root, feature, staged).catch(
				() => undefined,
			);
			if (rootRaw === undefined) continue;
			const refDir = graphDirNameFor(ref);
			const tree = await loadGraphTree(rootRaw, ref, async (rel) => {
				const r = await readArtifact(
					root,
					feature,
					`stage${s.id}/${refDir}/${rel}`,
				);
				return r ?? null;
			});
			if (tree) graphs.push({ file: ref, tree });
		}
		artifacts.push({
			stage: s.id,
			name: s.name,
			file: s.artifactFile,
			format: s.format,
			md: raw,
			...(graphs.length > 0 ? { graphs } : {}),
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
