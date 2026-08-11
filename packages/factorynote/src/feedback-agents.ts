// ADR-014 동적 feedback 에이전트 — 전역 레지스트리(단일 진실).
// Director 가 매 사이클마다 현 단계 필터 메뉴에서 상황에 맞는 N개를 추려 병렬 스폰한다.
// 역량 태그 capability 가 에이전트 파일의 tools allowlist 를 결정(생성기가 반영):
//   static = read/write/bash · web = +web_search · graph = +edit(그래프 fence 구조 수정)
// 이 파일이 레지스트리 단일 진실; apps/pi-extension/agents/factorynote-feedback-<name>.md 는 생성기 산출물.
import type { StageId } from "./types.ts";

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
 */
export const FEEDBACK_AGENTS: readonly FeedbackAgent[] = [
	// --- static (read/write/bash) ---
	{
		name: "completeness",
		focus: "누락·범위·숨겨진 가정",
		checklist: [
			"요구사항/작업이 누락 없이 망라되었는가?",
			"범위 밖·숨겨진 가정이 명시되었는가?",
		],
		capability: "static",
		stages: [1, 2, 3],
	},
	{
		name: "clarity",
		focus: "모호함·주관적 표현",
		checklist: ["모호한 단어·해석 여지·주관적 표현이 없는가?"],
		capability: "static",
		stages: [1],
	},
	{
		name: "traceability",
		focus: "시나리오↔요구사항 연결",
		checklist: [
			"각 시나리오가 승인된 요구사항에 연결되며 정상 경로가 빠짐없이 covered되는가?",
		],
		capability: "static",
		stages: [1],
	},
	{
		name: "consistency",
		focus: "요구사항 간 충돌/모순",
		checklist: ["요구사항/명세 간 충돌·모순이 없는가?"],
		capability: "static",
		stages: [1],
	},
	{
		name: "measurability",
		focus: "검증가능·측정가능 acceptance",
		checklist: ["각 요구사항이 검증 가능한 acceptance 기준을 갖는가?"],
		capability: "static",
		stages: [1],
	},
	{
		name: "scope-boundaries",
		focus: "비범위 명시·범위 확장 억제",
		checklist: ["명시적 비범위(out of scope)가 있고 범위 확장이 억제되었는가?"],
		capability: "static",
		stages: [1],
	},
	{
		name: "edge-error-scenarios",
		focus: "예외/오류/경계 시나리오",
		checklist: ["예외·오류·경계(빈 입력·실패·중복) 시나리오가 covered되는가?"],
		capability: "static",
		stages: [1],
	},
	{
		name: "nonfunctional",
		focus: "NFR(성능/접근성/보안) 명시",
		checklist: ["비기능 요구사항(성능·접근성·보안 등)이 명시되었는가?"],
		capability: "static",
		stages: [1],
	},
	{
		name: "user-value",
		focus: "사용자 가치·MVP 적합성",
		checklist: ["사용자 가치가 명확하고 MVP 범위로 적합한가?"],
		capability: "static",
		stages: [1],
	},
	{
		name: "extensibility",
		focus: "확장 포인트·확장성 영향",
		checklist: [
			"미래 확장 포인트와 확장성·유지보수 영향이 참고용으로 명시되었는가?",
		],
		capability: "static",
		stages: [1, 2],
	},
	{
		name: "cohesion-coupling",
		focus: "응집/결합·단일 책임",
		checklist: ["모듈/클래스가 단일 책임이고 응집되며 결합이 최소인가?"],
		capability: "static",
		stages: [2],
	},
	{
		name: "layering-architecture",
		focus: "계층 분리·의존 방향",
		checklist: ["계층 분리·의존 방향·아키텍처 패턴이 적합한가?"],
		capability: "static",
		stages: [2],
	},
	{
		name: "oo-principles",
		focus: "SOLID·과잉 추상화",
		checklist: ["객체지향 원칙에 부합하고 과잉 추상화가 없는가?"],
		capability: "static",
		stages: [2],
	},
	{
		name: "scalability-performance",
		focus: "병목·확장성·성능 설계",
		checklist: ["병목·확장성·성능 설계가 적절한가?"],
		capability: "static",
		stages: [2],
	},
	{
		name: "data-model",
		focus: "데이터/상태 모델",
		checklist: ["데이터/상태 모델이 명확하고 상태 변경 경로가 명확한가?"],
		capability: "static",
		stages: [2],
	},
	{
		name: "api-surface",
		focus: "공용 API·인터페이스",
		checklist: ["공용 API가 최소이고 인터페이스 설계가 적절한가?"],
		capability: "static",
		stages: [2],
	},
	{
		name: "testability",
		focus: "테스트 용이 설계",
		checklist: ["테스트하기 쉬운 구조(seam/의존 주입)인가?"],
		capability: "static",
		stages: [2],
	},
	{
		name: "correctness-order",
		focus: "구현 순서·의존성 존중",
		checklist: ["구현 순서가 의존성을 존중하는가?"],
		capability: "static",
		stages: [3],
	},
	{
		name: "integration-seams",
		focus: "통합 지점·인터페이스 계약",
		checklist: ["통합 지점·인터페이스 계약이 명시되었는가?"],
		capability: "static",
		stages: [3],
	},
	{
		name: "verifiability-milestones",
		focus: "마일스톤 검증 가능",
		checklist: ["각 마일스톤이 검증 가능한 acceptance를 갖는가?"],
		capability: "static",
		stages: [3],
	},
	{
		name: "effort-estimation",
		focus: "작업량 추정 현실성",
		checklist: ["작업량 추정이 현실적이고 병목 작업이 식별되었는가?"],
		capability: "static",
		stages: [3],
	},
	{
		name: "rollback-reversibility",
		focus: "롤백/되돌리기 비용",
		checklist: ["롤백/되돌리기 비용·가능성이 고려되었는가?"],
		capability: "static",
		stages: [3],
	},
	{
		name: "cicd-deployment",
		focus: "CI/CD·배포·환경",
		checklist: ["CI/CD·환경·배포 고려가 포함되었는가?"],
		capability: "static",
		stages: [3],
	},
	{
		name: "observability",
		focus: "로깅/모니터링/디버깅",
		checklist: ["로깅·모니터링·디버깅 고려가 포함되었는가?"],
		capability: "static",
		stages: [3],
	},
	// --- web (+web_search) ---
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
	// --- graph (그래프 JSON 파일 구조 검토) ---
	{
		name: "structure",
		focus: "그래프 JSON 유효·그룹 소속·정합",
		checklist: [
			"md 의 `<!-- graph: ... -->` 참조가 가리키는 그래프 JSON 이 유효하고(position 등 좌표 필드 없이), 모든 클래스가 모듈 그룹에 속하며 구조-설명이 정합한가?",
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

/** 단계 필터 메뉴 — Director 가 여기서 상황에 맞는 N개를 추려 병렬 스폰. */
export function feedbackMenuForStage(stage: StageId): FeedbackAgent[] {
	return FEEDBACK_AGENTS.filter((a) => a.stages.includes(stage));
}
