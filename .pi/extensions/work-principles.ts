/**
 * work-principles — reminder hook for the 4 working principles (ADR-028).
 *
 * Only the docs-first principle (principle 3) is mechanically decidable,
 * so only it gets a hook: when a run changed code files via write-type
 * tools but never touched doc files, notify at agent_settled to check
 * doc updates. Never blocks.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Doc-file detection patterns — adjust only here on false positives (ADR-028). */
const DOC_PATTERNS: RegExp[] = [
	/(^|[\\/])vault[\\/]/i,
	/AGENTS\.md$/i,
	/README\.md$/i,
	/(^|[\\/])\.pi[\\/]skills[\\/]/i,
];

/** Write-type tools that carry a file path. bash is excluded (target unclear). */
const WRITE_TOOLS = new Set(["write", "edit"]);

function isDocPath(path: string | undefined): boolean {
	return !!path && DOC_PATTERNS.some((re) => re.test(path));
}

export default function (pi: ExtensionAPI) {
	let codeTouched = false;
	let docsTouched = false;

	pi.on("agent_start", () => {
		codeTouched = false;
		docsTouched = false;
	});

	pi.on("tool_call", (event) => {
		if (!WRITE_TOOLS.has(event.toolName)) return;
		const path = (event.input as { path?: string }).path;
		if (!path) return;
		if (isDocPath(path)) docsTouched = true;
		else codeTouched = true;
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (codeTouched && !docsTouched) {
			ctx.ui.notify(
				"Docs-first check: code changed but no doc changes detected. Review Changelog · Dev-Log · related docs (doc-workflow skill).",
				"warning",
			);
		}
	});
}
