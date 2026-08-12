// graph 역량 feedback 에이전트 정의(3개) — tools: read/write/bash/edit(그래프 fence 구조 수정).
// 단일 진실은 feedback-agents.ts 의 FEEDBACK_AGENTS 조합. 이 파일은 데이터만.
import type { FeedbackAgent } from "./feedback-agents.ts";

export const FEEDBACK_AGENTS_GRAPH: readonly FeedbackAgent[] = [
	{
		name: "structure",
		focus: "그래프 파일 유효·참조 규칙·정합",
		checklist: [
			'md 의 `<!-- graph: ... -->` 참조가 가리키는 그래프 파일이 종류별 envelope 에 유효한가? — 계층 트리(type 없음): version:2, refs 는 {to, comment} 나가는 방향만 소스 파일에, children 경로가 실제 파일과 일치 · sequence(type:"sequence"): participants id 유일, 메시지/fragment 가 존재 참여자 참조, fragment kind 는 alt|loop|opt 만 · flowchart(type:"flowchart"): nodes id 유일·label 필수, edges 가 존재 노드 참조, shape 는 terminal|process|decision 만. 공통: position 등 좌표 필드 없음, 구조-설명 정합.',
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
