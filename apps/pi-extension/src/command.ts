// /factorynote 명령 핸들러 + plan 모드 세션 상태(토글·auto-advance·feedback 수준).
// 세션 내 메모리 상태는 이 모듈이 소유 — index.ts(등록) 가 읽어 도구/훅에 반영.
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_FEEDBACK_LEVEL,
	FEEDBACK_LEVELS,
	type FeedbackLevel,
} from "@factorynote/core";

// plan 모드 상태(세션 내 메모리). /factorynote 로 토글.
let planMode = false;
// auto-advance(게이트 자동 승인) 상태(세션 내 메모리). /factorynote auto 로 토글.
let autoAdvance = false;
// Feedback 수준(ADR-017, 세션 내 메모리). /factorynote feedback <level> 로 설정.
let feedbackLevel: FeedbackLevel = DEFAULT_FEEDBACK_LEVEL;
// 최대 스테이지 개수 상한(세션 내 메모리). /factorynote stage <n> 로 설정 —
// 새 파이프라인 구성 시 적용·state 에 영속화. null = 상한 없음.
let stageCap: number | null = null;

export function isPlanMode(): boolean {
	return planMode;
}

export function isAutoAdvance(): boolean {
	return autoAdvance;
}

export function currentFeedbackLevel(): FeedbackLevel {
	return feedbackLevel;
}

export function currentStageCap(): number | null {
	return stageCap;
}

/** 파이프라인 완료 시 plan 모드 자동 해제(#5). */
export function disablePlanMode(): void {
	planMode = false;
}

/** auto-advance 1회 적용 후 자동 해제(재사용 시 재토글). */
export function consumeAutoAdvance(): void {
	autoAdvance = false;
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

function stageCapLine(): string {
	return stageCap === null
		? "FactoryNote 최대 스테이지 개수: 무제한"
		: `FactoryNote 최대 스테이지 개수: ${stageCap}`;
}

const FEEDBACK_LEVEL_KEYS = Object.keys(FEEDBACK_LEVELS) as FeedbackLevel[];
const FEEDBACK_OPTIONS: readonly string[] = [
	...FEEDBACK_LEVEL_KEYS.map((l) => `${l} — ${FEEDBACK_LEVELS[l].label}`),
	"취소 — 메뉴로 돌아가기",
];

// plan 모드 진입 설정 메뉴 항목. 추후 설계·stage 등 세부 설정은 SETUP_ 목록 한 줄로 확장.
const SETUP_FEEDBACK_ITEM = "feedback — 검토 수준 설정";
const SETUP_PLANNED_ITEMS: readonly string[] = [
	"design — 설정 항목 (준비 중)",
	"stage — 설정 항목 (준비 중)",
];
const SETUP_SEPARATOR = "──────────────────";
const SETUP_CONFIRM_ITEM = "confirm — 현재 설정으로 plan 모드 ON";
const SETUP_CANCEL_ITEM = "cancel — 변경 없이 끝내기";

/**
 * plan 모드 진입 설정 메뉴(인자 없는 /factorynote 첫 화면). 항목을 고르면
 * 해당 설정 창을 열고 다시 메뉴로 복귀한다. confirm → ON, cancel/Esc → 미변경.
 */
async function runPlanSetupMenu(
	ctx: ExtensionCommandContext,
): Promise<boolean> {
	const items: readonly string[] = [
		SETUP_FEEDBACK_ITEM,
		...SETUP_PLANNED_ITEMS,
		SETUP_SEPARATOR,
		SETUP_CONFIRM_ITEM,
		SETUP_CANCEL_ITEM,
	];
	for (;;) {
		const choice = await ctx.ui.select("FactoryNote plan 모드 설정", [
			...items,
		]);
		if (!choice || choice === SETUP_CANCEL_ITEM) {
			ctx.ui.notify("FactoryNote plan 모드 ON 취소 — 현재 상태 유지", "info");
			return false;
		}
		if (choice === SETUP_CONFIRM_ITEM) return true;
		if (choice === SETUP_FEEDBACK_ITEM) {
			const level = await ctx.ui.select(
				`feedback 수준 선택 (현재: ${feedbackLevel})`,
				[...FEEDBACK_OPTIONS],
			);
			if (level && !level.startsWith("취소"))
				feedbackLevel = level.split(" — ")[0] as FeedbackLevel;
		}
		// separator·준비 중 항목 — 무시하고 메뉴 유지
	}
}

/** /factorynote 명령 등록(on|off · auto · feedback <level>). */
export function registerFactoryNoteCommand(pi: ExtensionAPI): void {
	pi.registerCommand("factorynote", {
		description:
			"FactoryNote plan 모드 (on|off) · auto [on|off] = 게이트 자동 승인 · feedback <none|low|medium|high|ultra> = 검토 수준. 인자 없으면 설정 메뉴(design·feedback·stage) 후 confirm 시 plan 모드 ON",
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
			if (parts[0] === "stage") {
				const sub = parts[1];
				if (sub === undefined) {
					ctx.ui.notify(stageCapLine(), "info");
					return;
				}
				if (sub === "off" || sub === "none") {
					stageCap = null;
					ctx.ui.notify(stageCapLine(), "info");
					return;
				}
				const n = Number(sub);
				if (Number.isInteger(n) && n >= 1) {
					stageCap = n;
					ctx.ui.notify(stageCapLine(), "info");
				} else {
					ctx.ui.notify(
						`FactoryNote 최대 스테이지 개수 오류: "${sub}" — 1 이상 정수 또는 off`,
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
			if (a === "off") {
				planMode = false;
				ctx.ui.notify(modeLine(), "info");
				return;
			}
			// bare 또는 `on`: 설정 메뉴 → feedback 등 세부 설정 → confirm 시 plan 모드 ON.
			if (ctx.hasUI && !(await runPlanSetupMenu(ctx))) return;
			planMode = true;
			ctx.ui.notify(`${modeLine()} · ${feedbackLine()}`, "info");
		},
	});
}
