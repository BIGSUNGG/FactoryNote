// scrollbar 마커 지오메트리 자체체크 — 문서 첫/끝 블록 변경 시 마커가 트랙 양단에 정착.
// 실행: bun test apps/plan-viewer
import { expect, test } from "bun:test";
import { markGeom, trackHeight } from "./scrollbar";

const ENV = { total: 2000, client: 400, padTop: 32, padBottom: 32 };

test("첫 블록 변경 → 마커 상단이 트랙 최상단(0)", () => {
	const g = markGeom(32, 100, ENV); // offsetTop = padTop
	expect(g.top).toBe(0);
});

test("마지막 블록 변경 → 마커 하단이 트랙 최하단(track)", () => {
	const h = 120;
	const g = markGeom(2000 - 32 - h, h, ENV); // 하단 = total - padBottom
	expect(g.top + g.h).toBe(trackHeight(ENV.client));
});

test("중간 블록은 콘텐츠 박스 비율 위치 + 트랙 내 클램프", () => {
	const track = trackHeight(ENV.client); // 396
	const contentH = 2000 - 64; // 1936
	const g = markGeom(32 + 968, 100, ENV); // 콘텐츠 중앙
	expect(Math.round(g.top)).toBe(Math.round((968 / contentH) * track));
	// 최소 높이 3px 강제분도 트랙을 넘지 않음
	const bottom = markGeom(2000 - 32 - 1, 1, ENV);
	expect(bottom.top + bottom.h).toBeLessThanOrEqual(track);
});
