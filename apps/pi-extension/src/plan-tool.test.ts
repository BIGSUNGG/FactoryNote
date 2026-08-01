// drivePlan 종단 간 스모크(계약 #2/#7 근거) — factorynote_plan 도구의 실제 흐름:
// 산출물 제출 → 게이트(웹) → 결정 → 상태 전이 + 산출물 디스크 저장 을 pi 없이 검증.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "bun:test";
import { drivePlan } from "./plan-tool.ts";
import {
	loadState,
	readArtifact,
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

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
