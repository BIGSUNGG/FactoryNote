// 테스트 뷰어 목업 API 자체체크 — 실서버 의미론(ADR-024/026/027) 모방 검증.
// 가짜 타이머로 3초 회신 창(busy)을 제어한다. 실행: bun test apps/plan-viewer
import { describe, expect, test } from "bun:test";
import { createMockApi } from "./mock-api.js";

/** 회신 타이머를 캡처하는 가짜 setTimeout — flush()로 회신 완료를 시뮬레이션. */
function fakeClock() {
	const timers = [];
	return {
		setTimeoutFn: (fn, ms) => {
			timers.push({ fn, ms });
		},
		flush: () => {
			const t = timers.shift();
			if (t) t.fn();
		},
		pending: () => timers.length,
	};
}

const make = (clock) =>
	createMockApi({
		artifacts: [{ stage: 1, name: "요청 이해", md: "# a" }],
		replyDelayMs: 3000,
		replies: ["회신"],
		edits: [],
		setTimeoutFn: clock.setTimeoutFn,
		now: () => 1,
	});

describe("mock-api: 실서버 큐 의미론", () => {
	test("(a) idle 채팅 즉시 전달·busy 진입, busy 중 채팅은 큐 적재", () => {
		const c = fakeClock();
		const api = make(c);
		expect(api.postChat({ text: "첫질문" })).toEqual({ ok: true });
		let d = api._debug();
		expect(d.messages.map((m) => m.text)).toEqual(["첫질문"]);
		expect(d.queue).toHaveLength(0);
		expect(d.busy).toBe(true); // 회신 스케줄(3초 창)
		expect(api.postChat({ text: "두번째" })).toEqual({ ok: true });
		d = api._debug();
		expect(d.messages).toHaveLength(1); // 미승격
		expect(d.queue.map((m) => m.text)).toEqual(["두번째"]);
	});

	test("(b) busy 확정 요청은 대기 채팅 뒤 적재, 이후 채팅 거부", () => {
		const c = fakeClock();
		const api = make(c);
		api.postChat({ text: "질문" }); // busy 진입
		api.postChat({ text: "대기채팅" }); // 큐
		expect(api.postChat({ kind: "stage-request", targetStage: 2 })).toEqual({
			ok: true,
		});
		const d = api._debug();
		expect(d.queue.map((m) => m.kind ?? "chat")).toEqual([
			"chat",
			"stage-request",
		]);
		expect(api.postChat({ text: "거부될채팅" })).toEqual({
			ok: false,
			reason: "stage-request-pending",
		});
	});

	test("(c) 회신 완료마다 선두 1개만 승격(일괄 배출 아님)", () => {
		const c = fakeClock();
		const api = make(c);
		api.postChat({ text: "1" }); // 즉시 전달 + busy
		api.postChat({ text: "2" });
		api.postChat({ text: "3" });
		c.flush(); // 회신 1 완료 → 선두 '2'만 승격 + 새 busy
		let d = api._debug();
		expect(d.messages.map((m) => m.text)).toEqual(["1", "회신", "2"]);
		expect(d.queue.map((m) => m.text)).toEqual(["3"]);
		c.flush(); // 회신 2 완료 → '3' 승격
		d = api._debug();
		expect(d.messages.map((m) => m.text)).toEqual([
			"1",
			"회신",
			"2",
			"회신",
			"3",
		]);
		expect(d.queue).toHaveLength(0);
	});

	test("(d) stage-request 선두 도달 실행 — 단계 진행·fulfilled·잠금 해제", () => {
		const c = fakeClock();
		const api = make(c);
		api.postChat({ text: "질문" }); // busy
		api.postChat({ text: "대기" });
		api.postChat({ kind: "stage-request", targetStage: 2 });
		c.flush(); // 회신 → '대기' 승격 + busy
		c.flush(); // 회신 → stage-request 선두 → 실행(단계 진행)
		const d = api._debug();
		expect(d.stage).toBe(2);
		const sr = d.messages.find((m) => m.kind === "stage-request");
		expect(sr?.status).toBe("fulfilled");
		expect(d.queue).toHaveLength(0);
		expect(api.postChat({ text: "잠금해제후채팅" }).ok).toBe(true); // 잠금 해제
	});

	test("(d2) idle 확정 요청은 즉시 실행(앞 대기 없음)", () => {
		const c = fakeClock();
		const api = make(c);
		expect(api.postChat({ kind: "stage-request", targetStage: 2 })).toEqual({
			ok: true,
		});
		const d = api._debug();
		expect(d.stage).toBe(2);
		expect(d.queue).toHaveLength(0);
	});

	test("(e) cancel 큐 제거·이중 확정 거부·넘겨진 메시지 거부(already-sent)", () => {
		const c = fakeClock();
		const api = make(c);
		api.postChat({ text: "질문" }); // busy
		expect(api.postChat({ kind: "stage-request", targetStage: 2 })).toEqual({
			ok: true,
		});
		expect(api.postChat({ kind: "stage-request", targetStage: 2 })).toEqual({
			ok: false,
			reason: "already-pending",
		});
		const q = api.getChat().queue;
		expect(api.cancel(q[0].id)).toEqual({ ok: true }); // stage-request 취소
		expect(api._debug().queue).toHaveLength(0);
		const sent = api.getChat().messages[0];
		expect(api.cancel(sent.id)).toEqual({
			ok: false,
			reason: "already-sent",
		}); // read-wins
	});

	test("(f) GET /api/chat 응답에 messages·queue 모두 존재", () => {
		const c = fakeClock();
		const api = make(c);
		api.postChat({ text: "질문" });
		api.postChat({ text: "대기" });
		const d = api.getChat();
		expect(Array.isArray(d.messages)).toBe(true);
		expect(Array.isArray(d.queue)).toBe(true);
		expect(d.messages).toHaveLength(1);
		expect(d.queue).toHaveLength(1);
	});

	test("(부가) 최종 단계 confirm → done(마감 화면)", () => {
		const c = fakeClock();
		const api = make(c);
		api.postChat({ kind: "stage-request", targetStage: 3 }); // 1→3 두 번 진행
		api.postChat({ kind: "stage-request", targetStage: 3 });
		expect(api._debug().stage).toBe(3);
		expect(api.postDecision({ verdict: "confirm" })).toEqual({ ok: true });
		expect(api._debug().done).toBe(true);
	});
});

