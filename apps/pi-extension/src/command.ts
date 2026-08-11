// /factorynote 명령 핸들러 + plan 모드 세션 상태(토글·auto-advance·feedback 수준).
// 세션 내 메모리 상태는 이 모듈이 소유 — index.ts(등록) 가 읽어 도구/훅에 반영.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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

export function isPlanMode(): boolean {
	return planMode;
}

export function isAutoAdvance(): boolean {
	return autoAdvance;
}

export function currentFeedbackLevel(): FeedbackLevel {
	return feedbackLevel;
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

/** /factorynote 명령 등록(on|off · auto · feedback <level>). */
export function registerFactoryNoteCommand(pi: ExtensionAPI): void {
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
}
