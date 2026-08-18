import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Topbar from "./Topbar";
import Stepper from "./Stepper";
import Toc from "./Toc";
import Document from "./Document";
import GateBar from "./GateBar";
import SplitNode from "./SplitNode";
import GraphView from "./GraphView";
import SequenceView from "./SequenceView";
import FlowchartView from "./FlowchartView";
import { mdToBlocks } from "../lib/mdToBlocks";
import { diffBlockChanges } from "../lib/blockDiff";
import { DOC_TAB, graphTabId, openGraphTab } from "../lib/viewerTabs";
import {
	createRootLayout,
	findLeaf,
	allLeaves,
	splitPane,
	moveTab,
	closeTabIn,
	setActive,
	setRatio,
	replacePane,
} from "../lib/splitLayout";

// plan 스타일 페이지 — 마크다운 문서 + 블록/영역 코멘트. Stage 1·3 이 공유.
const STAGE_DEFS = [
	{ n: 1, label: "요청 이해·시나리오", route: "" },
	{ n: 2, label: "모듈·클래스 설계", route: "design" },
	{ n: 3, label: "구현 계획", route: "impl" },
];
const stagesFor = (viewed, real) =>
	STAGE_DEFS.map((s) => {
		// 두 축을 분리(F2): '작성 여부'는 실제 서버 단계(real) 기준, '지금 보는 단계'는 viewed.
		// - s.n > real: 아직 작성 안 됨(잠금·선택 불가)
		// - s.n === viewed: 지금 보고 있는 단계(현재 편집=current, 이전 단계 읽기 전용=view)
		// - 그 외(작성됨·선택 가능): 클릭으로 해당 단계 이동/이전 단계 복귀
		return { ...s, state: stepperState(s.n, viewed, real) };
	});

/** 스텝 표시 상태 — 중첩 삼항 대신 가독 판정: locked > current/view > done. */
function stepperState(n, viewed, real) {
	if (n > real) return "locked";
	if (n === viewed) return real === viewed ? "current" : "view";
	return "done";
}

const stripHtml = (html) => html.replace(/<[^>]+>/g, "").trim();

/** 그래프 상세 탭 콘텐츠(ADR-031) — 블록과 동일한 뷰 컴포넌트를 탭 전체에 크게 렌더.
 * tree = ReactFlow 줌/팬, sequence·flowchart = 스크롤로 탐색. 새 시각화 없음. */
function GraphDetail({ file, entry }) {
	if (!entry)
		return (
			<div className="empty">그래프 데이터({file})를 찾을 수 없습니다.</div>
		);
	if (entry.type === "sequence") return <SequenceView data={entry.data} />;
	if (entry.type === "flowchart") return <FlowchartView data={entry.data} />;
	return <GraphView tree={entry.data} />;
}

// Range 를 <mark> 로 감싼다. 한 번에 감싸는 기법은 여러 블록/노드에 걸친 범위에서
// 에러를 던지므로, 텍스트 노드마다 잘라서 감싼다(멀티 블록 안전).
function highlightRange(range, className) {
	const root = range.commonAncestorContainer;
	const walkerRoot =
		root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
	if (!walkerRoot) return;
	const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			return range.intersectsNode(node) &&
				node.nodeValue &&
				node.nodeValue.length
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT;
		},
	});
	const targets = [];
	while (walker.nextNode()) targets.push(walker.currentNode);
	for (const node of targets) {
		let start = 0;
		let end = node.nodeValue.length;
		if (node === range.startContainer) start = range.startOffset;
		if (node === range.endContainer) end = range.endOffset;
		if (start >= end) continue;
		const slice = node.nodeValue.slice(start, end);
		if (!slice.trim()) continue;
		const mark = document.createElement("mark");
		mark.className = className;
		mark.textContent = slice;
		const tail = node.splitText(start);
		tail.splitText(end - start);
		tail.parentNode.replaceChild(mark, tail);
	}
}

