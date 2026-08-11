// 에이전트 반환 포맷팅 — drivePlan 출력을 Director 가 읽는 텍스트로 변환.
import type { DrivePlanOutput } from "./plan-types.ts";

/** 에이전트 반환용 슬림 출력 계약(도구 등록 시점에 알려진 형태). */
export interface AgentOut {
	done: boolean;
	stage: number;
	stageName: string;
	nextAction: "spawn-design" | "spawn-feedback" | "done";
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
	lines.push("");
	lines.push(out.message);
	if (out.chatPending && out.chatPending.length > 0) {
		lines.push("");
		lines.push(`## 사용자 실시간 채팅 (게이트 열려있는 동안 — 게이트 유지)`);
		for (const c of out.chatPending) {
			lines.push(`- ${c.blockId ? `[블록 ${c.blockId}] ` : ""}${c.text}`);
		}
		lines.push(
			`→ 위 채팅에 답한다: 질문이면 chatResponse 로 답변. 산물 수정이 필요하면 Design 자식 재스폰으로 designArtifact(경로)와 답변 chatResponse 를 함께 담아 factorynote_plan 을 다시 호출하라(게이트 유지). 최종 확정은 사용자가 게이트 바로 한다.`,
		);
	}
	if (!out.done && out.spawnTask && out.spawnRole) {
		lines.push("");
		lines.push(`## 자식 스폰 과제(${out.spawnRole})`);
		lines.push(out.spawnTask);
	}
	return lines.join("\n");
}
