/**
 * viewer-test-viewer — reminder hook for principle 3 (Docs first, ADR-031).
 *
 * Sub-rule: when work changes anything user-visible in the plan viewer
 * (rendering · UI · layout · sample documents), the test viewer demo
 * (`apps/plan-viewer/dev/mock-api.js` scenarios · `apps/plan-viewer/src/data/*.md`
 * sample docs) must be updated in the same session so the user can verify via
 * `cd apps/plan-viewer && bun run dev` (port 5180).
 *
 * "User-visible" is ultimately a judgment call, so — like work-principles.ts
 * (ADR-028) — this only reminds, never blocks: when viewer code files were
 * written/edited but no test-viewer demo file was touched, notify at
 * agent_settled to check the demo. `src/data/` counts as demo (not viewer code);
 * `dev/` counts as demo too. Adjust patterns below on false positives (ADR-031).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Viewer code paths (what the user sees is built from these) — `src/data/` excluded (those are demo fixtures). */
const VIEWER_CODE_PATTERNS: RegExp[] = [
	/(^|[\\/])apps[\\/]plan-viewer[\\/]src[\\/](?!data[\\/])/,
	/(^|[\\/])apps[\\/]plan-viewer[\\/]vite\.config\.js$/,
];

/** Test-viewer demo paths — updating these makes the demo reflect a visible change. */
const TEST_VIEWER_PATTERNS: RegExp[] = [
	/(^|[\\/])apps[\\/]plan-viewer[\\/]dev[\\/]/,
	/(^|[\\/])apps[\\/]plan-viewer[\\/]src[\\/]data[\\/]/,
];

/** Write-type tools that carry a file path. bash is excluded (target unclear). */
const WRITE_TOOLS = new Set(["write", "edit"]);

function matchesAny(path: string | undefined, patterns: RegExp[]): boolean {
	return !!path && patterns.some((re) => re.test(path));
}

export default function (pi: ExtensionAPI) {
	let viewerCodeTouched = false;
	let testViewerTouched = false;

	pi.on("agent_start", () => {
		viewerCodeTouched = false;
		testViewerTouched = false;
	});

	pi.on("tool_call", (event) => {
		if (!WRITE_TOOLS.has(event.toolName)) return;
		const path = (event.input as { path?: string }).path;
		if (!path) return;
		if (matchesAny(path, TEST_VIEWER_PATTERNS)) testViewerTouched = true;
		else if (matchesAny(path, VIEWER_CODE_PATTERNS)) viewerCodeTouched = true;
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (viewerCodeTouched && !testViewerTouched) {
			ctx.ui.notify(
				"Viewer check (principle 3, ADR-031): viewer code changed but the test viewer (apps/plan-viewer/dev · src/data) was not. If the change is user-visible, update the demo and verify with `cd apps/plan-viewer && bun run dev`.",
				"warning",
			);
		}
	});
}
