// M3 Persistence — 얇은 코드. .factorynote/<feature>/ 의 신뢰성 담당(NFR-2).
// atomic(write-then-rename) 상태 쓰기, 손상 복구, 산출물 마크다운 저장.
// harness-agnostic: 경로를 인자로 받는다(pi 의존 0). node:* builtins만 사용(런타임 npm 의존 0).
//
// 책임별 모듈:
//  - paths.ts    — 한 feature의 파일 경로 계산(.factorynote/<feature>/ 레이아웃)
//  - state.ts    — 파이프라인 영속 상태(atomic 쓰기·손상 복구·마이그레이션)
//  - artifact.ts — 단계 산출물 저장/읽기/그래프 트리 승격/회귀 무효화
export { artifactPath, featureDir, statePath } from "./paths.ts";
export {
	loadState,
	saveState,
} from "./state.ts";
export {
	checkRequiredGraph,
	clearArtifactPrev,
	invalidateArtifactsAfter,
	promoteGraphTree,
	readArtifact,
	readArtifactPrev,
	writeArtifact,
} from "./artifact.ts";
