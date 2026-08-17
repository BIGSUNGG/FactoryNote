// 블록 단위 변경 감지(ADR-027) — 게이트 중 재작성된 산출물의 추가·수정 블록 마킹.
// prev↔현재 블록 시퀀스를 콘텐츠 지문으로 LCS 매칭 → 매칭 안 된 현재 블록 = 변경.
// 외부 diff 라이브러리 없음: 문서는 수백 블록 이하라 O(n·m) DP 로 충분.

/** 블록 콘텐츠 지문 — 같은 내용이면 같은 키(블록 id 는 위치 기반이라 비교 불가). */
export function blockKey(b) {
	switch (b.type) {
		case "heading":
			return `h${b.level}:${b.html}`;
		case "paragraph":
		case "quote":
			return `${b.type}:${b.html}`;
		case "code":
			return `code:${b.lang}:${b.code}`;
		case "list":
			return `list:${b.ordered}:${b.items
				.map((it) => `${it.checked}|${it.html}`)
				.join("\n")}`;
		case "table":
			return `table:${JSON.stringify([b.headers, b.rows])}`;
		case "image":
			return `img:${b.src}`;
		case "graph":
			return `graph:${b.graphFile}`;
		case "hr":
			return "hr";
		default:
			return `${b.type}:${JSON.stringify(b)}`;
	}
}

/** LCS 매칭 — 매칭된 prev·new 인덱스 집합 반환(내부 공유). */
function lcsMatched(pk, nk) {
	const n = pk.length;
	const m = nk.length;

	// LCS 길이 테이블(역방향 채움) → 탐욕 backtrack 으로 매칭 판정.
	const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] =
				pk[i] === nk[j]
					? dp[i + 1][j + 1] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const matchedPrev = new Set();
	const matchedNew = new Set();
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (pk[i] === nk[j]) {
			matchedPrev.add(i);
			matchedNew.add(j);
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			i++;
		} else {
			j++;
		}
	}
	return { matchedPrev, matchedNew };
}

/** prev↔현재 비교 — 변경·추가된 현재 블록 id 집합 반환.
 * changed = 매칭 안 된 현재 블록 전부(추가 포함), added = 대응 prev 없는 순수 추가.
 * 미매칭 new 는 정규화 위치가 가장 가까운 미매칭 prev 와 짝(수정) — 거리 임계 초과·
 * 짝 없음 = 추가. 순서 소비 방식은 '상단 삽입 + 하단 수정' 동시 발생 시 상단 삽입이
 * 하단 수정의 prev 를 가로채 색이 뒤바뀌던 버그가 있어 위치 기반으로 교체.
 * 삭제된 블록은 현재 문서에 존재하지 않으므로 마킹 대상이 아니다. */
export function diffBlockChanges(prevBlocks, newBlocks) {
	const pk = prevBlocks.map(blockKey);
	const nk = newBlocks.map(blockKey);
	const { matchedPrev, matchedNew } = lcsMatched(pk, nk);
	const n = pk.length;
	const m = nk.length;
	const unmatchedPrev = [];
	pk.forEach((_, i) => {
		if (!matchedPrev.has(i)) unmatchedPrev.push(i);
	});
	const used = new Set();
	const changed = new Set();
	const added = new Set();
	newBlocks.forEach((b, j) => {
		if (matchedNew.has(j)) return;
		changed.add(b.id);
		const pos = m > 1 ? j / (m - 1) : 0;
		let best = -1;
		let bestD = 0.25; // 임계 — 멀리 떨어진 블록은 짝으로 보지 않음
		for (const i of unmatchedPrev) {
			if (used.has(i)) continue;
			const d = Math.abs((n > 1 ? i / (n - 1) : 0) - pos);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		if (best >= 0) used.add(best);
		else added.add(b.id);
	});
	return { changed, added };
}

/** 하위 호환 래퍼 — 변경·추가 블록 id 통합 집합. */
export function diffChangedBlockIds(prevBlocks, newBlocks) {
	return diffBlockChanges(prevBlocks, newBlocks).changed;
}
