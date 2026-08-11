// @factorynote/pi-extension — Pi harness 어댑터(Layer 3). FactoryNote 메인 구현체.
//  - /factorynote 명령 = plan 모드 토글(모드 ON 시 계획 전용 프롬프트 주입)
//  - factorynote_plan 도구 = 3단계 게이트 파이프라인 구동(웹 페이지가 게이트)
//  - Tier 1: Director 에이전트가 Design·Feedback 자식을 subagent 도구로 스폰해
//    내부 Design↔Feedback 루프를 돌림(core 가 전이·상한·에스컬레이션 통제).
//    pi 확장 코드는 서브에이전트 동기 스폰이 불가 → 에이전트 매개(ADR 참고).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { join } from "node:path";
import { access } from "node:fs/promises";
import {
	DEFAULT_FEEDBACK_LEVEL,
	FEEDBACK_LEVELS,
	type FeedbackLevel,
} from "@factorynote/core";
import { drivePlan } from "./plan-tool.ts";
import { moduleDir } from "./gate-server.ts";

// plan 모드 상태(세션 내 메모리). /factorynote 로 토글.
let planMode = false;
// auto-advance(게이트 자동 승인) 상태(세션 내 메모리). /factorynote auto 로 토글.
let autoAdvance = false;
// Feedback 수준(ADR-017, 세션 내 메모리). /factorynote feedback <level> 로 설정.
let feedbackLevel: FeedbackLevel = DEFAULT_FEEDBACK_LEVEL;

const PLAN_MODE_PROMPT = `
[FactoryNote PLAN MODE 활성화 — Tier 1 에이전트 오케스트레이션]
너는 지금 FactoryNote plan 모드에 있다. 너는 Director(조율자) 역할이다. 아래 규칙을 엄격히 지킨다.

1. 코드를 작성하지 않는다(기존 코드 수정·생성 금지). 오직 '계획'을 만든다.
2. 사용자의 기능 요청이 들어오면 factorynote_plan({ feature }) 으로 3단계 파이프라인을 구동한다.
3. 산출물은 '단일 에이전트가 직접 작성'하지 않는다. 항상 Design 자식 → Feedback 자식 루프를 거친다:
   a. factorynote_plan 반환값의 nextAction 이 spawn-design → 너의 subagent 도구로 Design 자식을 스폰한다. **스폰 옵션을 반드시 적용: agent="반환된 spawnOptions.agentName", skill=false, context="fresh", toolBudget={hard: 반환된 spawnOptions.toolBudget.hard}, turnBudget={maxTurns: 반환된 spawnOptions.turnBudget.maxTurns}}** — 자식은 명명 에이전트('tools:' allowlist 로 도구가 제한됨)로 fresh 최소 컨텍스트로 스폰되어 고정 세금(도구/스킬 정의)과 부모 누적 상속이 끊긴다(GLM-5.2 한도 초과·1261 방지). 과제는 반환된 spawnTask 이다. **Design 자식은 산출물을 지정된 파일(draftPath)에 쓰고 반환은 그 경로만 한다 — 너는 그 경로를 designArtifact 에 그대로 담아 factorynote_plan 을 다시 호출한다(절대 산출물 본문을 직접 전달하지 않는다 — 본문이 넘어가면 네 컨텍스트가 부풋어 한도 초과한다).**
   b. nextAction 이 spawn-feedback → **동적 선택(ADR-014) + Feedback 수준(ADR-017)**: menuPath 의 feedback 메뉴를 읽고, 지시문에 명시된 현 수준(feedbackLevel)의 에이전트 수를 맞춰 추린다 — low: 정확히 1개(가장 관련 높은 1개가 1~3개 검토 영역 담당), medium: 2~3개, high: 4~6개, ultra: 9개(none 수준에서는 spawn-feedback 자체가 오지 않는다). 추린 Feedback 자식을 subagent 의 workflowScript runs.all 로 **병렬** 스폰한다. 각 자식: agent="factorynote-feedback-<name>", skill=false, context="fresh", toolBudget/turnBudget 는 spawnOptions 참조(역량별 도구는 에이전트 파일이 고정). 각 자식은 상세 리뷰를 feedbackPath.<name> 에 쓰고 반환은 판정(CLEAN/ISSUES)만. **스폰이 에이전트 호출 수/레이트 리밋 에러로 실패하면 3~4개씩 순차 배치로 나눠 재시도**하고 전 배치 판정을 합친다. **집합 보고**: 각 선택을 "[name]" 헤더 + 판정으로 나열해 feedbackResult 에 담고, designArtifact 에 draftPath 를 담아 factorynote_plan 을 다시 호출한다.
   c. nextAction 이 done → 파이프라인 종료.
4. Design↔Feedback 루프의 전이·반복 상한·에스컬레이션은 FactoryNote(core) 가 통제한다. 너는 지시문(nextAction·spawnTask) 에 따라 스폰하고 결과를 보고할 뿐, 루프 카운트를 임의로 조작하지 않는다. 상한 도달 시 core 가 에스컬레이션 게이트를 연다.
5. Feedback 클린 판정(또는 상한 에스컬레이션) 시에만 사용자 게이트(웹)가 열린다. 사용자가 승인하기 전에는 다음 단계로 넘어가지 않는다(5대 원칙). 게이트 결정(confirm/modify/revert) 은 factorynote_plan 이 받아 상태를 전이한다.
6. 3단계(요청 이해·시나리오 → 모듈·클래스 설계 → 구현 계획)를 순차 진행한다. 단계를 건너뛰지 않는다.
plan 모드를 끄려면 /factorynote 를 다시 입력한다.
`.trim();

