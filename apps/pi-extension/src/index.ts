// @factorynote/pi-extension — Pi harness 어댑터(Layer 3). FactoryNote 메인 구현체.
//  - /factorynote 명령 = plan 모드 토글(모드 ON 시 계획 전용 프롬프트 주입)
//  - factorynote_plan 도구 = 3단계 게이트 파이프라인 구동(웹 페이지가 게이트)
//  - Tier 1: Director 에이전트가 Design·Feedback 자식을 subagent 도구로 스폰해
//    내부 Design↔Feedback 루프를 돌림(core 가 전이·상한·에스컬레이션 통제).
//    pi 확장 코드는 서브에이전트 동기 스폰이 불가 → 에이전트 매개(ADR 참고).
// 책임별 모듈: command.ts(명령·세션 상태) · prompt.ts(plan 모드 프롬프트)
//             viewer.ts(뷰어 dist 탐색) · format.ts(에이전트 반환 포맷)
//             plan-tool.ts(파이프라인 드라이버) · gate-server.ts(게이트 서버)
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { join } from "node:path";
import { drivePlan } from "./plan-tool.ts";
import {
	consumeAutoAdvance,
	currentFeedbackLevel,
	disablePlanMode,
	isAutoAdvance,
	isPlanMode,
	registerFactoryNoteCommand,
} from "./command.ts";
import { PLAN_MODE_PROMPT } from "./prompt.ts";
import { resolveViewerDistDir } from "./viewer.ts";
import { formatForAgent, type AgentOut } from "./format.ts";

export default function (pi: ExtensionAPI): void {
	// /factorynote — plan 모드 토글(/factorynote on|off 로 명시적 설정).
	registerFactoryNoteCommand(pi);

	// plan 모드 ON 시 매 턴 계획 전용 프롬프트 주입.
	pi.on("before_agent_start", (event) => {
		if (!isPlanMode()) return;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${PLAN_MODE_PROMPT}`,
		};
	});

	// factorynote_plan — 3단계 게이트 파이프라인 구동 도구(Tier 1 오케스트레이션).
	pi.registerTool({
		name: "factorynote_plan",
		label: "FactoryNote Plan",
		description:
			"FactoryNote 3단계 human-gated 계획 파이프라인을 1스텝 구동(Tier 1 에이전트 오케스트레이션). plan 모드에서 기능 요청을 처리한다. 반환값의 nextAction/message 에 따라 Design/Feedback 자식 스폰·보고·게이트 진행을 결정.",
		promptSnippet: "Drive the FactoryNote 3-stage gated plan pipeline",
		promptGuidelines: [
			"Use factorynote_plan when in FactoryNote plan mode to produce a human-gated plan instead of writing code.",
			"When the tool returns chatPending (a user asked something while the gate is open), you MUST answer it: call factorynote_plan again with chatResponse (and designArtifact if a rewrite is needed) to keep the gate open. Never end your turn on chatPending — doing so breaks the chat loop and the user gets no reply.",
			"When nextAction=spawn-design, spawn factorynote-design with spawnTask (file protocol). When nextAction=spawn-feedback, read menuPath, pick the number of factorynote-feedback-<name> agents required by the current feedback level (low 1 / medium 2-3 / high 4-6 / ultra 9), and spawn them in parallel (runs.all); on spawn rate-limit failure retry in sequential batches of 3-4; report aggregated [name] verdicts. Children write to files; report paths/verdicts, never inline content.",
		],
		parameters: Type.Object({
			feature: Type.String({
				description: "계획 대상 기능명(kebab-case 권장). 파이프라인 식별자.",
			}),
			designArtifact: Type.Optional(
				Type.String({
					description:
						"현 Design 산출물 초안(Design 자식 스폰 결과). Feedback 보고 시에도 검토 대상 초안을 함께 전달한다.",
				}),
			),
			feedbackResult: Type.Optional(
				Type.String({
					description:
						"Feedback 자식 스폰 결과(raw). 첫 줄 CLEAN(이슈 없음) 또는 ISSUES(이후 줄에 이슈). 보고 시에만 전달.",
				}),
			),
			chatResponse: Type.Optional(
				Type.String({
					description:
						"게이트 열린 동안 사용자 실시간 채팅(chatPending)에 대한 답변. 산출물 수정이 필요하면 Design 자식 재스폰으로 designArtifact(경로)와 함께 담아 재호출 — 게이트를 유지한 채 반영.",
				}),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const feature = String(params.feature ?? "").trim();
			if (!feature) {
				return {
					content: [
						{
							type: "text",
							text: "factorynote_plan 오류: feature(기능명)가 필요하다.",
						},
					],
					details: {},
					isError: true,
				};
			}
			const root = join(ctx.cwd, ".factorynote");
			const viewerDistDir = await resolveViewerDistDir(ctx.cwd);
			const out = await drivePlan({
				root,
				viewerDistDir,
				feature,
				...(params.designArtifact !== undefined
					? { designArtifact: params.designArtifact }
					: {}),
				...(params.feedbackResult !== undefined
					? { feedbackResult: params.feedbackResult }
					: {}),
				...(params.chatResponse !== undefined
					? { chatResponse: params.chatResponse }
					: {}),
				feedbackLevel: currentFeedbackLevel(),
				...(isAutoAdvance() ? { autoAdvance: true } : {}),
				...(signal ? { signal } : {}),
			});
			consumeAutoAdvance(); // 1회 적용 후 자동 해제(재사용 시 재토글).
			// #5 파이프라인 완료 시 plan 모드 자동 해제.
			if (out.done) {
				disablePlanMode();
				ctx.ui.notify(
					"FactoryNote: 계획 완료 — plan 모드 자동 해제. 이제 구현 가능.",
					"info",
				);
			} else {
				ctx.ui.notify(
					`FactoryNote: Stage ${out.stage} ${out.stageName} (${out.nextAction})`,
					"info",
				);
			}
			return {
				content: [
					{ type: "text", text: formatForAgent(feature, out as AgentOut) },
				],
				details: {},
			};
		},
	});
}
