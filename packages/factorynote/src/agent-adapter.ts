// M4 Agent Adapter — AgentSpawn 인터페이스. 구현체는 apps/<harness>/.
// Tier 0: 어댑터 없음 (Orchestrator가 인라인 역할 전환으로 인터페이스를 자명하게 만족).
// Tier 1: 분리 에이전트 스폰 (Pi = pi-crew). Codex/Claude 구현체는 OUT(인터페이스만).

export type AgentRole = "design" | "feedback";

export interface AgentSpawn {
	/** role 에이전트에 task 를 주고 결과(산출물/판정)를 받는다. */
	spawn(role: AgentRole, task: string): Promise<string>;
}