async function resolveViewerDistDir(cwd: string): Promise<string> {
	const extDir = moduleDir(import.meta.url); // index.ts 가 있는 디렉토리
	const candidates = [
		process.env.FACTORYNOTE_VIEWER_DIST,
		join(extDir, "viewer", "dist"), // 설치형: <ext>/viewer/dist
		join(cwd, "apps", "plan-viewer", "dist"), // 개발: 리포 내 뷰어
	];
	for (const c of candidates) {
		if (!c) continue;
		try {
			await access(join(c, "index.html"));
			return c;
		} catch {
			/* 다음 후보 */
		}
	}
	// 마지막 후보를 기본값으로 반환(에러 메시지에 활용).
	return join(cwd, "apps", "plan-viewer", "dist");
}

function modeLine(): string {
	return `FactoryNote plan 모드: ${planMode ? "ON ✅" : "OFF"}`;
}

function autoLine(): string {
	return autoAdvance
		? "FactoryNote auto-advance: ON ⚠ (게이트 자동 승인 — 관찰용 브라우저만 옴)"
		: "FactoryNote auto-advance: OFF";
}

function feedbackLine(): string {
	const spec = FEEDBACK_LEVELS[feedbackLevel];
	return `FactoryNote feedback 수준: ${feedbackLevel} (${spec.label})`;
}

export default function (pi: ExtensionAPI): void {
	// /factorynote — plan 모드 토글(/factorynote on|off 로 명시적 설정).
	pi.registerCommand("factorynote", {
		description:
			"FactoryNote plan 모드 토글 (on|off) · auto [on|off] = 게이트 자동 승인 · feedback <none|low|medium|high|ultra> = 검토 수준",
		handler: async (args, ctx) => {
			const parts = (args ?? "")
				.trim()
				.toLowerCase()
				.split(/\s+/)
				.filter(Boolean);
			if (parts[0] === "feedback") {
				const sub = parts[1];
				if (sub === undefined) {
					ctx.ui.notify(feedbackLine(), "info");
					return;
				}
				if (sub in FEEDBACK_LEVELS) {
					feedbackLevel = sub as FeedbackLevel;
					ctx.ui.notify(feedbackLine(), "info");
				} else {
					ctx.ui.notify(
						`FactoryNote feedback 수준 오류: "${sub}" — none|low|medium|high|ultra 중 하나`,
						"error",
					);
				}
				return;
			}
			if (parts[0] === "auto") {
				const sub = parts[1];
				if (sub === "on") autoAdvance = true;
				else if (sub === "off") autoAdvance = false;
				else autoAdvance = !autoAdvance;
				ctx.ui.notify(autoLine(), "info");
				return;
			}
			const a = parts.join(" ");
			if (a === "on") planMode = true;
			else if (a === "off") planMode = false;
			else planMode = !planMode;
			ctx.ui.notify(modeLine(), planMode ? "info" : "info");
		},
	});

	// plan 모드 ON 시 매 턴 계획 전용 프롬프트 주입.
	pi.on("before_agent_start", async (event) => {
		if (!planMode) return;
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
				feedbackLevel,
				...(autoAdvance ? { autoAdvance: true } : {}),
				...(signal ? { signal } : {}),
			});
			autoAdvance = false; // 1회 적용 후 자동 해제(재사용 시 재토글).
			// #5 파이프라인 완료 시 plan 모드 자동 해제.
			if (out.done) {
				planMode = false;
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
				content: [{ type: "text", text: formatForAgent(feature, out) }],
				details: {},
			};
		},
	});
}

interface AgentOut {
	done: boolean;
	stage: number;
	stageName: string;
	nextAction: "spawn-design" | "spawn-feedback" | "done";
	spawnRole?: "design" | "feedback";
	spawnTask?: string;
	/** 자식 스폰 컨텍스트 제약(core 정책) — Director 가 subagent skill/context/toolBudget 로 적용. */
	spawnOptions?: {
		skill: false;
		context: "fresh";
		agentName: string;
		toolBudget: { hard: number; soft?: number };
		turnBudget: { maxTurns: number; graceTurns?: number };
	};
	/** Design 자식이 산출물을 쓸 파일 경로(파일 프로토콜). */
	draftPath?: string;
	/** Feedback 자식이 상세 리뷰를 쓸 파일 경로. */
	feedbackPath?: string;
	/** 현 단계 feedback 메뉴 파일 경로(Director 동적 선택용). */
	menuPath?: string;
	dfLoop: number;
	designPrompt: string;
	gateResult: { verdict: string; comments: unknown[] } | null;
	message: string;
	chatPending?: { id: string; role: string; text: string; blockId?: string }[];
}

function formatForAgent(feature: string, out: AgentOut): string {
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
