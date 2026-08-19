// Engine + Persistence 자체체크(LLM 불필요, 계약 검증 #2).
// 실행: bun test packages/factorynote
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, expect } from "bun:test";
import {
	LEGACY_KINDS,
	applyVerdict,
	atLoopCeiling,
	checkRequiredGraph,
	clearArtifactPrev,
	initialState,
	invalidateArtifactsAfter,
	isComplete,
	loadState,
	MAX_LOOPS,
	markArtifactReady,
	readArtifact,
	readArtifactPrev,
	saveState,
	stageDefAt,
	stageDefs,
	writeArtifact,
} from "./index.ts";
import type { StageKind } from "./index.ts";

/** 레거시 3종 구성 상태 팩토리(테스트 기본). */
const mkState = (feature: string) => initialState(feature, [...LEGACY_KINDS]);
const LEGACY_DEFS = stageDefs(LEGACY_KINDS);

let root: string;
let cleanup: () => Promise<void>;

test("setup temp .factorynote root", async () => {
	root = await mkdtemp(join(tmpdir(), "factorynote-test-"));
	cleanup = async () => {
		await rm(root, { recursive: true, force: true });
	};
});

test("confirm advances stage and closes gate", () => {
	let s = mkState("demo");
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
	let s = mkState("demo");
	for (let stage = 1; stage <= 3; stage++) {
		expect(s.stage).toBe(stage);
		// 구성의 모든 단계가 산출물 생성.
		expect(stageDefAt(s.stages, s.stage).producesArtifact).toBe(true);
		s = markArtifactReady(s);
		s = applyVerdict(s, { verdict: "confirm", comments: [] });
	}
	expect(isComplete(s)).toBe(true);
	expect(s.stage).toBe(3);
});

test("동적 구성: 2단계 파이프라인은 stage 2 확정으로 완료", () => {
	let s = initialState("short", ["understanding", "implementation"]);
	expect(s.stages).toEqual(["understanding", "implementation"]);
	for (let i = 0; i < 2; i++) {
		s = markArtifactReady(s);
		s = applyVerdict(s, { verdict: "confirm", comments: [] });
	}
	expect(isComplete(s)).toBe(true);
	expect(s.stage).toBe(2);
	expect(s.validThrough).toBe(2);
});

test("동적 구성: 5단계 파이프라인 전 단계 게이트 전이", () => {
	const kinds: StageKind[] = [
		"understanding",
		"design",
		"risk-analysis",
		"test-strategy",
		"implementation",
	];
	let s = initialState("long", kinds);
	for (let stage = 1; stage <= 5; stage++) {
		expect(s.stage).toBe(stage);
		expect(s.done).toBe(false);
		s = markArtifactReady(s);
		s = applyVerdict(s, { verdict: "confirm", comments: [] });
	}
	expect(isComplete(s)).toBe(true);
	expect(s.validThrough).toBe(5);
});

test("동적 구성: 중간 단계 revert 는 구성 위치 기준으로 회귀", () => {
	const kinds: StageKind[] = [
		"understanding",
		"design",
		"nfr",
		"implementation",
	];
	let s = initialState("mid", kinds);
	for (let i = 0; i < 3; i++) {
		s = markArtifactReady(s);
		s = applyVerdict(s, { verdict: "confirm", comments: [] });
	} // stage4, vt3
	s = markArtifactReady(s);
	s = applyVerdict(s, { verdict: "revert", comments: [], revertTo: 2 });
	expect(s.stage).toBe(2);
	expect(s.validThrough).toBe(1);
});

