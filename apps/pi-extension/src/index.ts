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
	currentStageCap,
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

	// factorynote_plan — 동적 구성 게이트 파이프라인 구동 도구(Tier 1 오케스트레이션).
	pi.registerTool({
		name: "factorynote_plan",
		label: "FactoryNote Plan",
		description:
			"FactoryNote human-gated 계획 파이프라인을 1스텝 구동(Tier 1 에이전트 오케스트레이션). 스테이지 구성(종류·개수)은 디렉터가 동적으로 결정한다. plan 모드에서 기능 요청을 처리한다. 반환값의 nextAction/message 에 따라 구성 결정·Design/Feedback 자식 스폰·보고·게이트 진행을 결정.",
		promptSnippet:
			"Drive the FactoryNote dynamically-composed gated plan pipeline",
		promptGuidelines: [
			"Use factorynote_plan when in FactoryNote plan mode to produce a human-gated plan instead of writing code.",
			'On the FIRST call for a new feature the tool returns nextAction=compose with the stage-kind catalog: decide the composition (kinds, count, order) for this request and call factorynote_plan again with the stages parameter (e.g. ["understanding","design","implementation"]). Respect the max stage cap shown in the compose message; repeats of a kind are allowed.',
			"When the tool returns chatPending (a user asked something while the gate is open), you MUST answer it: call factorynote_plan again with chatResponse (and designArtifact if a rewrite is needed) to keep the gate open. Never end your turn on chatPending — doing so breaks the chat loop and the user gets no reply.",
			"When nextAction=spawn-design, read menuPath/designMenuPath and designLevel: spawn 1 main agent (factorynote-design) with spawnTask writing draft.md, plus N satellite agents (factorynote-design-<name>, per designLevel low 0 / medium 1 / high 2) IN PARALLEL via workflowScript runs.all — each satellite reads designPrompt, writes only its own file (draft.<role>.md), never graphs, returns only its path. Report the main path as designArtifact and each satellite under a [name] header + its path; on spawn rate-limit failure retry in sequential batches of 3-4. Gate/feedback/verify stay on the main doc. When nextAction=spawn-feedback, read menuPath, pick the number of factorynote-feedback-<name> agents required by the current feedback level (low 1 / medium 2-3 / high 4-6 / ultra 9), and spawn them in parallel (runs.all); on spawn rate-limit failure retry in sequential batches of 3-4; report aggregated [name] verdicts. Children write to files; report paths/verdicts, never inline content.",
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
			stages: Type.Optional(
				Type.Array(Type.String(), {
					description:
						'신규 파이프라인 스테이지 구성 — 카탈로그 kind 를 순서대로 나열(예: ["understanding","design","implementation"]). 같은 종류 반복 허용. 첫 호출(nextAction=compose 응답) 직후에만 적용된다.',
				}),
			),
			maxStages: Type.Optional(
				Type.Number({
					description:
						"최대 스테이지 개수 상한(사용자 지정). 구성이 초과하면 잘라서 적용하고 state 에 영속화. 미지정 시 세션 명령(/factorynote stage <n>) 값 사용.",
				}),
			designLevel: Type.Optional(
				Type.Union(
					[Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")],
					{
						description:
							"Design 위성 수준(기본 low). low=주 문서만(현행 단일 에이전트), medium=주+1 위성, high=주+2 위성. 위성은 draft.<role>.md 에 병렬 스폰으로 작성된다.",
					},
				),
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
			// 상한 우선순위: 도구 파라미터 > 세션 명령(/factorynote stage <n>).
			const maxStages =
				typeof params.maxStages === "number"
					? params.maxStages
					: (currentStageCap() ?? undefined);
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
				...(Array.isArray(params.stages) ? { stages: params.stages } : {}),
				...(maxStages !== undefined ? { maxStages } : {}),
				...(params.designLevel !== undefined
					? { designLevel: params.designLevel }
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
					out.stage === 0
						? `FactoryNote: ${out.stageName} (${out.nextAction})`
						: `FactoryNote: Stage ${out.stage} ${out.stageName} (${out.nextAction})`,
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
