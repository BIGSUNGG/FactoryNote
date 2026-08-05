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

test("full pipeline 1->3 completes", () => {
	let s = initialState("demo");
	for (
		let stage = 1 as 1 | 2 | 3;
		stage <= 3;
		stage = (stage + 1) as 1 | 2 | 3
	) {
		expect(s.stage).toBe(stage);
		expect(requiresArtifact(s.stage)).toBe(true); // 3단계 모두 산출물
		s = markArtifactReady(s);
		s = applyVerdict(s, { verdict: "confirm", comments: [] });
	}
	expect(isComplete(s)).toBe(true);
	expect(s.stage).toBe(3);
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
	const md = "# 요구사항·시나리오 명세\n\n데모 기능입니다.";
	const path = await writeArtifact(
		root,
		"rt",
		"01-understanding-and-scenarios.md",
		md,
	);
	expect(path).toContain(join(root, "rt"));
	const back = await readArtifact(
		root,
		"rt",
		"01-understanding-and-scenarios.md",
	);
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
	for (let i = 0; i < 2; i++) {
		s = applyVerdict(markArtifactReady(s), {
			verdict: "confirm",
			comments: [],
		});
	} // stage3, vt2
	s = applyVerdict(markArtifactReady(s), { verdict: "revert", comments: [] });
	expect(s.stage).toBe(2);
	expect(s.validThrough).toBe(1);
	expect(s.loopCount).toBe(0);
});

test("revert with revertTo jumps multiple stages (FR-7)", () => {
	let s = initialState("vt4");
	for (let i = 0; i < 2; i++) {
		s = applyVerdict(markArtifactReady(s), {
			verdict: "confirm",
			comments: [],
		});
	} // stage3, vt2
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
	// revertTo=3 at stage2 → clamp 상한(stage-1=1)
	s = applyVerdict(markArtifactReady(s), {
		verdict: "revert",
		comments: [],
		revertTo: 3,
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
	await writeArtifact(r, "f", "01-understanding-and-scenarios.md", "s1");
	await writeArtifact(r, "f", "02-design.json", "s2");
	await writeArtifact(r, "f", "03-implementation-plan.md", "s3");
	// afterStage=1 → delete id>1 (stages 2,3)
	await invalidateArtifactsAfter(r, "f", 1);
	expect(
		await readArtifact(r, "f", "01-understanding-and-scenarios.md"),
	).toBe("s1");
	expect(await readArtifact(r, "f", "02-design.json")).toBeUndefined();
	expect(await readArtifact(r, "f", "03-implementation-plan.md"))
		.toBeUndefined();
	await rm(r, { recursive: true, force: true });
});

// --- FR-7 validThrough 마이그레이션(D4) ---

test("loadState migrates legacy state.json missing validThrough → 0", async () => {
	const feat = "legacymig";
	await saveState(root, initialState(feat)); // 디렉토리 + state.json 생성
	const legacy = {
		feature: feat,
		stage: 3,
		gateOpen: false,
		loopCount: 2,
		done: false,
		history: [{ stage: 2, verdict: "confirm", at: 1 }],
		createdAt: 1,
		updatedAt: 2,
	}; // validThrough 의도적 누락(구 포맷)
	await writeFile(
		join(root, feat, "state.json"),
		JSON.stringify(legacy),
		"utf8",
	);
	const loaded = await loadState(root, feat);
	expect(loaded).toBeDefined();
	expect(loaded?.validThrough).toBe(0);
});

test("loadState guards non-finite validThrough (null) → 0", async () => {
	const feat = "badvt";
	await saveState(root, initialState(feat));
	// validThrough=null(비정상) 도 0 으로 마이그레이션 가드.
	await writeFile(
		join(root, feat, "state.json"),
		JSON.stringify({
			feature: feat,
			stage: 2,
			gateOpen: false,
			loopCount: 0,
			done: false,
			history: [],
			validThrough: null,
			createdAt: 1,
			updatedAt: 1,
		}),
		"utf8",
	);
	const loaded = await loadState(root, feat);
	expect(loaded?.validThrough).toBe(0);
});

test("teardown", async () => {
	await cleanup();
});
