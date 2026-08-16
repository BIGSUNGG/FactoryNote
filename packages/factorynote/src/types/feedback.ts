// M4/Tier 1 에이전트 오케스트레이션 타입(Design↔Feedback 내부 루프).
// vault/01-architecture/multi-agent-pipeline · ADR(Tier 1) 근거.
// Tier 0(단일 에이전트 인라인 자기검토)는 폐기. 이제 산출물은 항상
// Design 자식 → Feedback 자식 루프를 거쳐 사용자 게이트로 간다.
import type { StageId } from "./gate.ts";

/** 스폰 역할(M4 AgentSpawn). */
export type AgentRole = "design" | "feedback";

/** 내부 Design↔Feedback 루프 위치(게이트 전). */
export type DesignFeedbackPhase = "design" | "feedback";

/**
 * Feedback 수준(ADR-017) — 내부 Design↔Feedback 루프의 검토 강도.
 * none = Feedback 자식 없이 Design 산출물이 게이트 직행(opt-in Tier 0).
 * 수준별 에이전트 수 스펙은 orchestration 의 FEEDBACK_LEVELS.
 */
export type FeedbackLevel = "none" | "low" | "medium" | "high" | "ultra";

/** feedback 에이전트 역량(도구 티어). */
export type FeedbackCapability = "static" | "web" | "graph";

/**
 * 전문 feedback 에이전트 정의. name → factorynote-feedback-<name>.md 와 1:1.
 * Director 가 stages(적용 단계)로 필터링된 메뉴에서 focus·checklist 를 보고 선택한다.
 * 정의 목록의 단일 진실은 feedback-agents.ts(FEEDBACK_AGENTS) — 이 타입은
 * 역량별 데이터 파일(feedback-agents-{static,web,graph}.ts) 이 레지스트리를
 * 역방향 import 하지 않도록 여기(types/)에 둔다(순환의존 방지).
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

/** 자식 스폰 툴 호출 카운트 예산 — pi-subagents toolBudget(hard 필수, hard≥1) 에 매핑.
 *  hard 초과 후 남은 도구(기본 read/grep/find/ls) 차단 → 자식 종료 유도.
 *  주: 이것은 호출 '횟수' 상한이지, 시스템 프롬프트에서 도구를 빼는 기능이 아니다(ADR-012). */
export interface ChildToolBudget {
	readonly hard: number;
	readonly soft?: number;
}

/** 자식 스폰 턴 상한 — pi-subagents turnBudget 에 매핑. maxTurns 도달 시 wrap-up, graceTurns 후 중단. */
export interface ChildTurnBudget {
	readonly maxTurns: number;
	readonly graceTurns?: number;
}

/**
 * 자식 스폰 컨텍스트 제약(GLM-5.2 한도·1261 관리) — core 가 정책 소유.
 * pi 어댑터가 이 값을 subagent 도구의 agent/skill/context/toolBudget/turnBudget 파라미터로
 * 매핑해 Director 에게 전달한다.
 *
 * 도구 제거(시스템 프롬프트 고정 세금 절감)는 SpawnOptions 가 아니라 **명명 에이전트의
 * `tools:` allowlist**(에이전트 정의 파일)가 담당한다. 이전 toolBudgetBlock 은 프롬프트에서
 * 도구를 빼지 못해(런타임 카운트 게이트일 뿐, hard 누락으로 무효) 1261 방어에 실패했다 —
 * 도구 allowlist 로 대체(ADR-012). SpawnOptions 는 (a) 스폰할 명명 에이전트,
 * (b) 호출/턴 카운트 상한만 정책 소유한다.
 */
export interface SpawnOptions {
	readonly skill: false;
	readonly context: "fresh";
	/** 스폰할 명명 에이전트(tools allowlist·context·skill 은 에이전트 정의에 고정). */
	readonly agentName: string;
	/** 툴 호출 카운트 상한(hard 필수, hard≥1). */
	readonly toolBudget: ChildToolBudget;
	/** 어시스턴트 턴 상한. 과도 reasoning/파일 읽기로 컨텍스트 팽창 시 강제 종료. */
	readonly turnBudget: ChildTurnBudget;
}

