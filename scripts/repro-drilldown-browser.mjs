// repro-drilldown.mjs 의 브라우저 구간 — node + playwright-core 로 CDP 연결.
// 게이트 페이지에서 자식 보유 모듈 노드를 실제 마우스 더블클릭하고 하위 패널 렌더를 검증.
// 회귀 포인트: ReactFlow v11 은 클릭 계열 핸들러가 없는 읽기 전용 노드 wrapper 에
// 인라인 pointer-events:none 을 주입해 더블클릭이 히트테스팅에서 사라진다(GraphView 수정).
import { chromium } from "playwright-core";

const base = process.env.FN_BASE;
const port = process.env.FN_CDP_PORT;
if (!base || !port) {
	console.log("FN_BASE/FN_CDP_PORT 필요 — bun repro-drilldown.mjs 로 실행하라");
	process.exit(2);
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = await context.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
	if (m.type() === "error") errors.push(m.text());
});

let exitCode = 1;
try {
	// networkidle 은 2초 폴링 때문에 절대 안 옴 — domcontentloaded 기준.
	await page.goto(base, { waitUntil: "domcontentloaded", timeout: 20000 });
	await page.waitForSelector(".react-flow__node", { timeout: 15000 });
	const before = await page.locator(".graph-card").count();

	// 자식 보유 모듈 노드(Chat API)를 실제 마우스 좌표로 더블클릭.
	const node = page
		.locator(".react-flow__node", { hasText: "Chat API" })
		.first();
	const box = await node.boundingBox();
	if (!box) throw new Error("노드 boundingBox 없음");
	await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(600);

	const after = await page.locator(".graph-card").count();
	// innerText 는 card-title 의 text-transform: uppercase 에 절다 — textContent 기준.
	const title = await page
		.locator(".graph-card .card-title")
		.first()
		.textContent();
	const selected = title.includes("선택: Chat API");
	console.log(
		`cards before=${before} after=${after} | selected=${selected} | title=${title.slice(0, 40)}`,
	);
	if (errors.length > 0) console.log("page errors:", errors.slice(0, 3));

	if (after === before + 1 && selected) {
		console.log("DRILLDOWN PASS");
		exitCode = 0;
	} else {
		console.log("DRILLDOWN FAIL — 더블클릭 후 하위 패널 미표시");
	}
} catch (err) {
	console.log("재현 실행 오류:", String(err).split("\n")[0]);
} finally {
	await browser.close();
}
process.exit(exitCode);
