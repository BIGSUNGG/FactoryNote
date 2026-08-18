/**
 * test-gate — no work ends until tests pass (ADR-029).
 *
 * At agent_settled (the point where pi will not auto-continue), runs
 * `bun test`. On failure, injects a fix instruction with the failure
 * summary via pi.sendUserMessage so the agent keeps working; work only
 * ends when tests pass. Fix instructions are capped at MAX_FIX_ATTEMPTS —
 * beyond that, escalate to the user.
 *
 * Known limitation: the gate also runs right after a user abort
 * (no abort-detection API available).
 */
import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Test command (per AGENTS.md). Adjust only this constant to change. */
const TEST_COMMAND = "bun test";
/** Max auto fix instructions before escalating to the user. */
const MAX_FIX_ATTEMPTS = 3;
/** Max failure output chars attached to the injected message (token guard). */
const MAX_OUTPUT_CHARS = 4000;
/** Test run timeout (ms). */
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
	/** Consecutive gate failures. Reset on pass. */
	let failures = 0;

	pi.on("agent_settled", (_event, ctx) => {
		const result = runTests(ctx.cwd);

		if (result.ok) {
			if (failures > 0) {
				ctx.ui.notify("test-gate: tests passed — work may end.", "info");
			}
			failures = 0;
			return;
		}

		failures += 1;
		if (failures > MAX_FIX_ATTEMPTS) {
			failures = 0; // fresh attempt budget for the next user request
			ctx.ui.notify(
				`test-gate: tests still failing after ${MAX_FIX_ATTEMPTS} fix attempts. Manual attention needed.`,
				"error",
			);
			return;
		}

		ctx.ui.notify(
			`test-gate: tests failed (${failures}/${MAX_FIX_ATTEMPTS}) — injecting fix instruction.`,
			"warning",
		);
		pi.sendUserMessage(
			[
				"[test-gate] `bun test` failed before work could end. Work only ends when tests pass.",
				"Fix the failures and make the tests pass. (Failure output tail below)",
				"```text",
				result.output,
				"```",
			].join("\n"),
		);
	});
}
