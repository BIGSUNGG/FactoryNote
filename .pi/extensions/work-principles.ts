/**
 * work-principles — 4대 작업 원칙 리마인더 훅 (ADR-028).
 *
 * 문서주의(원칙 3)만 기계적으로 판정 가능하여 훅으로 리마인드한다:
 * 쓰기류 도구로 코드 파일을 변경했는데 문서 파일 변경이 없는 실행이
 * 종료되면(agent_settled) 문서 갱신 확인 알림을 띄운다. 차단 없음.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 문서 파일 판정 기준 — 오탐 시 여기만 수정 (ADR-028 결과 조항). */
const DOC_PATTERNS: RegExp[] = [
	/(^|[\\/])vault[\\/]/i,
	/AGENTS\.md$/i,
	/README\.md$/i,
	/(^|[\\/])\.pi[\\/]skills[\\/]/i,
];

/** 파일 경로를 받는 쓰기류 도구. bash는 변경 대상이 불명확해 제외. */
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
				"문서주의 점검: 코드가 변경되었는데 문서 변경이 감지되지 않았습니다. Changelog·Dev-Log·관련 문서를 확인하세요 (doc-workflow 스킬).",
				"warning",
			);
		}
	});
}
