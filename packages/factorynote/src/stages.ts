// M1 Stage Registry — 3단계 정의(이름·산출물·Design 프롬프트).
// Feedback 검토 축은 전역 FEEDBACK_AGENTS 레지스트리로 이관(ADR-014 동적 선택).
// 프로토콜(protocol/stages/)의 실행 투영. 근거: vault/01-architecture/multi-agent-pipeline.
import type { ArtifactFormat, StageId } from "./types/index.ts";

/** 산출물 동반 계층 그래프 트리 의무 — none(언급 없음)/optional(선택)/required(필수·코드 강제). */
export type StageGraphMode = "none" | "optional" | "required";

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
	/** 계층 그래프 트리 의무 — 단계별 스폰 명령·검증을 분기한다(Stage 2 required). */
	graph: StageGraphMode;
}

export const STAGES: readonly StageDefinition[] = [
	{
		id: 1,
		name: "요청 이해 · 동작 시나리오",
		artifact: "요구사항·시나리오 명세",
		format: "markdown",
		artifactFile: "01-understanding-and-scenarios.md",
		producesArtifact: true,
		graph: "none",
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
		graph: "required",
		designPrompt:
			'시스템을 모듈 단위로 분해하고 모듈 간 의존성을 정의한 뒤, 모듈 내부를 클래스/인터페이스 수준으로, 클래스 내부를 메서드 수준으로 설계하라. 산출물은 **마크다운 문서 + 계층 그래프 파일 트리**로 구성한다.\n\n## 계층 그래프 트리(구조) — 마크다운 본문에 인라인으로 넣지 않는다.\n- 루트 파일: 산출물 md 와 같은 폴더, 파일명 = md 파일명에서 `.md` 를 `-graph.json` 으로 바꾼 것(예: draft.md → draft-graph.json).\n- 자식 파일: 자식이 있는 노드마다, 루트 파일명에서 `.json` 을 뗀 이름의 서브디렉터리 안에 파일 1개(예: draft-graph/modules/<moduleId>.json, draft-graph/modules/<moduleId>/<classId>.json).\n- 모든 레벨 파일 공통 형태: {"version":2, "id":<이 레벨이 펼치는 부모 노드 id, 루트는 생략>, "title":<레벨 제목>, "childLevel":<다음 레벨 이름, 예: "modules"/"classes"/"methods">, "nodes":[...]}.\n- 노드 공통 형태: {id, ...표시 필드, refs, children}. `children` 은 자식 레벨 파일의 **루트 디렉터리 기준 상대경로** — 자식이 있을 때만 쓴다.\n- 참조(refs): 모든 관계는 **나가는 방향만 소스 노드의 파일에** [{to:<대상 노드 id>, comment:<관계 설명>}] 로 작성한다. 단방향이면 한쪽만, 양방향이면 양쪽 파일에 각각 작성. `comment` 는 필수.\n- 3단계 구성: (1) 루트 = 모듈 관계도 — 노드={id,label,layer(API|Service|Repository|Util|External),desc,type:"module"|"external",refs,children:"modules/<moduleId>.json"}; (2) 모듈 자식 파일 = 클래스 구조 — 노드={id,type:"class",name,module,attrs:[],methods:[],refs,children:"modules/<moduleId>/<classId>.json"}; (3) 클래스 자식 파일 = 메서드 그래프 — 노드={id,type:"method",label,desc,refs}.\n- 같은 레벨(모든 파일 합산)에서 노드 id 는 유일하게 — 뷰어가 선택된 부모들의 자식 레벨을 병합 렌더한다. 참조 대상이 미선택 영역이면 뷰어에서 숨겨진다.\n- **position·width·height 등 좌표·크기 필드는 모든 레벨에 일체 쓰지 않는다 — 뷰어가 관계 기반 자동 배치한다.**\n\n## 마크다운 본문 — (1) 문서 앞에 루트 그래프 파일 참조 코멘트 한 줄: `<!-- graph: <루트 json 파일명> -->` (예: `<!-- graph: draft-graph.json -->`). 참조만 둘 뿐 JSON 내용을 본문에 싣지 않는다. (2) 아키텍처 설명: 구조의 객체지향 근거(계층 분리·의존 방향·책임 분배)를 prose 로 설명한다. 특히 **객체지향 원칙**(단일 책임·개방-폐쇄·의존 역행 등)에 부합하는지, **확장·유지보수에 유리한지**, **불필요한 관계·모듈·클래스(과잉 추상화·순환 의존·중복 책임)** 가 없는지 스스로 검증하고 그 근거를 담아라.\n\n순환 의존성을 피하고 공용 API를 최소화하라. 코드(구현)는 쓰지 않는다.',
	},
	{
		id: 3,
		name: "구현 계획",
		artifact: "구현 순서·의존성 명세",
		format: "markdown",
		artifactFile: "03-implementation-plan.md",
		producesArtifact: true,
		graph: "optional",
		designPrompt:
			"설계를 바탕으로 구현 순서, 의존성, 마일스톤을 정하라. 코드를 쓰기 전 사용자가 전체 로드맵을 확정할 수 있게 단계별로 써라. 의존성 구조를 시각화하는 것이 도움이 되면 그래프를 계층 트리(Stage 2 와 동일 규약: 루트 json + 자식 파일 서브디렉터리, version:2 레벨 파일, refs={to,comment} 나가는 참조만, position 등 좌표 필드 금지)로 md 와 같은 폴더에 저장하고 본문에 `<!-- graph: <루트 json 파일명> -->` 참조 코멘트를 둘 수 있다(선택). (5대 원칙 3 게이트)",
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
