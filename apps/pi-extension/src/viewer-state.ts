// 뷰어 대시보드 상태 조립 — /api/state 가 서빙하는 페이로드.
// 회귀 정합성(#1): state.stage 이후 단계의 (무효한) 산출물은 숨긴다. 계층 그래프 트리(ADR-018) 조립 포함.
import {
	STAGES,
	graphDirNameFor,
	graphRefFiles,
	loadGraphTree,
	loadState,
	parseGraphFlowchartFile,
	parseGraphSequenceFile,
	readArtifact,
	readArtifactPrev,
	stageById,
} from "@factorynote/core";
import type {
	ArtifactFormat,
	GraphFlowchartFile,
	GraphKind,
	GraphLevel,
	GraphSequenceFile,
} from "@factorynote/core";

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
		/** 직전 버전 md(ADR-027 변경 하이라이트 기준). 게이트 중 재작성된 산출물에만 존재 —
		 * 확정 시 서버가 삭제하므로 승인된 단계에는 없다. 뷰어는 md↔prevMd 블록 diff. */
		prevMd?: string;
		/** md 의 `<!-- graph: ... -->` 참조들이 가리키는 그래프들(ADR-018·020·021). 없으면 미포함.
		 * type: tree = 중첩 조립 트리, sequence·flowchart = 단일 파일 데이터. */
		graphs?: {
			file: string;
			type: GraphKind;
			data: GraphLevel | GraphSequenceFile | GraphFlowchartFile;
		}[];
	}[];
}

export async function buildViewerState(
	root: string,
	feature: string,
): Promise<ViewerState> {
	const state = (await loadState(root, feature)) ?? null;
	const stage = state?.stage ?? 1;
	const def = stageById(stage as 1 | 2 | 3);
	const artifacts: ViewerState["artifacts"] = [];
	for (const s of STAGES) {
		if (!s.artifactFile) continue;
		// 회귀 정합성(#1): revert 로 state.stage 가 뒤로 옮겨졌다면 그 이후 단계의
		// (이제 무효한) 산출물은 뷰어에서 숨긴다. state 미지정 시 기존 동작 유지.
		if (state && s.id > state.stage) continue;
		const raw = await readArtifact(root, feature, s.artifactFile);
		if (raw === undefined) continue;
		// 변경 하이라이트 기준(ADR-027): 재작성 전 버전. 없으면(최초 작성·확정 후) 생략.
		const prevRaw = await readArtifactPrev(root, feature, s.artifactFile);
		// 그래프 서빙(ADR-018·020·021): 참조마다 stageN/ 에서 읽어 종류별 파싱·조립.
		// tree 는 자식 파일 트리 조립, sequence·flowchart 는 단일 파일 파싱.
		const graphs: NonNullable<ViewerState["artifacts"][number]["graphs"]> = [];
		for (const ref of graphRefFiles(raw)) {
			const staged = `stage${s.id}/${ref}`;
			let rootRaw: string | undefined;
			try {
				rootRaw = await readArtifact(root, feature, staged);
			} catch {
				rootRaw = undefined;
			}
			if (rootRaw === undefined) continue;
			const seq = parseGraphSequenceFile(rootRaw);
			if (seq) {
				graphs.push({ file: ref, type: "sequence", data: seq });
				continue;
			}
			const flow = parseGraphFlowchartFile(rootRaw);
			if (flow) {
				graphs.push({ file: ref, type: "flowchart", data: flow });
				continue;
			}
			const refDir = graphDirNameFor(ref);
			const tree = await loadGraphTree(rootRaw, ref, async (rel) => {
				const r = await readArtifact(
					root,
					feature,
					`stage${s.id}/${refDir}/${rel}`,
				);
				return r ?? null;
			});
			if (tree) graphs.push({ file: ref, type: "tree", data: tree });
		}
		artifacts.push({
			stage: s.id,
			name: s.name,
			file: s.artifactFile,
			format: s.format,
			md: raw,
			...(prevRaw !== undefined ? { prevMd: prevRaw } : {}),
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
