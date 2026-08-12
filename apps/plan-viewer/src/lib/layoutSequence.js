// 시퀀스 다이어그램 결정적 자동 배치(ADR-021) — 순수 로직, 컴포넌트와 분리.
// 입력: {participants:[{id,...}], body:[메시지|fragment]} — 좌표는 여기서만 결정(데이터에 좌표 금지).
// 출력: {width, height, participants, messages, fragments} — 전부 SVG 렌더 좌표.

export const SEQ_METRICS = {
	colW: 170, // 참여자 컬럼 폭
	headH: 44, // 상단 참여자 박스 높이
	rowH: 32, // 메시지 1줄 세로 간격
	pad: 16, // 캔버스 패딩
	fragHead: 24, // fragment 헤더가 차지하는 행 높이
	fragTail: 12, // fragment 하단 여백
	fragPad: 10, // fragment 박스 좌우 여백(가장자리 메시지기준)
};

const isFragment = (it) => Array.isArray(it?.body);

/** fragment 가 덮는 참여자 컬럼 범위 [minIdx, maxIdx] 계산(중첩 포함). 메시지 없으면 null. */
function fragmentSpan(items, idxOf) {
	let min = Infinity;
	let max = -Infinity;
	for (const it of items) {
		if (isFragment(it)) {
			const s = fragmentSpan(it.body, idxOf);
			if (s) {
				min = Math.min(min, s[0]);
				max = Math.max(max, s[1]);
			}
		} else {
			const a = idxOf.get(it.from);
			const b = idxOf.get(it.to);
			if (a !== undefined && b !== undefined) {
				min = Math.min(min, a, b);
				max = Math.max(max, a, b);
			}
		}
	}
	return max < 0 ? null : [min, max];
}

/** 시퀀스 그래프 데이터 → 렌더 좌표. 결정적(같은 입력 → 같은 출력). */
export function layoutSequence(data) {
	const m = SEQ_METRICS;
	const participants = (data.participants || []).map((p, i) => ({
		id: p.id,
		name: typeof p.name === "string" && p.name ? p.name : p.id,
		x: m.pad + i * m.colW + m.colW / 2,
		index: i,
	}));
	const idxOf = new Map(participants.map((p) => [p.id, p.index]));
	const width = m.pad * 2 + Math.max(1, participants.length) * m.colW;

	let row = 0;
	const yFor = (r) => m.pad + m.headH + 20 + r * m.rowH;
	const messages = [];
	const fragments = [];

	function walk(items, depth) {
		for (const it of items) {
			if (isFragment(it)) {
				const y0 = yFor(row);
				row += m.fragHead / m.rowH;
				// 바깥 fragment 가 배열 앞순서에 오도록 선등록 후 기하 채움(렌더 z-순서 겸용).
				const frag = {
					kind: it.kind,
					label: it.label ?? "",
					x: 0,
					y: y0,
					w: 0,
					h: 0,
					depth,
				};
				fragments.push(frag);
				walk(it.body, depth + 1);
				const y1 = yFor(row);
				row += m.fragTail / m.rowH;
				const span = fragmentSpan(it.body, idxOf);
				const lo = span ? span[0] : 0;
				const hi = span ? span[1] : Math.max(0, participants.length - 1);
				const x0 = m.pad + lo * m.colW + m.fragPad;
				const x1 = m.pad + (hi + 1) * m.colW - m.fragPad;
				frag.x = x0;
				frag.w = Math.max(x1 - x0, 40);
				frag.h = Math.max(y1 - y0, 20);
			} else {
				const a = participants[idxOf.get(it.from) ?? 0];
				const b = participants[idxOf.get(it.to) ?? 0];
				messages.push({
					from: it.from,
					to: it.to,
					label: it.label,
					kind: it.kind === "reply" ? "reply" : "call",
					x1: a.x,
					x2: b.x,
					y: yFor(row) + m.rowH / 2,
					self: it.from === it.to,
				});
				row += 1;
			}
		}
	}
	walk(data.body || [], 0);

	const height = Math.max(yFor(row) + m.pad, m.pad * 2 + m.headH + 40);
	return { width, height, participants, messages, fragments };
}
