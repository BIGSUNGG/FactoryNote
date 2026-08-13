// activeHeading scroll-spy 자체체크.
import { test, expect } from "bun:test";
import { activeHeadingId } from "./activeHeading.js";

const H = (id, top) => ({ id, top });

test("빈 헤딩 목록 → null", () => {
	expect(activeHeadingId([], 0)).toBeNull();
});

test("최상단(scrollTop 0)이고 첫 헤딩이 기준선 아래 → 첫 헤딩 fallback", () => {
	const hs = [H("b0", 200), H("b3", 800), H("b7", 1500)];
	expect(activeHeadingId(hs, 0, 80)).toBe("b0");
});

test("첫 헤딩이 기준선 위로 올라가면 여전히 첫 헤딩", () => {
	const hs = [H("b0", 200), H("b3", 800)];
	expect(activeHeadingId(hs, 150, 80)).toBe("b0"); // 150+80=230 ≥ 200
});

test("두 번째 헤딩까지 기준선 통과 → 두 번째", () => {
	const hs = [H("b0", 200), H("b3", 800), H("b7", 1500)];
	expect(activeHeadingId(hs, 750, 80)).toBe("b3"); // 750+80=830 ≥ 800
});

test("마지막 헤딩 아래까지 스크롤 → 마지막 헤딩 유지", () => {
	const hs = [H("b0", 200), H("b3", 800), H("b7", 1500)];
	expect(activeHeadingId(hs, 5000, 80)).toBe("b7");
});

test("오프셋이 클수록 더 아래 헤딩을 기준선 통과로 본다", () => {
	const hs = [H("b0", 200), H("b3", 800)];
	// offset 0: scrollTop 720 → 720 ≥ 200 통과, 720 < 800 미통과 → b0
	expect(activeHeadingId(hs, 720, 0)).toBe("b0");
	// offset 100: 720+100=820 ≥ 800 통과 → b3
	expect(activeHeadingId(hs, 720, 100)).toBe("b3");
});

test("결정성: 같은 입력 → 같은 출력", () => {
	const hs = [H("b0", 100), H("b2", 400)];
	const a = activeHeadingId(hs, 300, 80);
	const b = activeHeadingId(hs, 300, 80);
	expect(a).toBe(b);
});