/**
 * 파일 경로 기반 산출물 교환 — Director(영구 에이전트) 컨텍스트 누적 차단.
 * designPrompt(stage 불변)·draft·feedback 상세리뷰 모두 파일로 영속;
 * spawnTask 와 designArtifact/feedbackResult 보고는 경로(+요약)만 주고받는다.
 * core 는 harness-agnostic(파일 I/O 無) — 경로를 데이터로 주입받아 task 에 끼운다.
 * paths 미제공(동기 스폰 목 하네스) 시 inline 모드로 동작(기존 호환).
 */
export interface ArtifactPaths {
	readonly designPrompt: string;
	readonly draft: string;
	readonly feedback: string;
	/** 현 단계 feedback 메뉴 파일 경로(Director 동적 선택용, ADR-014). */
	readonly menu: string;
}

/**
 * M4 AgentSpawn 계약 — 동기 스폰이 가능한 harness가 구현하는 인터페이스.
 * pi는 확장 코드가 서브에이전트를 동기 스폰할 수 없으므로(에이전트 전용 도구),
 * pi 어댑터는 이 인터페이스를 '에이전트 매개'로 실현한다(factorynote_plan 이
 * 단계 지시문을 반환 → Director 에이전트가 자신의 subagent 도구로 스폰 →
 * 결과를 보고). 동기 스폰 harness(CLI 테스트 하네스 등)는 runDesignFeedbackLoop
 * 에 이 구현을 직접 주입한다.
 */
export interface AgentSpawn {
	spawn(role: AgentRole, task: string): Promise<string>;
}

/** Feedback 에이전트의 산출물 검토 판정(코어 파싱 결과). */
export type FeedbackOutcome =
	| { clean: true }
	| { clean: false; issues: string[] };

/**
 * 검증 축(단계별 설정 기반) — 각 단계는 의미있는 축들로 feedback 을 분할한다.
 * ADR-013 병렬 팬아웃: 축별 Feedback 자식이 독립 검토 → 한 번에 합성 수정.
 */
export interface FeedbackAxis {
	/** 축 식별자(예: "security", "logic"). 과제 주입·보고 파싱에 사용. */
	axis: string;
	/** 해당 축의 검토 체크리스트. */
	checklist: string[];
}

/** 한 축의 Feedback 검토 결과(코어 파싱). */
export interface FeedbackAxisOutcome {
	axis: string;
	outcome: FeedbackOutcome;
}

/** 오케스트레이션 단계 지시문 — drivePlan이 에이전트에게 반환하는 다음 행동. */
export type DesignFeedbackDirective =
	| {
			action: "spawn-design";
			/** Design 프롬프트(루프 시 이전 이슈 인용 포함). */
			task: string;
			loop: number;
			/** 자식 스폰 컨텍스트 제약(core 정책) — 어댑터가 subagent 파라미터로 매핑. */
			spawnOptions: SpawnOptions;
	  }
	| {
			action: "spawn-feedback";
			/** 현 단계 feedback 메뉴 파일 경로 — Director 가 읽어 상황에 맞는 N 개 에이전트를 추려 병렬 스폰(ADF-014). */
			menuPath: string;
			/** 검토 대상 draft 파일 경로. */
			draftPath: string;
			/** feedback 상세리뷰 베이스 경로(<경로>.<name>). */
			feedbackPath: string;
			/** 현 Feedback 수준(ADR-017) — Director 의 스폰 에이전트 수 결정 기준. */
			feedbackLevel?: FeedbackLevel;
			spawnOptions: SpawnOptions;
	  }
	| {
			action: "gate";
			/** 게이트에 저장·표시할 산출물(클린 판정본 또는 에스컬레이션 시 마지막 초안). */
			artifact: string;
			/** 내부 루프 상한 도달 — 에스컬레이션 프레이밍으로 게이트 오픈. */
			escalated: boolean;
			loops: number;
			/** 에스컬레이션 시 잔존 이슈(클린 시 빈 배열). */
			issues: string[];
	  };