describe("mock-api: 그래프 서빙 의미론(ADR-018·021) — 뷰어 graphData 소비와 1:1", () => {
	test("artifacts[].graphs 가 /api/state 에 그대로 포함(없으면 필드 생략)", () => {
		const c = fakeClock();
		const api = createMockApi({
			artifacts: [
				{
					stage: 1,
					name: "요청 이해",
					md: "# a\n\n<!-- graph: auth-sequence.json -->",
					graphs: [
						{
							file: "auth-sequence.json",
							type: "sequence",
							data: { title: "x" },
						},
					],
				},
				{ stage: 2, name: "시나리오", md: "# b" },
			],
			setTimeoutFn: c.setTimeoutFn,
			now: () => 1,
		});
		const arts = api.getState().artifacts;
		expect(arts[0].graphs).toEqual([
			{ file: "auth-sequence.json", type: "sequence", data: { title: "x" } },
		]);
		expect(arts[1].graphs).toBeUndefined();
	});
});

describe("mock-api: ADR-027 변경 하이라이트 의미론", () => {
	test("채팅 재작성 → prevMd = 재작성 전 버전, 확정 → 기준 리셋", () => {
		const c = fakeClock();
		const api = createMockApi({
			artifacts: [{ stage: 1, name: "요청 이해", md: "# a\n\n본문." }],
			replies: ["회신"],
			edits: ["> 추가 배너\n\n"],
			setTimeoutFn: c.setTimeoutFn,
			now: () => 1,
		});
		// 최초 게이트: prev 없음(하이라이트 생략)
		expect(api.getState().artifacts[0].prevMd).toBeUndefined();
		api.postChat({ text: "추가해줘" });
		c.flush(); // 회신 완료 → 재작성
		const art = api.getState().artifacts.find((a) => a.stage === 1);
		expect(art.prevMd).toBe("# a\n\n본문.");
		expect(art.md).toContain("추가 배너");
		// 확정 → 하이라이트 기준 삭제
		api.postDecision({ verdict: "confirm" });
		expect(
			api.getState().artifacts.find((a) => a.stage === 1).prevMd,
		).toBeUndefined();
	});

	test("재작성 = 상단 배너 prepend + 마지막 블록 문자 수정(양 끝 시연)", () => {
		const c = fakeClock();
		const api = createMockApi({
			artifacts: [{ stage: 1, name: "요청 이해", md: "# a\n\n본문.\n" }],
			replies: ["회신"],
			edits: ["> 배너\n\n"],
			setTimeoutFn: c.setTimeoutFn,
			now: () => 1,
		});
		api.postChat({ text: "수정해줘" });
		c.flush();
		const art = api.getState().artifacts.find((a) => a.stage === 1);
		expect(art.md.startsWith("> 배너")).toBe(true); // 상단 추가
		expect(art.md).toContain("본문. ✏️1"); // 하단 마지막 블록 문자 수정
	});
});
