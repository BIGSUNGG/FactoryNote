// 커스텀 스크롤바 지오메트리(순수) — .doc 스크롤 수치를 트랙 픽셀로 환산.
// 트랙 높이 = clientHeight − TRACK_INSET*2(상하 여백 — 끝단 접촉·월월 방지).
export const MIN_THUMB = 32; // 너무 짧은 thumb 는 조작 불가 — 하한.
export const TRACK_INSET = 2; // 트랙 상하 인셋(px) — 패널 끝과 시각적 간격.

/** 트랙 가용 높이. */
export const trackHeight = (client) => Math.max(client - TRACK_INSET * 2, 0);

/** thumb 위치·높이. 스크롤 불필요(total<=client)면 null. */
export function thumbGeom({ top, client, total }) {
	if (!total || total <= client) return null;
	const track = trackHeight(client);
	const h = Math.max((client / total) * track, MIN_THUMB);
	const avail = track - h;
	const t =
		avail > 0
			? Math.min(Math.max((top / (total - client)) * avail, 0), avail)
			: 0;
	return { top: t, h };
}

/** 트랙 클릭 y(트랙 기준 px) → 목표 scrollTop. thumb 중심이 클릭 지점으로 점프. */
export function scrollForTrackClick(y, g, { client, total }) {
	const avail = trackHeight(client) - g.h;
	const r = avail > 0 ? Math.min(Math.max((y - g.h / 2) / avail, 0), 1) : 0;
	return r * (total - client);
}

/** thumb 드래그 이동량 dy(px) → scrollTop 증분. */
export function dragToScroll(dy, g, { client, total }) {
	const avail = trackHeight(client) - g.h;
	return avail > 0 ? (dy / avail) * (total - client) : 0;
}

/** 변경 마커 지오메트리 — 콘텐츠 박스(패딩 제외) 기준 정규화:
 * 문서 첫 블록 상단 → 트랙 0, 마지막 블록 하단 → 트랙 끝.
 * (패딩 포함 비율 매핑 시 첫/끝 블록 마커가 트랙 양단에 닿지 않던 문제 해소.) */
export function markGeom(
	offsetTop,
	offsetHeight,
	{ total, client, padTop, padBottom },
) {
	const track = trackHeight(client);
	const contentH = Math.max(total - padTop - padBottom, 1);
	const h = Math.max((offsetHeight / contentH) * track, 3);
	const raw = ((offsetTop - padTop) / contentH) * track;
	return { top: Math.min(Math.max(raw, 0), track - h), h };
}
