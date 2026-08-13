// scroll-spy 순수 판별 함수 — DOM/React 없이 테스트 가능.
// headings: [{ id, top }] (top = 스크롤 컨테이너 기준 offsetTop, 소스 순서 권장).
// 화면 상단 기준선(scrollTop + offset)을 지난(top ≤ 기준선) 가장 마지막 헤딩 id 반환.
// 아무것도 기준선 위로 올라가지 않았으면 첫 헤딩(최상단 fallback).
export function activeHeadingId(headings, scrollTop, offset = 80) {
	if (!headings.length) return null;
	let current = null;
	for (const h of headings) {
		if (scrollTop + offset >= h.top) current = h.id;
	}
	// ponytail: 소스 순서 가정. 비정렬이어도 마지막 통과 헤딩을 쓰므로 안전.
	return current ?? headings[0].id;
}
