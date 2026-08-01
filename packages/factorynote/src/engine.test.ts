// Engine + Persistence 자체체크(LLM 불필요, 계약 검증 #2).
// 실행: bun test packages/factorynote
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import {
	applyVerdict,
	initialState,
	isComplete,
	loadState,
	markArtifactReady,
	readArtifact,
	requiresArtifact,
	saveState,
	writeArtifact,
} from "./index.ts";

let root: string;
let cleanup: () => Promise<void>;

test("setup temp .factorynote root", async () => {
	root = await mkdtemp(join(tmpdir(), "factorynote-test-"));
	cleanup = async () => {
		await rm(root, { recursive: true, force: true });
	};
});

test("confirm advances stage and closes gate", () => {
	let s = initialState("demo");
	expect(s.stage).toBe(1);
	expect(s.gateOpen).toBe(false);
	s = markArtifactReady(s);
	expect(s.gateOpen).toBe(true);
	s = applyVerdict(s, { verdict: "confirm", comments: [] });
	expect(s.stage).toBe(2);
	expect(s.gateOpen).toBe(false);
	expect(s.loopCount).toBe(0);
});

test("full pipeline 1->6 completes", () => {
	let s = initialState("demo");
	for (
		let stage = 1 as 1 | 2 | 3 | 4 | 5 | 6;
		stage <= 6;
		stage = (stage + 1) as 1 | 2 | 3 | 4 | 5 | 6
	) {
		expect(s.stage).toBe(stage);
		expect(requiresArtifact(s.stage)).toBe(stage < 6);
		s = markArtifactReady(s);
		s = applyVerdict(s, { verdict: "confirm", comments: [] });
	}
	expect(isComplete(s)).toBe(true);
	expect(s.stage).toBe(6);
});

test("modify keeps stage, bumps loopCount, closes gate", () => {
	let s = initialState("demo");
	s = markArtifactReady(s);
	s = applyVerdict(s, { verdict: "confirm", comments: [] }); // ->2
	s = markArtifactReady(s);
	s = applyVerdict(s, {
		verdict: "modify",
		comments: [{ text: "더 구체적으로" }],
	});
	expect(s.stage).toBe(2);
	expect(s.gateOpen).toBe(false);
	expect(s.loopCount).toBe(1);
});

test("revert steps back one stage", () => {
	let s = initialState("demo");
	s = applyVerdict(markArtifactReady(s), { verdict: "confirm", comments: [] }); // ->2
	s = applyVerdict(markArtifactReady(s), { verdict: "confirm", comments: [] }); // ->3
	s = applyVerdict(markArtifactReady(s), {
		verdict: "revert",
		comments: [],
	});
	expect(s.stage).toBe(2);
	expect(s.loopCount).toBe(0);
});

test("state atomic save/load round-trip", async () => {
	const s = applyVerdict(markArtifactReady(initialState("rt")), {
		verdict: "confirm",
		comments: [],
	});
	await saveState(root, s);
	const loaded = await loadState(root, "rt");
	expect(loaded).toEqual(s);
});

test("artifact write/read round-trip", async () => {
	const md = "# 요구사항 명세\n\n데모 기능입니다.";
	const path = await writeArtifact(root, "rt", "01-requirements.md", md);
	expect(path).toContain(join(root, "rt"));
	const back = await readArtifact(root, "rt", "01-requirements.md");
	expect(back).toBe(md);
});

test("corrupt state recovers to undefined", async () => {
	await saveState(root, initialState("bad"));
	// 손상된 내용 직접 덮어쓰기(atomic 우회 — 복구 경로 시뮬레이션).
	const sp = join(root, "bad", "state.json");
	await writeFile(sp, "{ not valid json", "utf8");
	const loaded = await loadState(root, "bad");
	expect(loaded).toBeUndefined();
});

test("missing state returns undefined", async () => {
	const loaded = await loadState(root, "never-started");
	expect(loaded).toBeUndefined();
});

test("teardown", async () => {
	await cleanup();
});
