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
	/** Feedback 역할(자기검토) 체크리스트. */
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
			"사용자의 자연어 요청을 분석해 기능적/비기능적 요구사항으로 분해하라. 범위 경계·제약 조건·가정을 명시하고, 누락·모호함을 사용자가 잡을 수 있게 구체적으로 써라. 이어서, 승인된 요구사항이 충족될 때 시스템이 어떻게 동작해야 하는지 정상 경로(happy path) 시나리오로 단계별로 묘사하라 — 각 시나리오는 앞서 정리한 요구사항에 연결되어야 한다. 요구사항과 동작 시나리오 두 절을 하나의 산출물에 순서대로 담아, 사용자가 '요구사항도, 동작도 맞다'를 한 번에 확인할 수 있게 하라. 필요하다면 동작 흐름을 설명하기 위해 ```factorynote-graph 펜스로 그래프를 본문에 내장할 수 있다(선택) — 펜스 내용은 JSON {sections:[{id,title,nodes,edges}]} 형식이어야 한다. 코드는 쓰지 않는다.",
		feedbackChecklist: [
			"요구사항이 측정 가능하고 구체적인가?",
			"범위 밖(out of scope)과 숨겨진 가정이 명시되었는가?",
			"각 시나리오가 승인된 요구사항에 연결되며, 정상 경로가 빠짐없이覆盖되는가?",
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
			"시스템을 모듈 단위로 분해하고 모듈 간 의존성을 정의한 뒤, 모듈 내부를 클래스/인터페이스 수준으로 설계하라. 산출물은 마크다운 문서(.md) 하나로, (1) 설계 의도·모듈 분해 근거·핵심 설계 결정을 서술하는 본문과 (2) 본문 중 적절한 위치에 내장된 적어도 두 개의 관계도 — 모듈 관계도 섹션, 클래스 구조도 섹션 — 를 모두 담아야 한다. 그래프는 ```factorynote-graph 펜스로 본문에 삽입한다. 펜스 내용은 JSON {sections:[{id,title,nodes,edges}]} 형식이며, 하나의 펜스에 여러 섹션을 담거나 여러 펜스로 나눌 수 있다. 노드/엣지 스키마: 모듈 관계도 섹션 — 노드={id,label,layer(API|Service|Repository|Util|External),desc}, 엣지={id:`${from}->${to}`,source,target,data:{desc}}; 클래스 구조도 섹션 — 노드는 모듈 그룹({id,type:`group`,label,width,height}) 또는 그 안의 클래스({id,type:`class`,name,module,attrs:[],methods:[],parentNode}) 이고 엣지는 동일 형식. 모듈 관계도 → 클래스 구조도 순서로 배치해 설계 흐름을 표현하라. position 은 생략(뷰어가 자동 배치). 순환 의존성을 피하고 공용 API를 최소화하라. 사용자는 뷰어에서 그래프를 직접 편집할 수 있으므로 그래프는 이 단계 산출물의 핵심 부분이다 — 서술과 그래프를 적극적으로 함께 작성하라.",
		feedbackChecklist: [
			"순환 의존성이 없고 각 모듈이 단일 책임인가? 과잉 추상화가 있는가?",
			"클래스 책임이 응집되고 공용 API가 최소인가? 상태 변경 경로가 명확한가?",
			"모든 클래스가 모듈 그룹에 속하며, 모듈 설계와 클래스 설계가 정합한가?",
			"모듈 관계도와 클래스 구조도 그래프가 모두 ```factorynote-graph 펜스로 내장되어 있는가?",
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
