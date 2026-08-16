// web 역량 feedback 에이전트 정의(5개) — tools: read/write/bash/web_search.
// 단일 진실은 feedback-agents.ts 의 FEEDBACK_AGENTS 조합. 이 파일은 데이터만.
// 타입은 types/feedback.ts 에서 — 이 파일이 레지스트리(feedback-agents.ts)를
// 역참조하면 순환의존이 생긴다(2026-08 하드닝으로 해체됨).
import type { FeedbackAgent } from "./types/feedback.ts";

export const FEEDBACK_AGENTS_WEB: readonly FeedbackAgent[] = [
	{
		name: "feasibility",
		focus: "기술 현실성(선행 기술 검증)",
		checklist: [
			"요구사항/계획이 기술적으로 실현 가능한가? (필요시 web으로 선행 기술 존재 검증)",
		],
		capability: "web",
		stages: [1, 3],
	},
	{
		name: "compliance",
		focus: "규제/컴플라이언스",
		checklist: [
			"관련 규제/컴플라이언스(GDPR 등) 요구사항이 누락되지 않았는가? (필요시 web 확인)",
		],
		capability: "web",
		stages: [1],
	},
	{
		name: "security",
		focus: "보안 설계·위협 모델",
		checklist: [
			"인증/인가/데이터 보호 설계가 적절한가? 알려진 취약 패턴이 없는가? (필요시 web/CVE 확인)",
		],
		capability: "web",
		stages: [2, 3],
	},
	{
		name: "technology-fit",
		focus: "기술 스택 적합·라이브러리",
		checklist: [
			"선택된 기술 스택/라이브러리가 요구사항에 적합한가? (필요시 web 검증)",
		],
		capability: "web",
		stages: [2],
	},
	{
		name: "library-deps",
		focus: "외부 라이브러리 검증(존재/라이선스/호환)",
		checklist: [
			"외부 라이브러리가 존재·호환되고 라이선스가 적절한가? (web 검증)",
		],
		capability: "web",
		stages: [3],
	},
];
