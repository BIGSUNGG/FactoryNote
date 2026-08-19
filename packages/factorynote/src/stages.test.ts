// Stage Registry 자체체크 — 3단계 정의의 프로토콜 불변식.
// stages.ts 는 protocol/stages/ 의 실행 투영이므로, 데이터 자체가 게이트 의무
// (Stage 2 graph required 등)를 결정한다 — 테이블 드리프트를 잡는 것이 목적.
import { describe, expect, test } from "bun:test";
import { STAGES, stageById } from "./stages.ts";

describe("STAGES 정의 테이블", () => {
	test("3단계가 id 1→3 순서로 존재", () => {
		expect(STAGES.map((s) => s.id)).toEqual([1, 2, 3]);
	});

	test("모든 산출물은 markdown 형식 + 파일명 kebab 규약 + 산출 생성", () => {
		for (const s of STAGES) {
			expect(s.format).toBe("markdown");
			expect(s.producesArtifact).toBe(true);
			expect(s.artifactFile).toMatch(/^[0-9a-z-]+\.md$/);
		}
	});

	test("산출물 파일명은 단계 번호 접두로 중복 없음", () => {
		const files = STAGES.map((s) => s.artifactFile);
		expect(new Set(files).size).toBe(files.length);
		for (const [i, f] of files.entries()) {
			expect(f?.startsWith(`0${i + 1}-`)).toBe(true);
		}
	});

	test("그래프 의무 — Stage1 none · Stage2 required · Stage3 optional (게이트 분기 기준)", () => {
		expect(stageById(1).graph).toBe("none");
		expect(stageById(2).graph).toBe("required");
		expect(stageById(3).graph).toBe("optional");
	});

	test("Design 프롬프트는 전 단계 비어있지 않음(빈 프롬프트 = 스폰 즉시 실패)", () => {
		for (const s of STAGES) {
			expect(s.designPrompt.length).toBeGreaterThan(20);
		}
	});

	test("Stage 2 프롬프트는 그래프 트리 규약(version:2 레벨 파일)을 지시", () => {
		const p = stageById(2).designPrompt;
		expect(p).toContain('"version":2');
		expect(p).toContain("<!-- graph:");
	});
});

describe("stageById", () => {
	test("유효 id 조회 — 정의 테이블 원본 반환(동일 참조)", () => {
		for (const s of STAGES) {
			expect(stageById(s.id)).toBe(s);
		}
	});

	test("범위 밖 id 는 명확한 에러(런타임 StageId 위반 방어)", () => {
		// @ts-expect-error — 타입 시스템이 막는 호출을 런타임에서도 방어하는지
		expect(() => stageById(4)).toThrow("Unknown stage: 4");
		// @ts-expect-error
		expect(() => stageById(0)).toThrow();
	});
});
