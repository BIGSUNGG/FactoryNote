// Engine + Persistence 자체체크(LLM 불필요, 계약 검증 #2).
// 실행: bun test packages/factorynote
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import {
	applyVerdict,
	atLoopCeiling,
	initialState,
	invalidateArtifactsAfter,
	isComplete,
	loadState,
	MAX_LOOPS,
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

// --- FR-7 다단계 회귀 + validThrough ---

test("validThrough starts 0 and advances on confirm", () => {
	const s0 = initialState("vt");
	expect(s0.validThrough).toBe(0);
	const s1 = applyVerdict(markArtifactReady(s0), {
		verdict: "confirm",
		comments: [],
	});
	expect(s1.stage).toBe(2);
	expect(s1.validThrough).toBe(1);
});

test("modify keeps validThrough unchanged", () => {
	let s = applyVerdict(markArtifactReady(initialState("vt2")), {
		verdict: "confirm",
		comments: [],
	}); // stage2, vt1
	s = applyVerdict(markArtifactReady(s), {
		verdict: "modify",
		comments: [{ text: "더 구체적으로" }],
	});
	expect(s.stage).toBe(2);
	expect(s.validThrough).toBe(1);
});

test("revert without revertTo steps back one, decreases validThrough", () => {
	let s = initialState("vt3");
	for (let i = 0; i < 3; i++) {
		s = applyVerdict(markArtifactReady(s), {
			verdict: "confirm",
			comments: [],
		});
	} // stage4, vt3
	s = applyVerdict(markArtifactReady(s), { verdict: "revert", comments: [] });
	expect(s.stage).toBe(3);
	expect(s.validThrough).toBe(2);
	expect(s.loopCount).toBe(0);
});

test("revert with revertTo jumps multiple stages (FR-7)", () => {
	let s = initialState("vt4");
	for (let i = 0; i < 4; i++) {
		s = applyVerdict(markArtifactReady(s), {
			verdict: "confirm",
			comments: [],
		});
	} // stage5, vt4
	s = applyVerdict(markArtifactReady(s), {
		verdict: "revert",
		comments: [],
		revertTo: 1,
	});
	expect(s.stage).toBe(1);
	expect(s.validThrough).toBe(0);
	expect(s.loopCount).toBe(0);
});

test("revertTo clamped to stage-1 (cannot jump forward)", () => {
	let s = initialState("vt5");
	s = applyVerdict(markArtifactReady(s), { verdict: "confirm", comments: [] }); // stage2, vt1
	// revertTo=5 at stage2 → clamp 상한(stage-1=1)
	s = applyVerdict(markArtifactReady(s), {
		verdict: "revert",
		comments: [],
		revertTo: 5,
	});
	expect(s.stage).toBe(1);
	expect(s.validThrough).toBe(0);
});

test("revert at stage 1 is a no-op on stage (clamp boundary)", () => {
	const s1 = applyVerdict(markArtifactReady(initialState("vt6")), {
		verdict: "revert",
		comments: [],
	});
	expect(s1.stage).toBe(1);
	expect(s1.validThrough).toBe(0);
});

// --- FR-2 반복 상한 ---

test("atLoopCeiling true at/above MAX_LOOPS, false below", () => {
	const base = initialState("loop");
	expect(atLoopCeiling(base)).toBe(false);
	expect(atLoopCeiling({ ...base, loopCount: MAX_LOOPS - 1 })).toBe(false);
	expect(atLoopCeiling({ ...base, loopCount: MAX_LOOPS })).toBe(true);
	expect(atLoopCeiling({ ...base, loopCount: MAX_LOOPS + 1 })).toBe(true);
	expect(atLoopCeiling({ ...base, loopCount: 2 }, 2)).toBe(true);
	expect(atLoopCeiling({ ...base, loopCount: 1 }, 2)).toBe(false);
});

// --- FR-7 산출물 자동 무효화 ---

test("invalidateArtifactsAfter deletes artifacts after stage (FR-7)", async () => {
	const r = await mkdtemp(join(tmpdir(), "fn-inv-"));
	await writeArtifact(r, "f", "01-requirements.md", "s1");
	await writeArtifact(r, "f", "02-scenarios.md", "s2");
	await writeArtifact(r, "f", "03-modules.json", "s3");
	await writeArtifact(r, "f", "04-classes.json", "s4");
	await writeArtifact(r, "f", "05-implementation-plan.md", "s5");
	// afterStage=2 → delete id>2 (stages 3,4,5)
	await invalidateArtifactsAfter(r, "f", 2);
	expect(await readArtifact(r, "f", "01-requirements.md")).toBe("s1");
	expect(await readArtifact(r, "f", "02-scenarios.md")).toBe("s2");
	expect(await readArtifact(r, "f", "03-modules.json")).toBeUndefined();
	expect(await readArtifact(r, "f", "04-classes.json")).toBeUndefined();
	expect(
		await readArtifact(r, "f", "05-implementation-plan.md"),
	).toBeUndefined();
	await rm(r, { recursive: true, force: true });
});

test("teardown", async () => {
	await cleanup();
});
