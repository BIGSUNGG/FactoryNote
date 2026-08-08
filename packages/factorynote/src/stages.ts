// M1 Stage Registry — 3단계 정의(이름·산출물·Design 프롬프트·Feedback 체크리스트).
// 프로토콜(protocol/stages/)의 실행 투영. 근거: vault/01-architecture/multi-agent-pipeline.
import type { ArtifactFormat, StageId } from "./types.ts";

export interface StageDefinition {
	id: StageId;
	name: string;
	artifact: string;
	format: ArtifactFormat;
	/** 산출물 파일명(kebab). */
	artifactFile: string | null;
	producesArtifact: boolean;
	/** Design 역할에게 주어지는 작성 지시(에이전트 프롬프트에 주입). */
	designPrompt: string;
	/** Feedback 역할(검토) 체크리스트. */
	feedbackChecklist: string[];
}

export const STAGES: readonly StageDefinition[] = [
	{
		id: 1,
		name: "요청 이해 · 동작 시나리오",
		artifact: "요구사항·시나리오 명세",
		format: "markdown",
		artifactFile: "01-understanding-and-scenarios.md",
		producesArtifact: true,
		designPrompt:
			"사용자의 자연어 요청을 분석해 기능적/비기능적 요구사항으로 분해하라. 범위 경계·제약 조건·가정을 명시하고, 누락·모호함을 사용자가 잡을 수 있게 구체적으로 써라. 이어서, 승인된 요구사항이 충족될 때 시스템이 어떻게 동작해야 하는지 정상 경로(happy path) 시나리오로 단계별로 묘사하라 — 각 시나리오는 앞서 정리한 요구사항에 연결되어야 한다. 요구사항과 동작 시나리오 두 절을 하나의 산출물에 순서대로 담아, 사용자가 '요구사항도, 동작도 맞다'를 한 번에 확인할 수 있게 하라. 마지막으로 현재 범위를 넘어 **향후 추가될 수 있는 기능(확장 포인트)** 을 식별하고, 그것이 **확장성·유지보수성** 에 미치는 영향을 '참고용'으로 명시하라 — 이는 다음 단계(구조 설계)의 핵심 입력이 된다. 단, 미래 기능은 참고일 뿐 현재 범위를 임의로 확장하지는 않는다(명시된 요구사항만 승인 대상). 코드는 쓰지 않는다.",
		feedbackChecklist: [
			"요구사항이 측정 가능하고 구체적인가?",
			"범위 밖(out of scope)과 숨겨진 가정이 명시되었는가?",
			"각 시나리오가 승인된 요구사항에 연결되며, 정상 경로가 빠짐없이覆盖되는가?",
			"미래 확장 포인트(향후 추가될 수 있는 기능)와 확장성·유지보수성 영향이 참고용으로 명시되었는가? (범위 확장 아님)",
		],
	},
	{
		id: 2,
		name: "모듈 · 클래스 설계",
		artifact: "설계(모듈·클래스)",
		format: "markdown",
		artifactFile: "02-design.md",
		producesArtifact: true,
		designPrompt:
			'시스템을 모듈 단위로 분해하고 모듈 간 의존성을 정의한 뒤, 모듈 내부를 클래스/인터페이스 수준으로 설계하라. 산출물은 **하나의 마크다운 문서**로, 두 절을 순서대로 담는다.\n\n## 구조 — 아래 ```factorynote-graph 펜스 안에 다중 섹션 그래프 JSON({"sections":[{"id","title","nodes","edges"}]})을 담는다. 섹션은 노드 타입으로 구분되는 두 종류: (a) 모듈 관계도 섹션 — 노드={id,label,layer(API|Service|Repository|Util|External),desc}, 엣지={id:`${from}->${to}`,source,target,data:{desc}}; (b) 클래스 구조도 섹션 — 노드는 모듈 그룹({id,type:"group",label,width,height}) 또는 그 안의 클래스({id,type:"class",name,module,attrs:[],methods:[],parentNode}) 이고 엣지는 동일 형식. 모듈 섹션을 먼저, 이어 클래스 섹션. position 은 생략(뷰어 자동 배치). 펜스 안에는 JSON만(마크다운 금지).\n\n## 아키텍처 설명 — 구조의 객체지향 근거(계층 분리·의존 방향·책임 분배)를 prose 로 설명한다. 특히 **객체지향 원칙**(단일 책임·개방-폐쇄·의존 역행 등)에 부합하는지, **확장·유지보수에 유리한지**, **불필요한 관계·모듈·클래스(과잉 추상화·순환 의존·중복 책임)** 가 없는지 스스로 검증하고 그 근거를 담아라.\n\n순환 의존성을 피하고 공용 API를 최소화하라. 코드(구현)는 쓰지 않는다.',
		feedbackChecklist: [
			"```factorynote-graph 펜스 안의 JSON 이 {sections:[...]} 형태로 유효한가?",
			"순환 의존성이 없고 각 모듈이 단일 책임인가? 과잉 추상화가 있는가?",
			"클래스 책임이 응집되고 공용 API가 최소인가? 상태 변경 경로가 명확한가?",
			"모든 클래스가 모듈 그룹에 속하며, 구조와 아키텍처 설명이 정합한가?",
			"객체지향 적합성·확장성·유지보수성·불필요 관계/모듈/클래스 검증이 아키텍처 설명에 반영되었는가?",
		],
	},
	{
		id: 3,
		name: "구현 계획",
		artifact: "구현 순서·의존성 명세",
		format: "markdown",
		artifactFile: "03-implementation-plan.md",
		producesArtifact: true,
		designPrompt:
			"설계를 바탕으로 구현 순서, 의존성, 마일스톤을 정하라. 코드를 쓰기 전 사용자가 전체 로드맵을 확정할 수 있게 단계별로 써라. 의존성 구조를 시각화하는 것이 도움이 되면 ```factorynote-graph 펜스로 그래프를 본문에 내장할 수 있다(선택) — 펜스 내용은 JSON {sections:[{id,title,nodes,edges}]} 형식이어야 한다. (5대 원칙 3 게이트)",
		feedbackChecklist: [
			"구현 순서가 의존성을 존중하는가?",
			"각 마일스톤이 검증 가능한가?",
			"누락된 선행 작업이 있는가?",
		],
	},
] as const;

const byId = new Map<StageId, StageDefinition>(
	STAGES.map((s) => [s.id, s] as const),
);

/** 단계 id로 정의 조회. 없으면 에러(1-3 외 불가). */
export function stageById(id: StageId): StageDefinition {
	const def = byId.get(id);
	if (!def) throw new Error(`Unknown stage: ${id}`);
	return def;
}

/** 현재 단계. */
export function currentStageDef(stage: StageId): StageDefinition {
	return stageById(stage);
}

