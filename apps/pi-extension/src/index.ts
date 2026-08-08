// @factorynote/pi-extension — Pi harness 어댑터(Layer 3). FactoryNote 메인 구현체.
//  - /factorynote 명령 = plan 모드 토글(모드 ON 시 계획 전용 프롬프트 주입)
//  - factorynote_plan 도구 = 3단계 게이트 파이프라인 구동(웹 페이지가 게이트)
//  - Tier 0: 단일 에이전트가 Design/Feedback 역할 인라인 전환(1패스 자기검토)
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { drivePlan } from "./plan-tool.ts";
import { moduleDir } from "./gate-server.ts";

// plan 모드 상태(세션 내 메모리). /factorynote 로 토글.
let planMode = false;
// auto-advance(게이트 자동 승인) 상태(세션 내 메모리). /factorynote auto 로 토글.
let autoAdvance = false;

const PLAN_MODE_PROMPT = `
[FactoryNote PLAN MODE 활성화]
너는 지금 FactoryNote plan 모드에 있다. 아래 규칙을 엄격히 지킨다.

1. 코드를 작성하지 않는다(기존 코드 수정·생성 금지). 오직 '계획'을 만든다.
2. 사용자의 기능 요청이 들어오면 factorynote_plan 도구로 3단계 게이트 파이프라인을 구동한다.
3. 파이프라인 절차:
   a. factorynote_plan({ feature }) 호출 → 현재 단계와 산출물 작성 지시(designPrompt)를 받는다.
   b. Design 역할: 지시대로 해당 단계 산출물을 마크다운으로 작성한다.
   c. Feedback 역할(자기검토): feedbackChecklist 로 산출물을 1패스 비판 검토한 뒤 반영한다.
   d. factorynote_plan({ feature, artifactMd }) 로 산출물을 제출 → 사용자 게이트(웹)가 열리고 결정이 돌아온다.
   e. verdict=modify → 코멘트 반영해 재작성 후 재제출. verdict=confirm → 다음 단계로. done=true → 종료.
   f. 게이트가 열린 동안 사용자가 실시간 채팅을 보내면 반환값에 '사용자 실시간 채팅' 섹션(chatPending)이 나타난다. 게이트는 닫히지 않는다. 질문이면 factorynote_plan({ feature, chatResponse }) 로 답변하고, 산출물 수정이 필요하면 factorynote_plan({ feature, chatResponse, artifactMd }) 로 수정본과 답변을 함께 전달하라(게이트 유지). 채팅 수정은 modify 루프에 포함되지 않는다. 최종 확정은 사용자가 웹 게이트 바로 한다.
4. 3단계(요청 이해·시나리오 → 모듈·클래스 설계 → 구현 계획)를 순차 진행한다. 단계를 건너뛰지 않는다.
5. 사용자가 웹에서 승인하기 전에는 다음 단계로 넘어가지 않는다(5대 원칙).
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

export default function (pi: ExtensionAPI): void {
	// /factorynote — plan 모드 토글(/factorynote on|off 로 명시적 설정).
	pi.registerCommand("factorynote", {
		description:
			"FactoryNote plan 모드 토글 (on|off) · auto [on|off] = 게이트 자동 승인",
		handler: async (args, ctx) => {
			const parts = (args ?? "")
				.trim()
				.toLowerCase()
				.split(/\s+/)
				.filter(Boolean);
			// auto 서브커맨드 — auto-advance(게이트 우회) 토글·설정.
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

	// factorynote_plan — 3단계 게이트 파이프라인 구동 도구.
	pi.registerTool({
		name: "factorynote_plan",
		label: "FactoryNote Plan",
		description:
			"FactoryNote 3단계 human-gated 계획 파이프라인을 1스텝 구동. plan 모드에서 기능 요청을 처리한다. 반환값의 needArtifact/message 에 따라 산출물 작성·재제출·다음 단계 진행을 결정.",
		promptSnippet: "Drive the FactoryNote 3-stage gated plan pipeline",
		promptGuidelines: [
			"Use factorynote_plan when in FactoryNote plan mode to produce a human-gated plan instead of writing code.",
		],
		parameters: Type.Object({
			feature: Type.String({
				description: "계획 대상 기능명(kebab-case 권장). 파이프라인 식별자.",
			}),
			artifactMd: Type.Optional(
				Type.String({
					description:
						"현 단계 산출물 마크다운. 생략 시 현재 단계 작성 지시를 반환한다. 작성 후 담아 재호출해 게이트를 연다.",
				}),
			),
			chatResponse: Type.Optional(
				Type.String({
					description:
						"게이트 열린 동안 사용자 실시간 채팅(chatPending)에 대한 답변. 산출물 수정이 필요하면 artifactMd(수정본)와 함께 담아 재호출 — 게이트를 유지한 채 반영.",
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
				...(params.artifactMd !== undefined
					? { artifactMd: params.artifactMd }
					: {}),
				...(params.chatResponse !== undefined
					? { chatResponse: params.chatResponse }
					: {}),
				...(autoAdvance ? { autoAdvance: true } : {}),
				...(signal ? { signal } : {}),
			});
			autoAdvance = false; // 1회 적용 후 자동 해제(재사용 시 재토글).
			// #5 파이프라인 완료 시 plan 모드 자동 해제(사용자가 매번 /factorynote 토글하지 않도록).
			if (out.done) {
				planMode = false;
				ctx.ui.notify(
					"FactoryNote: 계획 완료 — plan 모드 자동 해제. 이제 구현 가능.",
					"info",
				);
			} else {
				ctx.ui.notify(
					`FactoryNote: Stage ${out.stage} ${out.stageName}`,
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
	needArtifact: boolean;
	designPrompt: string;
	feedbackChecklist: string[];
	gateResult: { verdict: string; comments: unknown[] } | null;
	message: string;
	chatPending?: { id: string; role: string; text: string; blockId?: string }[];
}

function formatForAgent(feature: string, out: AgentOut): string {
	const lines: string[] = [];
	lines.push(
		`[feature: ${feature}] done=${out.done} stage=${out.stage}(${out.stageName}) needArtifact=${out.needArtifact}`,
	);
	if (out.gateResult) {
		lines.push(
			`게이트 결과: ${out.gateResult.verdict} (코멘트 ${out.gateResult.comments.length}건)`,
		);
	}
	if (out.chatPending && out.chatPending.length > 0) {
		lines.push("");
		lines.push(`## 사용자 실시간 채팅 (게이트 열려있는 동안 — 게이트 유지)`);
		for (const c of out.chatPending) {
			lines.push(`- ${c.blockId ? `[블록 ${c.blockId}] ` : ""}${c.text}`);
		}
		lines.push(
			`→ 위 채팅에 답한다: 질문이면 chatResponse 로 답변. 산출물 수정이 필요하면 artifactMd(수정본)와 답변 chatResponse 를 함께 담아 factorynote_plan 을 다시 호출하라(게이트 유지). 최종 확정은 사용자가 게이트 바로 한다.`,
		);
	}
	lines.push("");
	lines.push(out.message);
	if (out.needArtifact && out.designPrompt) {
		lines.push("");
		lines.push(`## 현 단계 작성 지시(Design)`);
		lines.push(out.designPrompt);
		if (out.feedbackChecklist.length) {
			lines.push("");
			lines.push(`## 자기검토 체크리스트(Feedback)`);
			for (const c of out.feedbackChecklist) lines.push(`- ${c}`);
		}
	}
	return lines.join("\n");
}
