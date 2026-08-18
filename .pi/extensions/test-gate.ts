/**
 * test-gate — 테스트 통과 전 작업 종료 불가 게이트 (ADR-029).
 *
 * agent_settled(에이전트 실행이 완전히 끝난 시점)에서 `bun test`를 실행한다.
 * 실패하면 에이전트에게 실패 요약과 함께 수정 지시를 주입(pi.sendUserMessage)해
 * 작업을 계속시키고, 통과해야만 비로소 작업이 끝난다.
 * 수정 지시는 MAX_FIX_ATTEMPTS 회수로 제한 — 초과 시 사용자에게 에스컬레이션.
 *
 * 알려진 한계: 사용자 중단(abort) 직후에도 게이트가 돈다(중단 판별 API 부재).
 */
import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 실행할 테스트 명령(AGENTS.md 기준). 오탐·확장 시 이 상수만 조정. */
const TEST_COMMAND = "bun test";
/** 자동 수정 지시 최대 횟수. 초과 시 사용자에게 에스컬레이션. */
const MAX_FIX_ATTEMPTS = 3;
/** 주입 메시지에 붙일 실패 출력 최대 길이(토큰 보호). */
const MAX_OUTPUT_CHARS = 4000;
/** 테스트 실행 타임아웃(ms). */
const TEST_TIMEOUT_MS = 300_000;

interface TestResult {
	ok: boolean;
	output: string;
}

function runTests(cwd: string): TestResult {
	try {
		execSync(TEST_COMMAND, {
			cwd,
			stdio: "pipe",
			encoding: "utf8",
			timeout: TEST_TIMEOUT_MS,
		});
		return { ok: true, output: "" };
	} catch (err) {
		const e = err as { stdout?: string; stderr?: string; message?: string };
		const raw = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
		return { ok: false, output: raw.slice(-MAX_OUTPUT_CHARS) };
	}
}

export default function (pi: ExtensionAPI) {
	/** 연속 게이트 실패 횟수. 통과 시 초기화. */
	let failures = 0;

	pi.on("agent_settled", (_event, ctx) => {
		const result = runTests(ctx.cwd);

		if (result.ok) {
			if (failures > 0) {
				ctx.ui.notify("test-gate: 테스트 통과 — 작업을 종료합니다.", "info");
			}
			failures = 0;
			return;
		}

		failures += 1;
		if (failures > MAX_FIX_ATTEMPTS) {
			failures = 0; // 다음 사용자 요청에서 새 시도 예산
			ctx.ui.notify(
				`test-gate: ${MAX_FIX_ATTEMPTS}회 수정 시도 후에도 테스트 실패. 수동 확인이 필요합니다.`,
				"error",
			);
			return;
		}

		ctx.ui.notify(
			`test-gate: 테스트 실패 (${failures}/${MAX_FIX_ATTEMPTS}) — 수정 지시 주입.`,
			"warning",
		);
		pi.sendUserMessage(
			[
				"[test-gate] 작업 종료 전 `bun test`가 실패했습니다. 통과해야만 작업이 끝납니다.",
				"실패 원인을 고치고 테스트를 통과시켜 주세요. (아래는 실패 출력 끝부분)",
				"```text",
				result.output,
				"```",
			].join("\n"),
		);
	});
}