export default function PlanPage({
	mdSource,
	prevMdSource, // 게이트 중 재작성 전 버전(ADR-027 변경 하이라이트 기준). 없으면 하이라이트 생략.
	stage,
	activeStage, // 실제 서버 단계(state.stage) — 스테퍼 작성여부 기준
	onGate,
	onReview,
	stageLabels = {},
	onActiveBlock,
	graphData = {},
	readOnly = false, // 이전 단계 보기: 코멘트·게이트·채팅 비활성
	loading = false, // 게이트 결정 제출 후 다음 산출물 준비 중(확정 버튼 로딩)
	loadingLabel, // 로딩 사유 라벨(확정 요청 큐 대기 중 안내). GateBar 로 전달.
	onSelectStage, // 읽기 전용 이전 단계 선택/복귀(단계 전환 이벤트)
}) {
	const label = STAGE_DEFS[stage - 1].label;
	// 스테퍼: 작성 여부는 실제 서버 단계(activeStage)로, 강조(현재/읽기전용)는 보고 있는 단계(stage)로.
	// 읽기 전용으로 이전 단계를 봐도 뒤의 실제 작성 단계는 'done'(작성됨)으로 유지되어
	// '아직 안 쓴 단계(locked)'처럼 보이지 않는다. onSelectStage 없으면 레거시 해시 라우팅.
	const stages = stagesFor(stage, activeStage ?? stage);
	const blocks = useMemo(() => mdToBlocks(mdSource), [mdSource]);

	// 변경 하이라이트(ADR-027): prev 가 있을 때만 prev↔현재 블록 diff 로 변경·추가 블록 마킹.
	const blockChanges = useMemo(() => {
		if (!prevMdSource) return { changed: new Set(), added: new Set() };
		return diffBlockChanges(mdToBlocks(prevMdSource), blocks);
	}, [prevMdSource, blocks]);

	const toc = useMemo(() => {
		const hs = blocks.filter(
			(b) => b.type === "heading" && b.level >= 2 && b.level <= 3,
		);
		return hs.map((b) => ({
			id: b.id,
			label: stripHtml(b.html),
		}));
	}, [blocks]);

	const [comments, setComments] = useState([]);
	const [activeTargetId, setActiveTargetId] = useState(null);
	const [activeHeading, setActiveHeading] = useState(null); // scroll-spy 현재 h2/h3 헤딩 id
	const [activeRange, setActiveRange] = useState(null);
	const [rangeDraft, setRangeDraft] = useState("");
	const [fontScale, setFontScale] = useState(1); // md 본문 글자 배율(−/+ 버튼)

	// 문서 뷰어 탭 + 분할 레이아웃(ADR-031·ADR-032): 분할 트리(leaf = 탭 목록).
	// PlanPage 는 스테이지 전환에도 마운트 유지 → 레이아웃도 유지. 상태는 세션 내에만.
	const [layout, setLayout] = useState(() =>
		createRootLayout([DOC_TAB], DOC_TAB.id),
	);
	const [focusPane, setFocusPane] = useState(null);
	const [drag, setDrag] = useState(null); // { paneId, tabId } — 탭 드래그 중
	const [hoverZone, setHoverZone] = useState(null); // { paneId, zone }
	const [menu, setMenu] = useState(null); // { x, y, paneId, tabId } — 탭 우클릭 분할 메뉴
	const focusedId =
		focusPane && findLeaf(layout, focusPane)
			? focusPane
			: allLeaves(layout)[0]?.id;

	const openGraph = (graphFile) => {
		setLayout((l) =>
			replacePane(l, focusedId, (leaf) => ({
				...leaf,
				tabs: openGraphTab(leaf.tabs, graphFile),
				activeId: graphTabId(graphFile), // 재더블클릭 = 기존 탭 포커스
			})),
		);
	};
	const selectTab = (paneId, tabId) => {
		setFocusPane(paneId);
		setLayout((l) => setActive(l, paneId, tabId));
	};
	const closeTabAt = (paneId, tabId) =>
		setLayout((l) => closeTabIn(l, paneId, tabId));
	const startDrag = (paneId, tabId) => {
		setFocusPane(paneId);
		setDrag({ paneId, tabId });
	};
	const endDrag = () => {
		setDrag(null);
		setHoverZone(null);
	};
	// 드롭 — 가장자리 존 = 해당 방향 분할(탭 이동), 중앙 = 대상 영역으로 탭 이동.
	const dropZone = (paneId, zone) => {
		if (!drag) return;
		const { paneId: from, tabId } = drag;
		setLayout((l) => {
			const tab = findLeaf(l, from)?.tabs.find((t) => t.id === tabId);
			if (!tab) return l;
			return zone === "center"
				? moveTab(l, tabId, from, paneId)
				: splitPane(l, paneId, zone, [tab], { move: true });
		});
		setFocusPane(paneId);
		endDrag();
	};
	// 우클릭 메뉴 — 탭 복제 분할(원본 유지). 바깥 클릭·Esc 로 닫힘.
	const openMenu = (e, paneId, tabId) => {
		e.preventDefault();
		setMenu({ x: e.clientX, y: e.clientY, paneId, tabId });
	};
	const splitByMenu = (direction) => {
		setLayout((l) => {
			const tab = findLeaf(l, menu.paneId)?.tabs.find(
				(t) => t.id === menu.tabId,
			);
			return tab
				? splitPane(l, menu.paneId, direction, [tab], { move: false })
				: l;
		});
		setMenu(null);
	};
	useEffect(() => {
		if (!menu) return;
		const close = () => setMenu(null);
		const esc = (e) => e.key === "Escape" && setMenu(null);
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", esc);
		};
	}, [menu]);

	// 코멘트를 로컬(인라인 표시용)에 추가함과 동시에 실시간 에이전트 채팅으로 즉시 전달.
	// 게이트를 유지한 채 chatPending 루프로 에이전트에게 닿는다(ADR-009).
	const addComment = (targetId, text, quote = null, blockIds = null) => {
		setComments((c) => [
			...c,
			{
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				targetId,
				text,
				quote,
			},
		]);
		const body = { text };
		// 범위 코멘트가 여러 블록에 걸치면 전체 블록 목록을 스코프로 에이전트에게 전달.
		const scope = blockIds && blockIds.length ? blockIds.join(",") : targetId;
		if (scope) body.blockId = scope;
		if (quote) body.quote = quote;
		fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
			.then(() => window.dispatchEvent(new Event("fn-chat-update")))
			.catch(() => {});
	};
	const activate = (id) => {
		setActiveTargetId((prev) => {
			const next = prev === id ? null : id;
			// F1: 채팅 부분 코멘트를 위해 현재 선택 블록을 App 으로 끌어올린다.
			onActiveBlock?.(next);
			return next;
		});
	};

	const onRangeComment = (blockId, sel, quote, blockIds) => {
		const range = sel.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		highlightRange(range, "comment-hl"); // 멀티 노드/블록 안전 하이라이트
		sel.removeAllRanges();
		setActiveRange({ blockId, quote, rect, blockIds });
		setActiveTargetId(null);
	};
	const submitRange = () => {
		if (!rangeDraft.trim() || !activeRange) return;
		addComment(
			activeRange.blockId,
			rangeDraft.trim(),
			activeRange.quote,
			activeRange.blockIds,
		);
		setRangeDraft("");
		setActiveRange(null);
	};

	// 게이트 결정 전송 — pi 에이전트로 verdict 를 POST. 코멘트는 채팅으로 이미 전달됨.
	const sendConfirm = () => onGate({ verdict: "confirm", comments: [] });
	const sendRevert = (target) =>
		onGate({ verdict: "revert", comments: [], revertTo: target });

	// 읽기 전용 모드: 코멘트 생성·범위 코멘트·블록 활성화를 모두 무시(잠금).
	// 핸들러를 no-op 으로 대체해 코멘트 작성 채널을 완전히 잠근다(쓰기 금지).
	const commentFreeze = readOnly
		? { onAddComment() {}, onActivate() {}, onRangeComment() {} }
		: {};

	const rangePopover = activeRange
		? createPortal(
				<div
					className="comment-popover comment-popover-fixed"
					style={{
						position: "fixed",
						top: activeRange.rect.bottom + 6,
						left: activeRange.rect.left,
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="popover-head">
						<span>
							영역 코멘트 ·{" "}
							{activeRange.blockIds && activeRange.blockIds.length > 1
								? activeRange.blockIds.join(", ")
								: activeRange.blockId}
						</span>
						<button onClick={() => setActiveRange(null)} title="닫기">
							✕
						</button>
					</div>
					<blockquote className="range-quote">“{activeRange.quote}”</blockquote>
					<div className="comment-input-row">
						<input
							value={rangeDraft}
							autoFocus
							placeholder="선택한 영역에 코멘트…"
							onChange={(e) => setRangeDraft(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && submitRange()}
						/>
						<button className="add-btn" onClick={submitRange}>
							추가
						</button>
					</div>
				</div>,
				document.body,
			)
		: null;

	return (
		<>
			<Topbar />
			<Stepper stages={stages} onSelect={onSelectStage} />
			{readOnly && (
				<div className="readonly-banner" role="status">
					🔒 Stage {stage} 이전 단계(읽기 전용) — 코멘트·채팅·게이트가
					비활성화됐습니다.
					<button
						type="button"
						className="readonly-exit"
						onClick={() => onSelectStage?.(null)}
					>
						현재 단계로 돌아가기
					</button>
				</div>
			)}
			<div className="layout">
				<Toc items={toc} activeId={activeHeading} />
				<div className="doc-column">
					<SplitNode
						node={layout}
						renderTab={(t) =>
							t.id === DOC_TAB.id ? (
								<Document
									blocks={blocks}
									changedIds={blockChanges.changed}
									addedIds={blockChanges.added}
									comments={comments}
									onAddComment={commentFreeze.onAddComment ?? addComment}
									onActivate={commentFreeze.onActivate ?? activate}
									onRangeComment={
										commentFreeze.onRangeComment ?? onRangeComment
									}
									activeTargetId={readOnly ? null : activeTargetId}
									graphData={graphData}
									fontScale={fontScale}
									headingIds={toc.map((t) => t.id)}
									onActiveHeading={!readOnly ? setActiveHeading : undefined}
									onOpenGraph={openGraph}
								/>
							) : (
								<GraphDetail
									file={t.graphFile}
									entry={graphData[t.graphFile]}
								/>
							)
						}
						focusedPaneId={focusedId}
						drag={drag}
						hoverZone={hoverZone}
						setHoverZone={setHoverZone}
						onDropZone={dropZone}
						onTabSelect={selectTab}
						onTabClose={closeTabAt}
						onTabDragStart={startDrag}
						onTabDragEnd={endDrag}
						onTabContextMenu={openMenu}
						onRatioChange={(splitId, ratio) =>
							setLayout((l) => setRatio(l, splitId, ratio))
						}
					/>
				</div>
			</div>
			{!readOnly && (
				<GateBar
					stage={stage}
					label={label}
					stageLabels={stageLabels}
					onConfirm={sendConfirm}
					onRevert={sendRevert}
					onReview={onReview}
					loading={loading}
					loadingLabel={loadingLabel}
				/>
			)}
			<div className="fs-control" role="group" aria-label="글자 크기">
				<button
					type="button"
					className="fs-btn"
					onClick={() =>
						setFontScale((v) => Math.max(0.8, Math.round((v - 0.1) * 10) / 10))
					}
					aria-label="글자 크기 작게"
					title="글자 작게"
				>
					−
				</button>
				<button
					type="button"
					className="fs-btn"
					onClick={() =>
						setFontScale((v) => Math.min(1.6, Math.round((v + 0.1) * 10) / 10))
					}
					aria-label="글자 크기 크게"
					title="글자 크게"
				>
					+
				</button>
			</div>
			{rangePopover}
			{menu &&
				createPortal(
					<div
						className="split-menu"
						role="menu"
						style={{ top: menu.y, left: menu.x }}
						onMouseDown={(e) => e.stopPropagation()} // 메뉴 클릭이 바깥 클릭 닫힘보다 먼저
					>
						{[
							["left", "왼쪽으로 분할"],
							["right", "오른쪽으로 분할"],
							["up", "위로 분할"],
							["down", "아래로 분할"],
						].map(([dir, label]) => (
							<button
								key={dir}
								type="button"
								role="menuitem"
								onClick={() => splitByMenu(dir)}
							>
								{label}
							</button>
						))}
					</div>,
					document.body,
				)}
		</>
	);
}
