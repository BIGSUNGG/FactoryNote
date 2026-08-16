---
status: accepted
updated: 2026-08-16
tags: [adr, viewer, gate]
---

# ADR-027: 게이트 중 수정 블록 하이라이트(.prev 스냅샷 + 블록 LCS diff)

## 상태

accepted

## 날짜

2026-08-16

## 맥락 (Context)

게이트가 열린 동안 사용자가 채팅·코멘트로 수정을 요청하면 에이전트가 산출물 문서를
재작성한다. 재작성 후 뷰어는 새 문서 전체를 보여줄 뿐 **어디가 바뀌었는지** 표시하지
않아, 사용자는 이전 버전과 눈으로 대조해야 했다. 검토 부담이 늘고 수정 반영 확인이
느리다.

## 결정 (Decision)

1. **쓰기 직전 스냅샷**: `writeArtifact` 가 STAGES 등록 단계 산출물(md)을 덮어쓸 때
   직전 버전을 `<파일>.prev` 로 저장한다. 그래프 json·보조 파일은 대상 아님.
2. **서빙**: `viewer-state` 가 `/api/state` 산출물 항목에 `prevMd` 필드를 포함한다
   (`.prev` 존재 시에만).
3. **뷰어 블록 diff**: `blockDiff.js` 가 prev↔현재 문서를 `mdToBlocks` 로 분할한 뒤
   블록 콘텐츠 지문(`blockKey`)으로 LCS 매칭 — 매칭되지 않은 현재 블록(추가·수정)을
   `.block.changed` 로 상시 하이라이트. 미매칭 prev↔new 순서 짝짓기로 순수 추가를
   구분(`diffBlockChanges → {changed, added}`) — 추가 블록(`.block.added`)만 등장 연출
   (페이드인+솟아오름+앰버 플래시, reduced-motion 대응). 삭제 블록은 현재 문서에
   없으므로 마킹 없음.
4. **수명**: 게이트 확정(confirm) 시 `clearArtifactPrev` 가 해당 단계 `.prev` 삭제 —
   하이라이트는 '이번 게이트에서의 수정'만 표시. 회귀 시 `invalidateArtifactsAfter` 가
   무효화 산출물의 `.prev` 도 동반 삭제. 최초 작성 문서(prev 없음)는 하이라이트 없음.

## 이유 (Rationale)

- **감지 시점**: 에이전트가 파일을 다시 쓰는 순간이 old/new 를 정확히 아는 유일한 시점.
  쓰기 직전 스냅샷은 뷰어 리로드·게이트 재진입에도 기준이 살아 있다.
- **블록 단위**: 채팅 기반 수정은 단락 단위로 일어나 블록 배경색으로 충분히 식별되고,
  뷰어가 이미 블록 단위 렌더(`mdToBlocks` → `Block`)라 매칭이 자연스럽다.
- **라이브러리 0**: 문서는 수백 블록 이하 — 자체 LCS(O(n·m) DP)로 충분, diff-match-patch
  등 의존성 불필요.

## 대안 (Alternatives)

- **뷰어 메모리에 이전 콘텐츠 보관** — 새로고침·게이트 재진입 시 기준 소실. 배제.
- **LLM 에게 변경 곳 마크업 지시** — 비결정적·신뢰 불가. 배제.
- **word-level 인라인 diff(diff-match-patch)** — 정밀하지만 의존성 추가·렌더 복잡.
  필요 시 후속 확장(블록 diff 와 공존 가능). 현재는 블록 단위로 충분.
- **토글 버튼** — YAGNI. prev 가 존재하는 동안 상시 표시가 가장 단순.

## 결과 (Consequences)

- 긍정: 수정 검토 시간 단축 — 채팅 회신 후 바뀐 블록이 즉시 눈에 띈다.
- 긍정: 코어 `writeArtifact` 한 곳 + 확정 시 삭제 한 줄로 수명 관리 완결.
- 트레이드오프: 게이트 당 산출물 1개 추가 파일(`.prev`) 디스크 사용(확정 시 삭제).
- 한계: 블록 내 한 단어 수정도 블록 전체 하이라이트(word-level 미지원).
- 후속: word-level 인라인 하이라이트가 필요해지면 `diffChangedBlockIds` 로 마킹된
  블록만 diff-match-patch 로 세밀화(범위 국한).

## 참고

- 구현: `packages/factorynote/src/artifact.ts`(writeArtifact·readArtifactPrev·clearArtifactPrev)
  · `apps/pi-extension/src/viewer-state.ts`(prevMd) · `apps/pi-extension/src/plan-gate.ts`(확정 시 삭제)
  · `apps/plan-viewer/src/lib/blockDiff.js` · `Block.jsx`·`blocks.css`(.block.changed)
- 자체체크: 코어 prev 3건 + 게이트 prevMd 서빙 1건 + blockDiff 7건. 211 pass.
- 관련: [[ADR-015-stage-artifact-folders]](산출물 경로) · [[ADR-022-viewer-sse-push]](state push)
