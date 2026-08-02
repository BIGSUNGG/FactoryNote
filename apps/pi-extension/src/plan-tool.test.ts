// drivePlan 종단 간 스모크(계약 #2/#7 근거) — factorynote_plan 도구의 실제 흐름:
// 산출물 제출 → 게이트(웹) → 결정 → 상태 전이 + 산출물 디스크 저장 을 pi 없이 검증.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import { drivePlan } from "./plan-tool.ts";
import {
	initialState,
	loadState,
	readArtifact,
	saveState,
	writeArtifact,
	type Comment,
	type GateVerdict,
} from "@factorynote/core";

const VIEWER_DIST = join(
	import.meta.dir,
	"../../../prototypes/plan-page-mockup/dist",
);
let root: string;

const postDecision =
	(verdict: GateVerdict, comments: Comment[] = []) =>
	async (url: string) => {
		await fetch(`${url}/api/decision`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ verdict, comments }),
		});
	};

test("setup", async () => {
	root = await mkdtemp(join(tmpdir(), "factorynote-driver-"));
});

test("first call requests artifact for stage 1", async () => {
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "smoke",
		open: false,
	});
	expect(out.stage).toBe(1);
	expect(out.needArtifact).toBe(true);
	expect(out.designPrompt).toBeTruthy();
});

test("submit artifact + confirm advances to stage 2 and persists", async () => {
	const md = "# 요구사항 명세\n\n데모 기능의 요구사항.";
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "smoke",
		artifactMd: md,
		open: false,
		onReady: postDecision("confirm"),
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(2);
	// 산출물 디스크 저장.
	const onDisk = await readArtifact(root, "smoke", "01-requirements.md");
	expect(onDisk).toBe(md);
	// 상태 영속화(stage 2).
	const st = await loadState(root, "smoke");
	expect(st?.stage).toBe(2);
});

test("modify keeps stage 2 and bumps loopCount", async () => {
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "smoke",
		artifactMd: "# 시나리오\n\nhappy path.",
		open: false,
		onReady: postDecision("modify", [{ text: "더 구체적으로" }]),
	});
	// stage 2 산출물 제출 후 modify → stage 2 유지.
	expect(out.gateResult?.verdict).toBe("modify");
	expect(out.stage).toBe(2);
	const st = await loadState(root, "smoke");
	expect(st?.loopCount).toBe(1);
});

test("graph stage: agent submits JSON, user edits+confirm → adopted graph saved + advance", async () => {
	// Stage 3(모듈 그래프) 시드.
	await saveState(root, { ...initialState("graphfeat"), stage: 3 });
	const initialGraph = {
		sections: [
			{
				id: "fe",
				title: "프론트",
				nodes: [{ id: "UI", data: { label: "UI" } }],
				edges: [],
			},
		],
	};
	// 사용자가 그래프를 편집(노드 추가 + 엣지 추가)한 결과.
	const edited = {
		sections: [
			{
				id: "fe",
				title: "프론트",
				nodes: [{ id: "UI" }, { id: "API" }],
				edges: [{ id: "UI->API", source: "UI", target: "API" }],
			},
		],
	};
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "graphfeat",
		artifactMd: JSON.stringify(initialGraph),
		open: false,
		onReady: async (url) => {
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					verdict: "confirm",
					comments: [],
					graphSections: edited.sections,
				}),
			});
		},
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(4); // 모듈(3) → 클래스(4)
	// 편집된(채택된) 그래프가 저장되었는지 — 초기가 아닌 편집 결과.
	const saved = await readArtifact(root, "graphfeat", "03-modules.json");
	expect(saved).toBeTruthy();
	let parsed: {
		sections: Array<{ nodes: unknown[]; edges: Array<{ id: string }> }>;
	} = { sections: [] };
	try {
		parsed = JSON.parse(saved ?? "{}") as typeof parsed;
	} catch {
		/* 저장 포맷 이상 — 기본값 그대로(아래 expect 가 실패로 원인 노출) */
	}
	expect(parsed.sections[0]?.nodes).toHaveLength(2);
	expect(parsed.sections[0]?.edges[0]?.id).toBe("UI->API");
});

test("#3 gateOpen resume: artifact on disk + gateOpen reopens gate instead of requesting rewrite", async () => {
	// 인터럽트 복구 상태: gateOpen=true 로 남은 채 재시작, 산출물은 이미 디스크에 존재.
	const feat = "resumefeat";
	const md = "# 요구사항(이미 저장됨)\n\n데모.";
	await writeArtifact(root, feat, "01-requirements.md", md);
	await saveState(root, {
		...initialState(feat),
		stage: 1,
		gateOpen: true,
	});
	let posted = false;
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
		onReady: async (url) => {
			posted = true;
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verdict: "confirm", comments: [] }),
			});
		},
	});
	// 게이트가 즉시 재오픈되어 결정을 받았다(게이트 통과).
	expect(posted).toBe(true);
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.message).toContain("게이트 재오픈(인터럽트 복구)");
	// confirm → stage 2 로 전이(stage 2 도 산출물 단계이므로 needArtifact=true 는 정상).
	expect(out.stage).toBe(2);
	const st = await loadState(root, feat);
	expect(st?.stage).toBe(2);
	// 인터럽트 복구는 산출물 재작성을 요구하지 않는다 — 원본 산출물이 그대로 보존됨.
	expect(await readArtifact(root, feat, "01-requirements.md")).toBe(md);
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
