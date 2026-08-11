// ADR-014 동적 feedback 에이전트 — 전역 레지스트리(단일 진실).
// Director 가 매 사이클마다 현 단계 필터 메뉴에서 상황에 맞는 N개를 추려 병렬 스폰한다.
// 역량 태그 capability 가 에이전트 파일의 tools allowlist 를 결정(생성기가 반영):
//   static = read/write/bash · web = +web_search · graph = +edit(그래프 fence 구조 수정)
// 이 파일이 레지스트리 단일 진실; apps/pi-extension/agents/factorynote-feedback-<name>.md 는 생성기 산출물.
import type { StageId } from "./types/index.ts";
import { FEEDBACK_AGENTS_GRAPH } from "./feedback-agents-graph.ts";
import { FEEDBACK_AGENTS_STATIC } from "./feedback-agents-static.ts";
import { FEEDBACK_AGENTS_WEB } from "./feedback-agents-web.ts";

/** feedback 에이전트 역량(도구 티어). */
export type FeedbackCapability = "static" | "web" | "graph";

/**
 * 전문 feedback 에이전트 정의. name → factorynote-feedback-<name>.md 와 1:1.
 * Director 가 stages(적용 단계)로 필터링된 메뉴에서 focus·checklist 를 보고 선택한다.
 */
export interface FeedbackAgent {
	/** 에이전트 슬러그 → factorynote-feedback-<name>.md. */
	name: string;
	/** 무엇을 검토하는지(메뉴 표시 + 에이전트 프롬프트 주입). */
	focus: string;
	/** 검토 체크리스트. */
	checklist: string[];
	/** 도구 티어 — 에이전트 파일 tools allowlist 결정. */
	capability: FeedbackCapability;
	/** 적용 단계(1=요구사항·2=설계·3=구현계획). 빈 배열이면 전 단계. */
	stages: StageId[];
}

/** 도구 티어 → tools allowlist (에이전트 파일 생성기가 사용). */
export const FEEDBACK_TOOLS: Readonly<Record<FeedbackCapability, string>> =
	Object.freeze({
		static: "read, write, bash",
		web: "read, write, bash, web_search",
		graph: "read, write, bash, edit",
	});

/**
 * 전문 feedback 에이전트 전체 목록(중복 제거 ~32개).
 * static 24 · web 5(feasibility/compliance/security/technology-fit/library-deps) · graph 3(structure/dependency-cycle/dependency-precedence).
 * 데이터는 역량별 파일: feedback-agents-static.ts · -web.ts · -graph.ts.
 */
export const FEEDBACK_AGENTS: readonly FeedbackAgent[] = [
	...FEEDBACK_AGENTS_STATIC,
	...FEEDBACK_AGENTS_WEB,
	...FEEDBACK_AGENTS_GRAPH,
];

/** 단계 필터 메뉴 — Director 가 여기서 상황에 맞는 N개를 추려 병렬 스폰. */
export function feedbackMenuForStage(stage: StageId): FeedbackAgent[] {
	return FEEDBACK_AGENTS.filter((a) => a.stages.includes(stage));
}
