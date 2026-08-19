// Stage Catalog 자체체크 — 스테이지 종류 정의·동적 구성 인스턴스화의 프로토콜 불변식.
// stages.ts 는 protocol/stages/ 의 실행 투영이므로, 데이터 자체가 게이트 의무
// (design 종류 graph required 등)를 결정한다 — 테이블 드리프트를 잡는 것이 목적.
import { describe, expect, test } from "bun:test";
import {
	LEGACY_KINDS,
	STAGE_CATALOG,
	STAGE_KINDS,
	feedbackProfileOf,
	isStageKind,
	stageDefAt,
	stageDefs,
} from "./stages.ts";

describe("STAGE_CATALOG 정의 테이블", () => {
	test("6종류가 존재 — 기존 3종 + 리스크 분석·테스트 전략·NFR 검증", () => {
		expect(STAGE_KINDS).toEqual([
			"understanding",
			"design",
			"implementation",
			"risk-analysis",
			"test-strategy",
			"nfr",
		]);
		for (const kind of STAGE_KINDS) {
			expect(STAGE_CATALOG[kind].kind).toBe(kind);
		}
	});

	test("모든 산출물은 markdown 형식 + 산출 생성 + 비어있지 않은 프롬프트", () => {
		for (const kind of STAGE_KINDS) {
			const s = STAGE_CATALOG[kind];
			expect(s.format).toBe("markdown");
			expect(s.producesArtifact).toBe(true);
			expect(s.fileSuffix).toMatch(/^[0-9a-z-]+$/);
			expect(s.designPrompt.length).toBeGreaterThan(20);
		}
	});

	test("그래프 의무 — understanding none · design required · implementation optional (게이트 분기 기준)", () => {
		expect(STAGE_CATALOG.understanding.graph).toBe("none");
		expect(STAGE_CATALOG.design.graph).toBe("required");
		expect(STAGE_CATALOG.implementation.graph).toBe("optional");
	});

	test("design 프롬프트는 그래프 트리 규약(version:2 레벨 파일)을 지시", () => {
		const p = STAGE_CATALOG.design.designPrompt;
		expect(p).toContain('"version":2');
		expect(p).toContain("<!-- graph:");
	});
});

describe("stageDefs 구성 인스턴스화", () => {
	test("레거시 3종 구성 — 기존 산출물 파일명과 정확히 일치(마이그레이션 호환)", () => {
		const defs = stageDefs(LEGACY_KINDS);
		expect(defs.map((d) => d.id)).toEqual([1, 2, 3]);
		expect(defs.map((d) => d.artifactFile)).toEqual([
			"01-understanding-and-scenarios.md",
			"02-design.md",
			"03-implementation-plan.md",
		]);
	});

	test("같은 종류 반복 시에도 위치 접두로 파일명 유일", () => {
		const defs = stageDefs(["understanding", "design", "design"]);
		const files = defs.map((d) => d.artifactFile);
		expect(files).toEqual([
			"01-understanding-and-scenarios.md",
			"02-design.md",
			"03-design.md",
		]);
		expect(new Set(files).size).toBe(files.length);
	});

	test("stageDefAt 범위 밖 위치는 명확한 에러", () => {
		expect(() => stageDefAt(LEGACY_KINDS, 4)).toThrow(
			"Unknown stage position: 4",
		);
		expect(() => stageDefAt(LEGACY_KINDS, 0)).toThrow();
	});

	test("isStageKind — 등록 종류만 true", () => {
		expect(isStageKind("design")).toBe(true);
		expect(isStageKind("bogus")).toBe(false);
		expect(isStageKind(2)).toBe(false);
	});
});

describe("feedbackProfileOf", () => {
	test("종류→프로필 사상(검토 축 레지스트리 호환)", () => {
		expect(feedbackProfileOf("understanding")).toBe(1);
		expect(feedbackProfileOf("design")).toBe(2);
		expect(feedbackProfileOf("implementation")).toBe(3);
		expect(feedbackProfileOf("risk-analysis")).toBe(1);
		expect(feedbackProfileOf("test-strategy")).toBe(3);
		expect(feedbackProfileOf("nfr")).toBe(1);
	});
});
