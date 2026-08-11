// M1 Stage Registry — 3단계 정의(이름·산출물·Design 프롬프트).
// Feedback 검토 축은 전역 FEEDBACK_AGENTS 레지스트리로 이관(ADR-014 동적 선택).
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
	},
	{
		id: 2,
		name: "모듈 · 클래스 설계",
		artifact: "설계(모듈·클래스)",
		format: "markdown",
		artifactFile: "02-design.md",
		producesArtifact: true,
		designPrompt:
			'시스템을 모듈 단위로 분해하고 모듈 간 의존성을 정의한 뒤, 모듈 내부를 클래스/인터페이스 수준으로 설계하라. 산출물은 **마크다운 문서 + 별도 그래프 JSON 파일**(두 파일)로 구성한다.\n\n## 그래프 JSON(구조) — 마크다운 본문에 인라인으로 넣지 않고, 산출물 md 와 같은 폴더의 별도 파일에 저장한다. 파일명 = md 파일명에서 `.md` 를 `-graph.json` 으로 바꾼 것(예: draft.md → draft-graph.json). 내용은 다중 섹션 그래프 JSON {"sections":[{"id","title","nodes","edges"}]}. 섹션은 노드 타입으로 구분되는 두 종류: (a) 모듈 관계도 섹션 — 노드={id,label,layer(API|Service|Repository|Util|External),desc}, 엣지={id:`${from}->${to}`,source,target,data:{desc}}; (b) 클래스 구조도 섹션 — 노드는 모듈 그룹({id,type:"group",label}) 또는 그 안의 클래스({id,type:"class",name,module,attrs:[],methods:[],parentNode}) 이고 엣지는 동일 형식. 모듈 섹션을 먼저, 이어 클래스 섹션. **position·width·height 등 좌표·크기 필드는 일체 쓰지 않는다 — 뷰어가 노드 관계 기반 자동 배치한다.**\n\n## 마크다운 본문 — (1) 문서 앞에 그래프 JSON 참조 코멘트 한 줄: `<!-- graph: <json 파일명> -->` (예: `<!-- graph: draft-graph.json -->`). 참조만 둘 뿐 JSON 내용을 본문에 싣지 않는다. (2) 아키텍처 설명: 구조의 객체지향 근거(계층 분리·의존 방향·책임 분배)를 prose 로 설명한다. 특히 **객체지향 원칙**(단일 책임·개방-폐쇄·의존 역행 등)에 부합하는지, **확장·유지보수에 유리한지**, **불필요한 관계·모듈·클래스(과잉 추상화·순환 의존·중복 책임)** 가 없는지 스스로 검증하고 그 근거를 담아라.\n\n순환 의존성을 피하고 공용 API를 최소화하라. 코드(구현)는 쓰지 않는다.',
	},
	{
		id: 3,
		name: "구현 계획",
		artifact: "구현 순서·의존성 명세",
		format: "markdown",
		artifactFile: "03-implementation-plan.md",
		producesArtifact: true,
		designPrompt:
			"설계를 바탕으로 구현 순서, 의존성, 마일스톤을 정하라. 코드를 쓰기 전 사용자가 전체 로드맵을 확정할 수 있게 단계별로 써라. 의존성 구조를 시각화하는 것이 도움이 되면 그래프를 별도 JSON 파일(md 와 같은 폴더, 파일명 = md 파일명에서 `.md` 를 `-graph.json` 으로 바꾼 것)에 저장하고 본문에 `<!-- graph: <json 파일명> -->` 참조 코멘트를 둘 수 있다(선택) — JSON 형식은 {sections:[{id,title,nodes,edges}]} (Stage 2 와 동일, position 등 좌표 필드 금지). (5대 원칙 3 게이트)",
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
