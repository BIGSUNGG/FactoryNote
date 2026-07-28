// @factorynote/pi-extension — Pi 어댑터 (Layer 3, harness 접촉층).
// M4 Tier 1(pi-crew 스폰) + M5(`/factorynote` 명령 바인딩).
// 코어(@factorynote/core)의 인터페이스를 Pi 환경에 연결. 구현은 Stage 5.

import type { AgentSpawn, AgentRole } from "@factorynote/core";

/** M4 Tier 1 — pi-crew로 Design/Feedback 분리 에이전트 스폰. */
export class PiAgentSpawn implements AgentSpawn {
	async spawn(_role: AgentRole, _task: string): Promise<string> {
		// TODO Stage 5: pi-crew subagent 호출 (crew_agent / Agent tool)
		throw new Error("PiAgentSpawn not implemented (Stage 5)");
	}
}

/** M5 — `/factorynote <feature>` 진입점. 신규 init vs 기존 resume 분기. */
export async function factorynote(_feature: string): Promise<void> {
	// TODO Stage 5: M2 Orchestrator(protocol) 위임 + M3 Persistence(.factorynote/state.json)
	throw new Error("factorynote command not implemented (Stage 5)");
}