test("modify keeps stage, bumps loopCount, closes gate", () => {
	let s = mkState("demo");
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
	let s = mkState("demo");
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
	const s = applyVerdict(markArtifactReady(mkState("rt")), {
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

test("stage artifacts go to stageN/ subdirs, aux files stay at feature root", async () => {
	const p1 = await writeArtifact(
		root,
		"layout",
		"01-understanding-and-scenarios.md",
		"s1",
	);
	const p2 = await writeArtifact(root, "layout", "02-design.md", "s2");
	const p3 = await writeArtifact(
		root,
		"layout",
		"03-implementation-plan.md",
		"s3",
	);
	const aux = await writeArtifact(root, "layout", "draft.md", "d");
	expect(dirname(p1)).toBe(join(root, "layout", "stage1"));
	expect(dirname(p2)).toBe(join(root, "layout", "stage2"));
	expect(dirname(p3)).toBe(join(root, "layout", "stage3"));
	expect(dirname(aux)).toBe(join(root, "layout"));
});

test("rewrite of stage artifact snapshots previous version (.prev) — ADR-027", async () => {
	const file = "02-design.md";
	// 최초 작성 — prev 없음(뷰어는 하이라이트 생략)
	await writeArtifact(root, "prev", file, "v1");
	expect(await readArtifactPrev(root, "prev", file)).toBeUndefined();
	// 재작성 — prev = 직전 버전
	await writeArtifact(root, "prev", file, "v2");
	expect(await readArtifactPrev(root, "prev", file)).toBe("v1");
	expect(await readArtifact(root, "prev", file)).toBe("v2");
	// 확정 시 하이라이트 기준 리셋
	await clearArtifactPrev(root, "prev", file);
	expect(await readArtifactPrev(root, "prev", file)).toBeUndefined();
	// 없는 prev 삭제도 안전(no-op)
	await clearArtifactPrev(root, "prev", file);
});

test("prev snapshot only for stage artifacts — aux/graph files excluded", async () => {
	await writeArtifact(root, "prev", "design-prompt.md", "a");
	await writeArtifact(root, "prev", "design-prompt.md", "b");
	expect(
		await readArtifactPrev(root, "prev", "design-prompt.md"),
	).toBeUndefined();
});

test("invalidateArtifactsAfter also removes .prev — ADR-027", async () => {
	await writeArtifact(
		root,
		"prev-inv",
		"01-understanding-and-scenarios.md",
		"s1",
	);
	await writeArtifact(root, "prev-inv", "02-design.md", "d1");
	await writeArtifact(root, "prev-inv", "02-design.md", "d2"); // prev=d1
	await invalidateArtifactsAfter(root, "prev-inv", 1, LEGACY_DEFS);
	expect(await readArtifact(root, "prev-inv", "02-design.md")).toBeUndefined();
	expect(
		await readArtifactPrev(root, "prev-inv", "02-design.md"),
	).toBeUndefined();
	expect(
		await readArtifact(root, "prev-inv", "01-understanding-and-scenarios.md"),
	).toBe("s1");
});

test("corrupt state recovers to undefined", async () => {
	await saveState(root, mkState("bad"));
	// 손상된 내용 직접 덮어쓰기(atomic 우회 — 복구 경로 시뮬레이션).
	const sp = join(root, "bad", "state.json");
	await writeFile(sp, "{ not valid json", "utf8");
	const loaded = await loadState(root, "bad");
	expect(loaded).toBeUndefined();
});

test("valid JSON but invalid shape → 백업 후 undefined (validateState 가드)", async () => {
	// JSON 파싱은 되지만 형태가 틀린 state — validateState 의 방어 분기.
	// 이 경로가 열려 있으면 stage 9 같은 불량 상태가 파이프라인에 그대로 적재된다.
	const cases: Array<[string, unknown]> = [
		["shape-scalar", 42],
		["shape-null", null],
		["shape-no-feature", { stage: 1, history: [] }],
		["shape-feature-num", { feature: 7, stage: 1, history: [] }],
		["shape-stage-low", { feature: "f", stage: 0, history: [] }],
		["shape-stage-high", { feature: "f", stage: 4, history: [] }],
		["shape-stage-nan", { feature: "f", stage: Number.NaN, history: [] }],
		["shape-history-missing", { feature: "f", stage: 1 }],
	];
	for (const [feat, bad] of cases) {
		await saveState(root, mkState(feat)); // 디렉토리 생성
		await writeFile(
			join(root, feat, "state.json"),
			JSON.stringify(bad),
			"utf8",
		);
		expect(await loadState(root, feat)).toBeUndefined();
	}
});

test("missing state returns undefined", async () => {
	const loaded = await loadState(root, "never-started");
	expect(loaded).toBeUndefined();
});

// --- FR-7 다단계 회귀 + validThrough ---

test("validThrough starts 0 and advances on confirm", () => {
	const s0 = mkState("vt");
	expect(s0.validThrough).toBe(0);
	const s1 = applyVerdict(markArtifactReady(s0), {
		verdict: "confirm",
		comments: [],
	});
	expect(s1.stage).toBe(2);
	expect(s1.validThrough).toBe(1);
});

test("modify keeps validThrough unchanged", () => {
	let s = applyVerdict(markArtifactReady(mkState("vt2")), {
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
	let s = mkState("vt3");
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
	let s = mkState("vt4");
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
	let s = mkState("vt5");
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
	const s1 = applyVerdict(markArtifactReady(mkState("vt6")), {
		verdict: "revert",
		comments: [],
	});
	expect(s1.stage).toBe(1);
	expect(s1.validThrough).toBe(0);
});

// --- FR-2 반복 상한 ---

test("atLoopCeiling true at/above MAX_LOOPS, false below", () => {
	const base = mkState("loop");
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
	await writeArtifact(r, "f", "02-design.md", "s2");
	await writeArtifact(r, "f", "03-implementation-plan.md", "s3");
	// afterStage=1 → delete id>1 (stages 2,3)
	await invalidateArtifactsAfter(r, "f", 1, LEGACY_DEFS);
	expect(await readArtifact(r, "f", "01-understanding-and-scenarios.md")).toBe(
		"s1",
	);
	expect(await readArtifact(r, "f", "02-design.md")).toBeUndefined();
	expect(
		await readArtifact(r, "f", "03-implementation-plan.md"),
	).toBeUndefined();
	await rm(r, { recursive: true, force: true });
});

test("invalidateArtifactsAfter: 위성 design 문서(draft.<role>.md) 도 함께 삭제(ADR-031)", async () => {
	const r = await mkdtemp(join(tmpdir(), "fn-invsat-"));
	await writeArtifact(r, "f", "02-design.md", "s2");
	// Stage 2 위성 3개(주 문서와 병렬 작성) — 작업 영역 루트에 존재.
	await writeArtifact(r, "f", "draft.module-structure.md", "위성1");
	await writeArtifact(r, "f", "draft.data-model.md", "위성2");
	await writeArtifact(r, "f", "draft.behavior-flows.md", "위성3");
	// Stage 1 위성은 무효화 대상(stage 1 유지)이 아니다 — 잔존해야 한다.
	await writeArtifact(r, "f", "draft.requirements-scope.md", "s1위성");
	await invalidateArtifactsAfter(r, "f", 1);
	expect(await readArtifact(r, "f", "02-design.md")).toBeUndefined();
	expect(
		await readArtifact(r, "f", "draft.module-structure.md"),
	).toBeUndefined();
	expect(await readArtifact(r, "f", "draft.data-model.md")).toBeUndefined();
	expect(await readArtifact(r, "f", "draft.behavior-flows.md")).toBeUndefined();
	expect(await readArtifact(r, "f", "draft.requirements-scope.md")).toBe(
		"s1위성",
	);
	await rm(r, { recursive: true, force: true });
});

test("invalidateArtifactsAfter: 에이전트 자유 이름 그래프 트리도 함께 삭제(ADR-020)", async () => {
	const r = await mkdtemp(join(tmpdir(), "fn-invg-"));
	await writeArtifact(
		r,
		"f",
		"02-design.md",
		"# 설계\n\n<!-- graph: module-deps.json -->\n",
	);
	await writeArtifact(r, "f", "stage2/module-deps.json", '{"version":2}');
	await writeArtifact(
		r,
		"f",
		"stage2/module-deps/modules/ui.json",
		'{"version":2}',
	);
	await invalidateArtifactsAfter(r, "f", 1, LEGACY_DEFS);
	expect(await readArtifact(r, "f", "02-design.md")).toBeUndefined();
	expect(await readArtifact(r, "f", "stage2/module-deps.json")).toBeUndefined();
	expect(
		await readArtifact(r, "f", "stage2/module-deps/modules/ui.json"),
	).toBeUndefined();
	await rm(r, { recursive: true, force: true });
});

test("checkRequiredGraph: 다중 그래프 허용·이름 중복 거부(ADR-020)", async () => {
	const r = await mkdtemp(join(tmpdir(), "fn-reqg-"));
	const ok = JSON.stringify({ version: 2, nodes: [{ id: "a" }] });
	await writeArtifact(r, "f", "a.json", ok);
	await writeArtifact(r, "f", "b.json", ok);
	// 2개 유효 참조 → 통과.
	await writeArtifact(
		r,
		"f",
		"draft.md",
		"# 설계\n<!-- graph: a.json -->\n<!-- graph: b.json -->\n",
	);
	expect(await checkRequiredGraph(r, "f", "draft.md")).toBeNull();
	// 중복 이름 → 거부.
	await writeArtifact(
		r,
		"f",
		"draft.md",
		"# 설계\n<!-- graph: a.json -->\n<!-- graph: a.json -->\n",
	);
	expect(await checkRequiredGraph(r, "f", "draft.md")).toContain("중복");
	// 참조 파일 누락 → 거부.
	await writeArtifact(r, "f", "draft.md", "<!-- graph: missing.json -->\n");
	expect(await checkRequiredGraph(r, "f", "draft.md")).toContain("없다");
	await rm(r, { recursive: true, force: true });
});

test("checkRequiredGraph: sequence·flowchart 도 유효 그래프로 수락(ADR-021)", async () => {
	const r = await mkdtemp(join(tmpdir(), "fn-kinds-"));
	const seq = JSON.stringify({
		version: 2,
		type: "sequence",
		participants: [{ id: "a", name: "A" }],
		body: [{ from: "a", to: "a", label: "self" }],
	});
	const flow = JSON.stringify({
		version: 2,
		type: "flowchart",
		nodes: [{ id: "s", label: "시작" }],
		edges: [],
	});
	await writeArtifact(r, "f", "seq.json", seq);
	await writeArtifact(r, "f", "flow.json", flow);
	await writeArtifact(
		r,
		"f",
		"draft.md",
		"# 설계\n<!-- graph: seq.json -->\n<!-- graph: flow.json -->\n",
	);
	expect(await checkRequiredGraph(r, "f", "draft.md")).toBeNull();
	// 불량 sequence envelope → envelope 안내로 거부.
	await writeArtifact(r, "f", "seq.json", '{"version":2,"type":"sequence"}');
	expect(await checkRequiredGraph(r, "f", "draft.md")).toContain("envelope");
	await rm(r, { recursive: true, force: true });
});

// --- FR-7 validThrough 마이그레이션(D4) ---

test("loadState migrates legacy state.json missing validThrough → 0", async () => {
	const feat = "legacymig";
	await saveState(root, mkState(feat)); // 디렉토리 + state.json 생성
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
	// stages 누락 구 포맷 → 레거시 3종 구성으로 마이그레이션.
	expect(loaded?.stages).toEqual([...LEGACY_KINDS]);
});

test("loadState guards non-finite validThrough (null) → 0", async () => {
	const feat = "badvt";
	await saveState(root, mkState(feat));
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

test("loadState: 미등록 종류 포함 stages 는 손상 취급(복구 경로)", async () => {
	const feat = "badkind";
	await saveState(root, mkState(feat));
	await writeFile(
		join(root, feat, "state.json"),
		JSON.stringify({
			feature: feat,
			stages: ["understanding", "not-a-kind"],
			stage: 1,
			gateOpen: false,
			loopCount: 0,
			done: false,
			history: [],
			createdAt: 1,
			updatedAt: 1,
		}),
		"utf8",
	);
	expect(await loadState(root, feat)).toBeUndefined();
});

test("loadState: 동적 구성 state 왕복(5단계·상한 포함)", async () => {
	const feat = "dyn-rt";
	const kinds: StageKind[] = [
		"understanding",
		"design",
		"risk-analysis",
		"test-strategy",
		"implementation",
	];
	const s = { ...initialState(feat, kinds), maxStages: 5 };
	await saveState(root, s);
	const loaded = await loadState(root, feat);
	expect(loaded).toEqual(s);
});

test("teardown", async () => {
	await cleanup();
});
