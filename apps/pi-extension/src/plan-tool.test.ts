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
	parseDesignMarkdown,
	readArtifact,
	saveState,
	writeArtifact,
	type Comment,
	type GateVerdict,
} from "@factorynote/core";

const VIEWER_DIST = join(import.meta.dir, "../../../apps/plan-viewer/dist");
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
	const onDisk = await readArtifact(
		root,
		"smoke",
		"01-understanding-and-scenarios.md",
	);
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

test("design stage: agent submits md, user edits+confirm → adopted md saved + advance", async () => {
	// Stage 2(설계) md 단일진실 시드.
	await saveState(root, { ...initialState("graphfeat"), stage: 2 });
	const fence = (sections: unknown) =>
		"```factorynote-graph\n" + JSON.stringify({ sections }, null, 2) + "\n```";
	const initialMd =
		"# 설계\n\n## 구조\n\n" +
		fence([
			{
				id: "fe",
				title: "프론트",
				nodes: [{ id: "UI", data: { label: "UI" } }],
				edges: [],
			},
		]) +
		"\n\n## 아키텍처 설명\n\n초안 설계.";
	// 사용자가 그래프를 편집(노드 추가 + 엣지 추가)한 결과 md(구조 펜스만 교체).
	const editedMd =
		"# 설계\n\n## 구조\n\n" +
		fence([
			{
				id: "fe",
				title: "프론트",
				nodes: [{ id: "UI" }, { id: "API" }],
				edges: [{ id: "UI->API", source: "UI", target: "API" }],
			},
		]) +
		"\n\n## 아키텍처 설명\n\n초안 설계.";
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: "graphfeat",
		artifactMd: initialMd,
		open: false,
		onReady: async (url) => {
			await fetch(`${url}/api/decision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					verdict: "confirm",
					comments: [],
					artifactMd: editedMd,
				}),
			});
		},
	});
	expect(out.gateResult?.verdict).toBe("confirm");
	expect(out.stage).toBe(3); // 설계(2) → 구현 계획(3)
	// 편집된(채택된) md 가 저장되었는지 — 초기가 아닌 편집 결과.
	const saved = await readArtifact(root, "graphfeat", "02-design.md");
	expect(saved).toBeTruthy();
	const { structure } = parseDesignMarkdown(saved ?? "");
	expect(structure.sections[0]?.nodes).toHaveLength(2);
	expect(structure.sections[0]?.edges[0]?.id).toBe("UI->API");
});

test("#3 gateOpen resume: artifact on disk + gateOpen reopens gate instead of requesting rewrite", async () => {
	// 인터럽트 복구 상태: gateOpen=true 로 남은 채 재시작, 산출물은 이미 디스크에 존재.
	const feat = "resumefeat";
	const md = "# 요구사항(이미 저장됨)\n\n데모.";
	await writeArtifact(root, feat, "01-understanding-and-scenarios.md", md);
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
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe(md);
});

test("FR-2 escalation: modify at loop ceiling surfaces conflict + options", async () => {
	const feat = "ceildemo";
	const md = "# Req\n\n데모.";
	await writeArtifact(root, feat, "01-understanding-and-scenarios.md", md);
	await saveState(root, {
		...initialState(feat),
		stage: 1,
		gateOpen: true,
		loopCount: 3, // 반복 상한 도달 상태에서 재개
	});
	const out = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		open: false,
		// artifactMd 생략 → gateOpen + 산출물 존재 → 게이트 재오픈(resume)
		onReady: postDecision("modify", [{ text: "요구사항이 모호함" }]),
	});
	expect(out.gateResult?.verdict).toBe("modify");
	// 천장 도달 → 에스컬레이션 메시지(근본 갈등 신호 + 옵션) 로 전환.
	expect(out.message).toMatch(/FR-2 에스컬레이션|⚠/);
	expect(out.message).toContain("요구사항이 모호함"); // 잔존 이슈 노출
});

test("chat round-trip: chat→chatPending; chatResponse+artifactMd re-entry keeps gate; confirm keeps loopCount 0", async () => {
	// F1: 게이트 열린 동안 실시간 채팅 → 에이전트 답변/수정(그 자리 반영) → 게이트 유지.
	const feat = "chatfeat";
	await saveState(root, { ...initialState(feat), stage: 1 });

	// 1) 산출물 제출 → 게이트 오픈 → 사용자 채팅 → chatPending 반환(게이트 유지).
	const out1 = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		artifactMd: "# 요구사항\n\n초안.",
		open: false,
		onReady: async (url) => {
			await fetch(`${url}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "2절 더 구체적으로", blockId: "b2" }),
			});
		},
	});
	expect(out1.chatPending).toBeTruthy();
	expect((out1.chatPending ?? [])[0]?.text).toBe("2절 더 구체적으로");
	expect(out1.gateResult).toBeNull();
	// 게이트 유지 + 산출물 디스크 저장.
	const st1 = await loadState(root, feat);
	expect(st1?.gateOpen).toBe(true);
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe("# 요구사항\n\n초안.");

	// 2) 에이전트 답변(chatResponse) + 산출물 수정(artifactMd) 재호출 → 게이트 유지 → confirm.
	const out2 = await drivePlan({
		root,
		viewerDistDir: VIEWER_DIST,
		feature: feat,
		artifactMd: "# 요구사항\n\n구체적으로 보강.",
		chatResponse: "2절을 보강했습니다.",
		open: false,
		onReady: postDecision("confirm"),
	});
	expect(out2.gateResult?.verdict).toBe("confirm");
	expect(out2.stage).toBe(2);
	// 채팅 수정은 modify 루프카운트에 포함되지 않는다.
	const st2 = await loadState(root, feat);
	expect(st2?.loopCount).toBe(0);
	// 수정된 산출물이 그 자리 반영되었는지.
	expect(
		await readArtifact(root, feat, "01-understanding-and-scenarios.md"),
	).toBe("# 요구사항\n\n구체적으로 보강.");
});

test("teardown", async () => {
	await rm(root, { recursive: true, force: true });
});
