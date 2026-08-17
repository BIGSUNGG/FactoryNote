// blockDiff 자체체크(ADR-027 변경 하이라이트) — prev↔현재 블록 diff 마킹.
// 실행: bun test apps/plan-viewer
import { test, expect } from "bun:test";
import { mdToBlocks } from "./mdToBlocks";
import { blockKey, diffBlockChanges, diffChangedBlockIds } from "./blockDiff";

test("동일 문서는 변경 블록 없음", () => {
	const md = "# 제목\n\n첫 문단.\n\n- 항목\n";
	const blocks = mdToBlocks(md);
	expect(diffChangedBlockIds(blocks, blocks).size).toBe(0);
});

test("수정된 블록만 마킹 — 나머지는 매칭", () => {
	const prev = mdToBlocks("# 제목\n\n원래 문단.\n\n마지막 문단.\n");
	const next = mdToBlocks("# 제목\n\n고쳐진 문단.\n\n마지막 문단.\n");
	const changed = diffChangedBlockIds(prev, next);
	expect(changed.size).toBe(1);
	expect(changed.has(next[1].id)).toBe(true); // 수정된 문단
	expect(changed.has(next[0].id)).toBe(false); // 헤딩 유지
	expect(changed.has(next[2].id)).toBe(false); // 마지막 문단 유지
});

test("추가된 블록 마킹 — 기존 블록은 그대로", () => {
	const prev = mdToBlocks("# 제목\n\n문단 A.\n");
	const next = mdToBlocks("# 제목\n\n문단 A.\n\n새 문단 B.\n");
	const changed = diffChangedBlockIds(prev, next);
	expect([...changed]).toEqual([next[2].id]);
});

test("삭제된 블록은 마킹 없음 — 나머지 매칭 유지", () => {
	const prev = mdToBlocks("# 제목\n\n지울 문단.\n\n남는 문단.\n");
	const next = mdToBlocks("# 제목\n\n남는 문단.\n");
	const changed = diffChangedBlockIds(prev, next);
	expect(changed.size).toBe(0);
});

test("prev 없으면(최초 작성) 전부 신규 — 호출측이 생략하므로 빈 prev 기준 동작만 확인", () => {
	const next = mdToBlocks("# 새 문서\n\n내용.\n");
	const changed = diffChangedBlockIds([], next);
	expect(changed.size).toBe(2);
});

test("blockKey: 같은 내용 같은 키, 다른 내용 다른 키", () => {
	const a = mdToBlocks("## 섹션\n\n본문.\n")[0];
	const b = mdToBlocks("## 섹션\n\n본문.\n")[0];
	const c = mdToBlocks("## 다른 섹션\n\n본문.\n")[0];
	expect(blockKey(a)).toBe(blockKey(b));
	expect(blockKey(a)).not.toBe(blockKey(c));
});

test("리스트·표·코드 블록도 콘텐츠 기준으로 감지", () => {
	const prev = mdToBlocks("- a\n- b\n\n```js\nconst x = 1;\n```\n");
	const next = mdToBlocks("- a\n- c\n\n```js\nconst x = 1;\n```\n");
	const changed = diffChangedBlockIds(prev, next);
	expect(changed.size).toBe(1); // 리스트만 변경, 코드는 동일
	expect(changed.has(next[0].id)).toBe(true);
});

test("diffBlockChanges: 순수 추가는 added, 수정은 changed 만", () => {
	// 중간 삽입 → 추가
	const prev = mdToBlocks("# 제목\n\n문단 A.\n");
	const next = mdToBlocks("# 제목\n\n새 문단.\n\n문단 A.\n");
	const ins = diffBlockChanges(prev, next);
	expect([...ins.added]).toEqual([next[1].id]);
	expect(ins.changed.has(next[1].id)).toBe(true); // added ⊂ changed

	// 수정만 → added 비움
	const mod = diffBlockChanges(
		mdToBlocks("# 제목\n\n원래.\n"),
		mdToBlocks("# 제목\n\n고침.\n"),
	);
	expect(mod.added.size).toBe(0);
	expect(mod.changed.size).toBe(1);
});

test("diffBlockChanges: 수정+추가 혼합 — 짝짓기 후 남는 new 가 added", () => {
	// prev [B] → next [B', C]: B' 는 수정(짝), C 는 추가
	const prev = mdToBlocks("원래 문단.\n");
	const next = mdToBlocks("고친 문단.\n\n새 문단.\n");
	const { changed, added } = diffBlockChanges(prev, next);
	expect(changed.size).toBe(2);
	expect([...added]).toEqual([next[1].id]);
});

test("diffBlockChanges: 상단 삽입+하단 수정 동시 — 색 뒤바뀜 회귀(두 번째 재작성)", () => {
	// prev [배너1, 본문, 하단A] → next [배너2, 배너1, 본문, 하단B]
	// 상단 삽입 = added(연두), 하단 수정 = changed 만(주황) — 순서 소비 방식이라면
	// 상단 삽입이 하단 prev 를 가로채 색이 뒤바뀌던 버그 회귀 검증.
	const prev = mdToBlocks("> 배너1\n\n본문.\n\n하단 A\n");
	const next = mdToBlocks("> 배너2\n\n> 배너1\n\n본문.\n\n하단 B\n");
	const { changed, added } = diffBlockChanges(prev, next);
	expect(changed.size).toBe(2);
	expect([...added]).toEqual([next[0].id]); // 상단 삽입만 added
	expect(added.has(next[3].id)).toBe(false); // 하단 수정은 added 아님
});
