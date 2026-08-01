// 확장 로드 스모크(계약 #6 일부) — 기본 내보내기 팩토리가 에러 없이 실행되어
// /factorynote 명령과 factorynote_plan 도구를 등록하는지 검증. pi 없이 bun 로 가능.
import { test, expect } from "bun:test";
import factorynote from "./index.ts";

test("extension factory registers command, tool, and handler", () => {
	const commands: string[] = [];
	const tools: string[] = [];
	const handlers: string[] = [];
	const mockPi = {
		registerCommand: (name: string) => commands.push(name),
		registerTool: (def: { name: string }) => tools.push(def.name),
		on: (event: string) => handlers.push(event),
	};
	// 팩토리 실행(등록 부작용). ExtensionAPI 의 일부만 모킹.
	factorynote(mockPi as unknown as Parameters<typeof factorynote>[0]);

	expect(commands).toContain("factorynote");
	expect(tools).toContain("factorynote_plan");
	expect(handlers).toContain("before_agent_start");
});
