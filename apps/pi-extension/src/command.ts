// /factorynote 명령 핸들러 + plan 모드 세션 상태(설정 대시보드 = 인자 없는 설정 메뉴).
// 서브커맨드 없음 — 모든 설정(feedback·design·stage·auto)과 plan 모드 on/off 는 메뉴로만.
// 세션 내 메모리 상태는 이 모듈이 소유 — index.ts(등록) 가 읽어 도구/훅에 반영.
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_DESIGN_LEVEL,
	DEFAULT_FEEDBACK_LEVEL,
	DESIGN_LEVELS,
	FEEDBACK_LEVELS,
	type DesignLevel,
	type FeedbackLevel,
} from "@factorynote/core";

// plan 모드 상태(세션 내 메모리). 메뉴의 confirm/off 로 전환.
let planMode = false;
// auto-advance(게이트 자동 승인) 상태(세션 내 메모리).
let autoAdvance = false;
// Feedback 수준(ADR-017, 세션 내 메모리).
let feedbackLevel: FeedbackLevel = DEFAULT_FEEDBACK_LEVEL;
// Design 위성 수준(ADR-031, 세션 내 메모리). 도구 파라미터가 미지정 시 기본값.
let designLevel: DesignLevel = DEFAULT_DESIGN_LEVEL;
// 최대 스테이지 개수 상한(세션 내 메모리) — 새 파이프라인 구성 시 적용·state 에 영속화. null = 상한 없음.
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

export function currentDesignLevel(): DesignLevel {
	return designLevel;
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

/** 테스트 전용 — 세션 상태를 기본값으로 초기화. */
export function resetSessionForTest(): void {
	planMode = false;
	autoAdvance = false;
	feedbackLevel = DEFAULT_FEEDBACK_LEVEL;
	designLevel = DEFAULT_DESIGN_LEVEL;
	stageCap = null;
}

function modeLine(): string {
	return `FactoryNote plan 모드: ${planMode ? "ON ✅" : "OFF"}`;
}

function statusLine(): string {
	return [
		modeLine(),
		`feedback: ${feedbackLevel}`,
		`design: ${designLevel}`,
		`stage 상한: ${stageCap === null ? "무제한" : stageCap}`,
		`auto: ${autoAdvance ? "ON ⚠" : "OFF"}`,
	].join(" · ");
}

const FEEDBACK_LEVEL_KEYS = Object.keys(FEEDBACK_LEVELS) as FeedbackLevel[];
const DESIGN_LEVEL_KEYS = Object.keys(DESIGN_LEVELS) as DesignLevel[];
const STAGE_CAP_CHOICES: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10];

const SETUP_SEPARATOR = "──────────────────";
const CONFIRM_ITEM = "confirm — 현재 설정으로 plan 모드 ON";
const OFF_ITEM = "off — plan 모드 OFF";
const KEEP_ITEM = "close — 현재 설정 유지하고 나가기 (plan 모드 유지)";
const CANCEL_ITEM = "cancel — 변경 없이 끝내기";
const CANCEL_OPTION = "취소 — 메뉴로 돌아가기";

/** 설정 대시보드 메뉴 항목 — 현재 값 표시, plan 모드 상태에 따라 하단 항목 분기. */
function setupItems(): readonly string[] {
	return [
		`feedback — 검토 수준 (현재: ${feedbackLevel})`,
		`design — design 위성 수준 (현재: ${designLevel})`,
		`stage — 최대 스테이지 개수 상한 (현재: ${stageCap === null ? "무제한" : stageCap})`,
		`auto — 게이트 자동 승인 (현재: ${autoAdvance ? "ON ⚠" : "OFF"})`,
		SETUP_SEPARATOR,
		...(planMode ? [OFF_ITEM, KEEP_ITEM] : [CONFIRM_ITEM, CANCEL_ITEM]),
	];
}

