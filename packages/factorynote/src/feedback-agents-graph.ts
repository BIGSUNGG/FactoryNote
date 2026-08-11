// graph 역량 feedback 에이전트 정의(3개) — tools: read/write/bash/edit(그래프 fence 구조 수정).
// 단일 진실은 feedback-agents.ts 의 FEEDBACK_AGENTS 조합. 이 파일은 데이터만.
import type { FeedbackAgent } from "./feedback-agents.ts";

export const FEEDBACK_AGENTS_GRAPH: readonly FeedbackAgent[] = [
	{
		name: "structure",
		focus: "계층 그래프 트리 유효·참조 규칙·정합",
		checklist: [
			"md 의 `<!-- graph: ... -->` 참조가 가리키는 계층 그래프 트리(루트 json + 자식 파일 서브디렉터리)가 유효한가? — version:2, refs 는 {to, comment} 나가는 방향만 소스 파일에, children 경로가 실제 파일과 일치, position 등 좌표 필드 없음, 구조-설명 정합.",
		],
		capability: "graph",
		stages: [2],
	},
	{
		name: "dependency-cycle",
		focus: "순환 의존",
		checklist: ["의존 그래프에 순환이 없는가?"],
		capability: "graph",
		stages: [2],
	},
	{
		name: "dependency-precedence",
		focus: "선행 작업·의존 그래프",
		checklist: ["구현 의존 그래프에서 선행 작업 누락·역행이 없는가?"],
		capability: "graph",
		stages: [3],
	},
];
