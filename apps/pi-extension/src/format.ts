// 에이전트 반환 포맷팅 — drivePlan 출력을 Director 가 읽는 텍스트로 변환.
import type { DrivePlanOutput } from "./plan-types.ts";

/** 에이전트 반환용 슬림 출력 계약(도구 등록 시점에 알려진 형태). */
export interface AgentOut {
	done: boolean;
	stage: number;
	stageName: string;
	nextAction: "compose" | "spawn-design" | "spawn-feedback" | "done";
	spawnRole?: "design" | "feedback";
	spawnTask?: string;
	spawnOptions?: DrivePlanOutput["spawnOptions"];
	draftPath?: string;
	feedbackPath?: string;
	menuPath?: string;
	dfLoop: number;
	designPrompt: string;
	gateResult: { verdict: string; comments: unknown[] } | null;
	message: string;
	chatPending?: { id: string; role: string; text: string; blockId?: string }[];
}

export function formatForAgent(feature: string, out: AgentOut): string {
	const lines: string[] = [];
	lines.push(
		`[feature: ${feature}] done=${out.done} stage=${out.stage}(${out.stageName}) nextAction=${out.nextAction}` +
			(out.nextAction !== "done" ? ` loop=${out.dfLoop}` : ""),
	);
	if (out.gateResult) {
		lines.push(
			`게이트 결과: ${out.gateResult.verdict} (코멘트 ${out.gateResult.comments.length}건)`,
		);
	}
	// 채팅 대기: 최우선으로 재호출 지시를 내걸어 에이전트가 턴을 종료하지 않게 한다(게이트 유지).
	// 턴을 끊으면 채팅 루프가 끊겨 사용자에게 답변이 돌아가지 않는다.
	if (out.chatPending && out.chatPending.length > 0) {
		lines.push("");
		lines.push(`## ⚠ 사용자 채팅 대기 — 게이트 유지 (턴을 종료하지 말 것)`);
		for (const c of out.chatPending) {
			lines.push(`- ${c.blockId ? `[블록 ${c.blockId}] ` : ""}${c.text}`);
		}
		lines.push(
			`반드시 아래 한 가지로 응답하며 factorynote_plan 을 다시 호출해 게이트를 유지한다 — 이 메시지에서 턴을 끊으면 채팅 루프가 끊긴다.`,
		);
		lines.push(`- 질문이면 → factorynote_plan(chatResponse: "<답변>")`);
		lines.push(
			`- 산물 수정이 필요하면 → Design 자식 재스폰 후 factorynote_plan(designArtifact: "<초안 경로>", chatResponse: "<답변>")`,
		);
		lines.push(`최종 확정/수정/정정은 사용자가 게이트 바로 한다.`);
	}
	lines.push("");
	lines.push(out.message);
	if (!out.done && out.spawnTask && out.spawnRole) {
		lines.push("");
		lines.push(`## 자식 스폰 과제(${out.spawnRole})`);
		lines.push(out.spawnTask);
	}
	return lines.join("\n");
}
