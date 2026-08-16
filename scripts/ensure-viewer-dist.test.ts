// ensure-viewer-dist staleness 판정 회귀 가드.
// 낡은 dist 로 그래프가 안 보였던 버그(repro-graph-kinds) 의 재발 방지:
// 판정 로직(null 처리·strict less-than) 이 뒤바뀌면 여기서 잡힌다.
import { expect, test } from "bun:test";
import { viewerDistIsStale } from "./ensure-viewer-dist.ts";

test("dist 없음(null) → 항상 stale(재빌드 필요)", () => {
	expect(viewerDistIsStale(null, 0)).toBe(true);
	expect(viewerDistIsStale(null, 1_000_000)).toBe(true);
});

test("dist 가 소스보다 새로우면 fresh(no-op)", () => {
	expect(viewerDistIsStale(2_000, 1_000)).toBe(false);
});

test("dist 가 소스보다 오래됐으면 stale(재빌드)", () => {
	expect(viewerDistIsStale(1_000, 2_000)).toBe(true);
});

test("dist == 소스 mtime 이면 fresh(같은 순간은 낡지 않음)", () => {
	expect(viewerDistIsStale(1_000, 1_000)).toBe(false);
});
