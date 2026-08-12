// Design/Feedback 자식 과제(프롬프트) 구성 — 파일 프로토콜(paths) 또는 인라인 모드.
import type { ArtifactPaths } from "./types/index.ts";
import type { StageDefinition } from "./stages.ts";
import type { FeedbackAgent } from "./feedback-agents.ts";

/** 단계별 그래프 지시 문구 — Stage 1 없음 · Stage 2 필수(코드 강제) · Stage 3 선택. */
function graphLine(def: StageDefinition): string {
	if (def.graph === "required")
		return "계층 그래프 파일 트리는 **필수**: 작성 지시대로 루트 json + 자식 파일 서브디렉터리를 draft 와 같은 폴더에 저장(예: draft-graph.json + draft-graph/)하고 md 앞에 `<!-- graph: draft-graph.json -->` 참조 코멘트를 둔다. 그래프가 없거나 불량하면 이 산출물은 자동 반려된다.";
	if (def.graph === "optional")
		return "그래프를 동반하면(선택) draft 와 같은 폴더에 계층 트리(루트 json + 자식 파일 서브디렉터리, 예: draft-graph.json + draft-graph/)로 저장하고 md 앞에 `<!-- graph: <루트 json 파일명> -->` 참조 코멘트를 둔다.";
	return "";
}

/** Design 첫 산출물 과제. paths 제공 시 designPrompt 파일 참조 + draft 파일 쓰기 지시. */
export function designTask(
	def: StageDefinition,
	paths?: ArtifactPaths,
): string {
	if (paths) {
		const graph = graphLine(def);
		return [
			`${def.artifact} 산출물을 작성하라. 작성 지시는 파일 ${paths.designPrompt} 에 있다(불변) — 읽어 따른다.`,
			`작성한 산출물은 파일 ${paths.draft} 에 저장한다.${graph ? ` ${graph}` : ""} 반환은 draft 파일 경로만(본문 절대 금지) - 본문을 반환하면 Director 컨텍스트가 부풋어 한도 초과(1261) 한다.`,
			"코드는 쓰지 않는다(계획 산출물).",
		].join("\n");
	}
	return def.designPrompt;
}

/** 한 에이전트의 Feedback 과제(동기 harness용 — pi Director 는 메뉴를 보고 직접 과제 구성). */
export function feedbackAgentTask(
	def: StageDefinition,
	agent: FeedbackAgent,
	draft: string,
	paths?: ArtifactPaths,
): string {
	if (paths) {
		return [
			`검토 대상 ${def.artifact} 산출물은 파일 ${paths.draft} 에 있다 — 읽고 **${agent.focus} 관점**에서 비판 검토하라. md 에 \`<!-- graph: <파일명> -->\` 참조가 있으면 같은 폴더의 계층 그래프 트리(루트 json + 서브디렉터리 자식 파일들)도 읽어 구조를 함께 검토한다.`,
			`판정은 첫 줄에 "CLEAN"(이슈 없음) 또는 "ISSUES"(이후 줄에 각 이슈를 - 로 나열, 최대 5개·각 1줄)로만 출력한다.`,
			`상세 리뷰 전문은 파일 ${paths.feedback}.${agent.name} 에 저장하라. 반환은 판정 + 이슈 요약만(본문 금지).`,
		].join("\n");
	}
	return [
		`아래 ${def.artifact} 산출물을 **${agent.focus} 관점**에서 비판적으로 검토하라.`,
		`판정은 첫 줄에 "CLEAN" 또는 "ISSUES"(이후 줄에 각 이슈를 - 로 나열)로만 출력한다.`,
		"",
		"## 검토 대상 산출물",
		draft,
	].join("\n");
}

/** Design 재수정 과제(전 에이전트 이슈 취합 주입). */
export function designRevisionTask(
	def: StageDefinition,
	issues: string[],
	paths?: ArtifactPaths,
): string {
	const block = issues.map((i) => `- ${i}`).join("\n");
	if (paths) {
		const graphNote =
			def.graph === "required"
				? " 동반 계층 그래프 트리(루트 json + 자식 파일들)는 **필수**다 — 변경에 맞춰 일관되게 갱신하고 `<!-- graph: ... -->` 참조를 유지한다."
				: def.graph === "optional"
					? " 그래프 구조를 변경했으면 동반 계층 그래프 트리(루트 json + 자식 파일들)도 일관되게 갱신한다."
					: "";
		return [
			`이전 산출물이 병렬 Feedback 검토에서 반려되었다. 아래 전 에이전트 이슈를 근본적으로 반영해 ${def.artifact} 산출물을 재작성하라(에이전트별로 따로 고치지 말고 하나의 일관된 산출물로 통합).`,
			`상세 리뷰는 반려 이슈의 [에이전트명] 에 해당하는 파일(${paths.feedback}.<name>)들 — 모두 읽어라. 작성 지시는 ${paths.designPrompt}(불변).`,
			"",
			"## 반려 이슈(전 에이전트 취합)",
			block,
			"",
			`재작성 결과는 파일 ${paths.draft} 에 저장하고 반환은 경로만.${graphNote}`,
		].join("\n");
	}
	return [
		`이전 산출물이 병렬 Feedback 검토에서 아래 이슈로 반려되었다. 이슈를 근본적으로 반영해 ${def.artifact} 산출물을 재작성하라.`,
		"",
		"## 반려 이슈",
		block,
		"",
		"## 원래 작성 지시",
		def.designPrompt,
	].join("\n");
}
