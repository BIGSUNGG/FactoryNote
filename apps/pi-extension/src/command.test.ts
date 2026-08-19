// /factorynote 설정 대시보드(인자 없는 설정 메뉴) 자체체크.
// 서브커맨드 없음 — feedback·design·stage·auto 설정과 plan 모드 on/off 가 메뉴로만 동작.
import { beforeEach, expect, test } from "bun:test";
import { DESIGN_LEVELS, FEEDBACK_LEVELS } from "@factorynote/core";
import {
	currentDesignLevel,
	currentFeedbackLevel,
	currentStageCap,
	isAutoAdvance,
	isPlanMode,
	registerFactoryNoteCommand,
	resetSessionForTest,
} from "./command.ts";

type Handler = (
	args: string | undefined,
	ctx: {
		hasUI: boolean;
		ui: {
			select: (
				title: string,
				options: readonly string[],
			) => Promise<string | undefined>;
			notify: (message: string, kind: string) => void;
		};
	},
) => Promise<void>;

let handler: Handler;

function register(): void {
	registerFactoryNoteCommand({
		registerCommand: (
			_name: string,
			def: { description: string; handler: Handler },
		) => {
			handler = def.handler;
		},
	} as never);
}

/** 스크립트된 select 응답 순서대로 메뉴를 조작하는 가짜 명령 컨텍스트. */
function makeCtx(selects: readonly (string | undefined)[]) {
	const queue = [...selects];
	const notifications: string[] = [];
	return {
		notifications,
		ctx: {
			hasUI: true,
			ui: {
				select: async () => queue.shift(),
				notify: (message: string) => {
					notifications.push(message);
				},
			},
		},
	};
}

beforeEach(() => {
	resetSessionForTest();
	register();
});

test("설정 대시보드: confirm → plan 모드 ON", async () => {
	const { ctx } = makeCtx(["confirm — 현재 설정으로 plan 모드 ON"]);
	await handler(undefined, ctx);
	expect(isPlanMode()).toBe(true);
});

test("설정 대시보드: cancel/Esc → plan 모드 미변경(OFF 유지)", async () => {
	const { ctx } = makeCtx([undefined]);
	await handler(undefined, ctx);
	expect(isPlanMode()).toBe(false);
	const cancel = makeCtx(["cancel — 변경 없이 끝내기"]);
	await handler(undefined, cancel.ctx);
	expect(isPlanMode()).toBe(false);
});

test("설정 대시보드: feedback 수준 선택 → 세션 반영", async () => {
	const { ctx } = makeCtx([
		"feedback — 검토 수준 (현재: medium)",
		`high — ${FEEDBACK_LEVELS.high.label}`,
		"confirm — 현재 설정으로 plan 모드 ON",
	]);
	await handler(undefined, ctx);
	expect(currentFeedbackLevel()).toBe("high");
	expect(isPlanMode()).toBe(true);
});

test("설정 대시보드: design 위성 수준 선택 → 세션 반영", async () => {
	const { ctx } = makeCtx([
		"design — design 위성 수준 (현재: low)",
		`medium — ${DESIGN_LEVELS.medium.label}`,
		"confirm — 현재 설정으로 plan 모드 ON",
	]);
	await handler(undefined, ctx);
	expect(currentDesignLevel()).toBe("medium");
});

test("designLevel: 도구 파라미터 미지정 시 세션 설정(기본 low) 사용", async () => {
	// 기본값 — low(현행 단일 에이전트 동작).
	expect(currentDesignLevel()).toBe("low");
	// 메뉴로 high 설정 후 세션 값이 기본값으로 쓰인다(index.ts 가 currentDesignLevel 주입).
	const { ctx } = makeCtx([
		"design — design 위성 수준 (현재: low)",
		`high — ${DESIGN_LEVELS.high.label}`,
		"cancel — 변경 없이 끝내기",
	]);
	await handler(undefined, ctx);
	expect(currentDesignLevel()).toBe("high");
});

test("설정 대시보드: stage 상한 선택 → 세션 반영, 무제한 해제 가능", async () => {
	const { ctx } = makeCtx([
		"stage — 최대 스테이지 개수 상한 (현재: 무제한)",
		"3 — 최대 3개 스테이지",
		"stage — 최대 스테이지 개수 상한 (현재: 3)",
		"무제한 — 상한 없음",
		"cancel — 변경 없이 끝내기",
	]);
	await handler(undefined, ctx);
	// 무제한 해제 후 최종 null — 중간값(3) 반영은 stage 메뉴 재진입 라벨로 확인됨.
	expect(currentStageCap()).toBe(null);
	const setOnly = makeCtx([
		"stage — 최대 스테이지 개수 상한 (현재: 무제한)",
		"2 — 최대 2개 스테이지",
		"cancel — 변경 없이 끝내기",
	]);
	await handler(undefined, setOnly.ctx);
	expect(currentStageCap()).toBe(2);
});

test("설정 대시보드: auto 항목은 선택마다 토글", async () => {
	const { ctx } = makeCtx([
		"auto — 게이트 자동 승인 (현재: OFF)",
		"auto — 게이트 자동 승인 (현재: ON ⚠)",
		"cancel — 변경 없이 끝내기",
	]);
	await handler(undefined, ctx);
	expect(isAutoAdvance()).toBe(false);
	const once = makeCtx([
		"auto — 게이트 자동 승인 (현재: OFF)",
		"cancel — 변경 없이 끝내기",
	]);
	await handler(undefined, once.ctx);
	expect(isAutoAdvance()).toBe(true);
});

test("설정 대시보드: plan 모드 ON 상태에서 off 항목으로 해제", async () => {
	const on = makeCtx(["confirm — 현재 설정으로 plan 모드 ON"]);
	await handler(undefined, on.ctx);
	expect(isPlanMode()).toBe(true);
	const off = makeCtx(["off — plan 모드 OFF"]);
	await handler(undefined, off.ctx);
	expect(isPlanMode()).toBe(false);
});

test("설정 대시보드: plan 모드 ON 상태 유지하고 나가기(close)", async () => {
	const on = makeCtx(["confirm — 현재 설정으로 plan 모드 ON"]);
	await handler(undefined, on.ctx);
	const keep = makeCtx(["close — 현재 설정 유지하고 나가기 (plan 모드 유지)"]);
	await handler(undefined, keep.ctx);
	expect(isPlanMode()).toBe(true);
});

test("UI 없는 환경 폴백: /factorynote 호출마다 모드 토글", async () => {
	const notifications: string[] = [];
	const ctx = {
		hasUI: false,
		ui: {
			select: async () => undefined,
			notify: (message: string) => {
				notifications.push(message);
			},
		},
	};
	await handler(undefined, ctx);
	expect(isPlanMode()).toBe(true);
	await handler(undefined, ctx);
	expect(isPlanMode()).toBe(false);
	expect(notifications.length).toBe(2);
});
