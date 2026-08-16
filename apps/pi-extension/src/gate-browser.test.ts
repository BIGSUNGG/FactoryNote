import { describe, expect, test } from "bun:test";
import { browserCommand } from "./gate-browser.ts";

describe("browserCommand", () => {
	test("localhost URL 은 플랫폼별 인자 배열 커맨드로 변환", () => {
		expect(browserCommand("darwin", "http://localhost:3456")).toEqual({
			command: "open",
			args: ["http://localhost:3456"],
		});
		expect(browserCommand("linux", "http://127.0.0.1:3456")).toEqual({
			command: "xdg-open",
			args: ["http://127.0.0.1:3456"],
		});
	});

	test("win32 는 cmd /c start 내장 명령 경유(인자 배열, 셸 문자열 아님)", () => {
		expect(browserCommand("win32", "http://localhost:3456")).toEqual({
			command: "cmd",
			args: ["/c", "start", "", "http://localhost:3456"],
		});
	});

	test("포트 없는 형태도 허용", () => {
		expect(browserCommand("darwin", "http://localhost")).not.toBeNull();
	});

	test("외부 호스트 URL 은 거부(null)", () => {
		expect(browserCommand("darwin", "http://evil.example.com:3456")).toBeNull();
		expect(browserCommand("win32", "https://localhost:3456")).toBeNull();
		expect(browserCommand("linux", "http://0.0.0.0:3456")).toBeNull();
	});

	test("명령 주입 페이로드는 정규식 단계에서 거부", () => {
		expect(browserCommand("win32", 'http://localhost:1" & calc')).toBeNull();
		expect(browserCommand("linux", "http://localhost; rm -rf /")).toBeNull();
		expect(browserCommand("linux", "http://$(reboot)@localhost:1")).toBeNull();
	});

	test("반환 값은 항상 인자 배열 — 셸 문자열 조립 경로 없음", () => {
		const spec = browserCommand("win32", "http://localhost:1");
		expect(Array.isArray(spec?.args)).toBe(true);
	});
});
