// @factorynote/pi-extension — Pi harness 어댑터(Layer 3). FactoryNote 메인 구현체.
//  - /factorynote 명령 = plan 모드 토글(모드 ON 시 계획 전용 프롬프트 주입)
//  - factorynote_plan 도구 = 6단계 게이트 파이프라인 구동(웹 페이지가 게이트)
//  - Tier 0: 단일 에이전트가 Design/Feedback 역할 인라인 전환(1패스 자기검토)
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { drivePlan } from "./plan-tool.ts";
import { moduleDir } from "./gate-server.ts";

// plan 모드 상태(세션 내 메모리). /factorynote 로 토글.
let planMode = false;

const PLAN_MODE_PROMPT = `
[FactoryNote PLAN MODE 활성화]
너는 지금 FactoryNote plan 모드에 있다. 아래 규칙을 엄격히 지킨다.

1. 코드를 작성하지 않는다(기존 코드 수정·생성 금지). 오직 '계획'을 만든다.
2. 사용자의 기능 요청이 들어오면 factorynote_plan 도구로 6단계 게이트 파이프라인을 구동한다.
3. 파이프라인 절차:
   a. factorynote_plan({ feature }) 호출 → 현재 단계와 산출물 작성 지시(designPrompt)를 받는다.
   b. Design 역할: 지시대로 해당 단계 산출물을 마크다운으로 작성한다.
   c. Feedback 역할(자기검토): feedbackChecklist 로 산출물을 1패스 비판 검토한 뒤 반영한다.
   d. factorynote_plan({ feature, artifactMd }) 로 산출물을 제출 → 사용자 게이트(웹)가 열리고 결정이 돌아온다.
   e. verdict=modify → 코멘트 반영해 재작성 후 재제출. verdict=confirm → 다음 단계로. done=true → 종료.
4. 6단계(요구사항→시나리오→모듈설계→클래스설계→구현계획→최종검증)를 순차 진행한다. 단계를 건너뛰지 않는다.
5. 사용자가 웹에서 승인하기 전에는 다음 단계로 넘어가지 않는다(5대 원칙).
plan 모드를 끄려면 /factorynote 를 다시 입력한다.
`.trim();

async function resolveViewerDistDir(cwd: string): Promise<string> {
	const extDir = moduleDir(import.meta.url); // index.ts 가 있는 디렉토리
	const candidates = [
		process.env.FACTORYNOTE_VIEWER_DIST,
		join(extDir, "viewer", "dist"), // 설치형: <ext>/viewer/dist
		join(cwd, "prototypes", "plan-page-mockup", "dist"), // 개발: 리포 내 목업
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
	return join(cwd, "prototypes", "plan-page-mockup", "dist");
}

function modeLine(): string {
	return `FactoryNote plan 모드: ${planMode ? "ON ✅" : "OFF"}`;
}

export default function (pi: ExtensionAPI): void {
	// /factorynote — plan 모드 토글(/factorynote on|off 로 명시적 설정).
	pi.registerCommand("factorynote", {
		description: "FactoryNote plan 모드 토글 (on|off)",
		handler: async (args, ctx) => {
			const a = (args ?? "").trim().toLowerCase();
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

	// factorynote_plan — 6단계 게이트 파이프라인 구동 도구.
	pi.registerTool({
		name: "factorynote_plan",
		label: "FactoryNote Plan",
		description:
			"FactoryNote 6단계 human-gated 계획 파이프라인을 1스텝 구동. plan 모드에서 기능 요청을 처리한다. 반환값의 needArtifact/message 에 따라 산출물 작성·재제출·다음 단계 진행을 결정.",
		promptSnippet: "Drive the FactoryNote 6-stage gated plan pipeline",
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
				...(signal ? { signal } : {}),
			});
			ctx.ui.notify(`FactoryNote: Stage ${out.stage} ${out.stageName}`, "info");
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