async function pickFeedbackLevel(ctx: ExtensionCommandContext): Promise<void> {
	const level = await ctx.ui.select(
		`feedback 수준 선택 (현재: ${feedbackLevel})`,
		[
			...FEEDBACK_LEVEL_KEYS.map((l) => `${l} — ${FEEDBACK_LEVELS[l].label}`),
			CANCEL_OPTION,
		],
	);
	if (level && !level.startsWith("취소"))
		feedbackLevel = level.split(" — ")[0] as FeedbackLevel;
}

async function pickDesignLevel(ctx: ExtensionCommandContext): Promise<void> {
	const level = await ctx.ui.select(
		`design 위성 수준 선택 (현재: ${designLevel})`,
		[
			...DESIGN_LEVEL_KEYS.map((l) => `${l} — ${DESIGN_LEVELS[l].label}`),
			CANCEL_OPTION,
		],
	);
	if (level && !level.startsWith("취소"))
		designLevel = level.split(" — ")[0] as DesignLevel;
}

async function pickStageCap(ctx: ExtensionCommandContext): Promise<void> {
	const choice = await ctx.ui.select(
		`최대 스테이지 개수 상한 설정 (현재: ${stageCap === null ? "무제한" : stageCap})`,
		[
			"무제한 — 상한 없음",
			...STAGE_CAP_CHOICES.map((n) => `${n} — 최대 ${n}개 스테이지`),
			CANCEL_OPTION,
		],
	);
	if (!choice || choice.startsWith("취소")) return;
	stageCap = choice.startsWith("무제한")
		? null
		: Number(choice.split(" — ")[0]);
}

/**
 * 설정 대시보드(인자 없는 /factorynote 화면). 설정 항목을 고르면 해당 선택
 * 창을 열고 메뉴로 복귀, plan 모드 전환 항목 또는 cancel/Esc 시 종료.
 */
async function runPlanSetupMenu(ctx: ExtensionCommandContext): Promise<void> {
	for (;;) {
		const choice = await ctx.ui.select(
			`FactoryNote 설정 대시보드 (plan 모드: ${planMode ? "ON" : "OFF"})`,
			[...setupItems()],
		);
		if (!choice || choice === CANCEL_ITEM || choice === KEEP_ITEM) {
			ctx.ui.notify("FactoryNote 설정 종료 — 현재 상태 유지", "info");
			return;
		}
		if (choice === CONFIRM_ITEM) {
			planMode = true;
			ctx.ui.notify(statusLine(), "info");
			return;
		}
		if (choice === OFF_ITEM) {
			planMode = false;
			ctx.ui.notify(
				`${modeLine()} — 설정은 유지(메뉴에서 재설정 가능)`,
				"info",
			);
			return;
		}
		if (choice.startsWith("feedback —")) await pickFeedbackLevel(ctx);
		else if (choice.startsWith("design —")) await pickDesignLevel(ctx);
		else if (choice.startsWith("stage —")) await pickStageCap(ctx);
		else if (choice.startsWith("auto —")) {
			autoAdvance = !autoAdvance;
			ctx.ui.notify(
				autoAdvance
					? "FactoryNote auto-advance: ON ⚠ (게이트 자동 승인 — 관찰용 브라우저만 옴)"
					: "FactoryNote auto-advance: OFF",
				"info",
			);
		}
		// separator — 무시하고 메뉴 유지
	}
}

/** /factorynote 명령 등록 — 인자 없이 설정 대시보드(메뉴)를 연다. 서브커맨드 없음. */
export function registerFactoryNoteCommand(pi: ExtensionAPI): void {
	pi.registerCommand("factorynote", {
		description:
			"FactoryNote plan 모드 설정 대시보드 — 인자 없이 실행하면 설정 메뉴(feedback·design·stage·auto · plan 모드 on/off). 서브커맨드 없음.",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				// UI 없는 환경 폴백 — 모드 토글.
				planMode = !planMode;
				ctx.ui.notify(modeLine(), "info");
				return;
			}
			await runPlanSetupMenu(ctx);
		},
	});
}
